import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import axios from 'axios';
import { IgAccountsService } from './ig-accounts.service';

const SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_comments',
  'instagram_business_manage_messages',
];

/**
 * "Instagram bilan ulash" — Instagram API with Instagram Login (OAuth).
 *
 * Oqim:
 *   1. panel → POST /api/instagram/connect → authorize URL (state = imzolangan JWT)
 *   2. foydalanuvchi Instagram'da ruxsat beradi
 *   3. Instagram → GET /api/instagram/callback?code&state
 *   4. code → qisqa token → uzoq muddatli token (60 kun) → /me → saqlash
 *   5. akkaunt webhook'larga obuna qilinadi (comments, messages)
 */
@Injectable()
export class IgOAuthService {
  private readonly logger = new Logger(IgOAuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly accounts: IgAccountsService,
  ) {}

  private get appId() {
    return this.config.get<string>('INSTAGRAM_APP_ID') || '';
  }
  private get appSecret() {
    return this.config.get<string>('INSTAGRAM_APP_SECRET') || '';
  }
  get redirectUri() {
    return this.config.get<string>('INSTAGRAM_REDIRECT_URI') || '';
  }
  get frontend() {
    return (this.config.get<string>('FRONTEND_ORIGIN') || '').replace(/\/$/, '');
  }

  get configured() {
    return !!(this.appId && this.appSecret && this.redirectUri);
  }

  async authorizeUrl(userId: number): Promise<string> {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        "Instagram ulash sozlanmagan: .env da INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET va INSTAGRAM_REDIRECT_URI kerak.",
      );
    }
    // state: kim ulayapti + bir martalik nonce, 10 daqiqa amal qiladi.
    // Imzolangan bo'lgani uchun callback'ni boshqa foydalanuvchi nomidan soxtalashtirib bo'lmaydi.
    const state = await this.jwt.signAsync(
      { sub: String(userId), purpose: 'ig-connect', n: crypto.randomBytes(8).toString('hex') },
      { expiresIn: '10m' },
    );
    const q = new URLSearchParams({
      enable_fb_login: '0',
      force_authentication: '1',
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: SCOPES.join(','),
      state,
    });
    return `https://www.instagram.com/oauth/authorize?${q.toString()}`;
  }

  /** Callback: kod → token → akkaunt. Muvaffaqiyatda saqlangan akkauntni qaytaradi */
  async complete(code: string, state: string) {
    let userId: number;
    try {
      const p: any = await this.jwt.verifyAsync(state);
      if (p?.purpose !== 'ig-connect') throw new Error('purpose');
      userId = Number(p.sub);
    } catch {
      throw new BadRequestException('Havola eskirgan yoki noto\'g\'ri. Paneldan qayta urinib ko\'ring.');
    }
    if (!code) throw new BadRequestException('Instagram kod qaytarmadi');

    // 1) code → qisqa muddatli token
    const form = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
      code: code.replace(/#_$/, ''), // Instagram ba'zan oxiriga "#_" qo'shadi
    });
    const short = await this.call(() =>
      axios.post('https://api.instagram.com/oauth/access_token', form.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 20_000,
      }),
    );
    // Javob ikki shaklda kelishi mumkin: {access_token,...} yoki {data:[{access_token,...}]}
    const s = Array.isArray(short.data) ? short.data[0] : short;
    const perms: string[] = Array.isArray(s.permissions) ? s.permissions : String(s.permissions || '').split(',');
    const missing = SCOPES.filter((sc) => perms.length && !perms.includes(sc));
    if (missing.length) {
      throw new BadRequestException(`Barcha ruxsatlar berilmadi: ${missing.join(', ')}`);
    }

    // 2) qisqa → uzoq muddatli (60 kun)
    const long = await this.call(() =>
      axios.get('https://graph.instagram.com/access_token', {
        params: { grant_type: 'ig_exchange_token', client_secret: this.appSecret, access_token: s.access_token },
        timeout: 20_000,
      }),
    );

    // 3) akkaunt ma'lumoti: user_id — webhook'larda keladigan professional akkaunt ID'si
    const me = await this.call(() =>
      axios.get('https://graph.instagram.com/v21.0/me', {
        params: { fields: 'user_id,username,profile_picture_url,account_type', access_token: long.access_token },
        timeout: 20_000,
      }),
    );
    if (!me.user_id) throw new BadRequestException('Instagram akkaunt ID\'si olinmadi');

    const acc = await this.accounts.save(userId, {
      igUserId: String(me.user_id),
      username: me.username,
      picture: me.profile_picture_url,
      token: long.access_token,
      expiresInSec: Number(long.expires_in) || null,
    });

    // 4) webhook obunasi — bo'lmasa kommentlar kelmaydi. Xato bo'lsa ulanish baribir saqlanadi.
    await this.subscribe(long.access_token).catch((e) =>
      this.logger.warn(`@${me.username} webhook obunasi xato: ${e.message}`),
    );

    this.logger.log(`🔗 Instagram ulandi: @${me.username} (${me.user_id}) → foydalanuvchi #${userId}`);
    return acc;
  }

  async subscribe(token: string) {
    await this.call(() =>
      axios.post('https://graph.instagram.com/v21.0/me/subscribed_apps', null, {
        params: { subscribed_fields: 'comments,messages,messaging_postbacks', access_token: token },
        timeout: 20_000,
      }),
    );
  }

  async unsubscribe(token: string) {
    await axios
      .delete('https://graph.instagram.com/v21.0/me/subscribed_apps', { params: { access_token: token }, timeout: 20_000 })
      .catch(() => undefined);
  }

  /** Meta xatosini o'qiladigan matnga aylantiradi */
  private async call<T = any>(fn: () => Promise<{ data: T }>): Promise<any> {
    try {
      return (await fn()).data;
    } catch (e: any) {
      const err = e?.response?.data;
      const msg = err?.error_message || err?.error?.message || err?.error_description || e.message;
      this.logger.error(`Instagram OAuth xato: ${JSON.stringify(err ?? e.message)}`);
      throw new BadRequestException(`Instagram: ${msg}`);
    }
  }
}

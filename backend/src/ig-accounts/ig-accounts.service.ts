import { ConflictException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { IgAccount } from './entities/ig-account.entity';
import { seal, open } from '../common/secret-box';
import type { IgCredentials } from '../instagram/instagram.service';
import { TelegramService } from '../telegram/telegram.service';

const GRAPH = 'https://graph.instagram.com';
const REFRESH_EVERY_MS = 6 * 3600_000; // har 6 soatda tekshiradi
const REFRESH_BEFORE_MS = 10 * 24 * 3600_000; // tugashiga 10 kun qolganda yangilaydi
const MIN_AGE_MS = 24 * 3600_000; // Meta: token kamida 24 soatlik bo'lishi kerak

/**
 * Instagram ulanishlari: saqlash, topish va tokenni avtomatik yangilash.
 *
 * Uzoq muddatli token ~60 kun yashaydi. Ilgari uni yangilash yo'q edi va bot
 * 60 kundan keyin jimgina to'xtardi. Endi har 6 soatda tekshiriladi va
 * tugashiga 10 kun qolganda yangilanadi; yangilab bo'lmasa egasiga Telegram
 * orqali xabar beriladi.
 */
@Injectable()
export class IgAccountsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IgAccountsService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(IgAccount) private readonly repo: Repository<IgAccount>,
    private readonly telegram: TelegramService,
  ) {}

  onModuleInit() {
    // Ishga tushgach biroz kutib birinchi tekshiruv (baza va boshqa modullar tayyor bo'lsin)
    setTimeout(() => void this.refreshDue(), 60_000).unref();
    this.timer = setInterval(() => void this.refreshDue(), REFRESH_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  forUser(userId: number) {
    return this.repo.findOne({ where: { userId } });
  }

  byIgUserId(igUserId: string) {
    return this.repo.findOne({ where: { igUserId: String(igUserId) } });
  }

  /** InstagramService chaqiruvlari uchun ochilgan token */
  creds(acc: IgAccount): IgCredentials {
    return { token: open(acc.tokenEnc), accountId: acc.igUserId };
  }

  async save(
    userId: number,
    info: { igUserId: string; username?: string | null; picture?: string | null; token: string; expiresInSec?: number | null },
  ): Promise<IgAccount> {
    const igUserId = String(info.igUserId);
    const owner = await this.byIgUserId(igUserId);
    if (owner && owner.userId !== userId) {
      throw new ConflictException('Bu Instagram akkaunt boshqa ReplyGo foydalanuvchisiga ulangan.');
    }

    const existing = (await this.forUser(userId)) ?? this.repo.create({ userId });
    existing.igUserId = igUserId;
    existing.username = info.username ?? existing.username ?? null;
    existing.profilePictureUrl = info.picture ?? existing.profilePictureUrl ?? null;
    existing.tokenEnc = seal(info.token);
    existing.tokenExpiresAt = info.expiresInSec ? new Date(Date.now() + info.expiresInSec * 1000) : null;
    existing.tokenRefreshedAt = new Date();
    existing.status = 'active';
    existing.lastError = null;
    return this.repo.save(existing);
  }

  async remove(userId: number): Promise<IgAccount | null> {
    const acc = await this.forUser(userId);
    if (acc) await this.repo.remove(acc);
    return acc;
  }

  /** Tugashi yaqin tokenlarni yangilaydi */
  async refreshDue() {
    const all = await this.repo.find({ where: { status: 'active' } });
    const now = Date.now();
    for (const acc of all) {
      const age = acc.tokenRefreshedAt ? now - new Date(acc.tokenRefreshedAt).getTime() : Infinity;
      const left = acc.tokenExpiresAt ? new Date(acc.tokenExpiresAt).getTime() - now : 0; // noma'lum = darhol
      if (left > REFRESH_BEFORE_MS || age < MIN_AGE_MS) continue;
      await this.refreshOne(acc);
    }
  }

  async refreshOne(acc: IgAccount) {
    try {
      const res = await axios.get(`${GRAPH}/refresh_access_token`, {
        params: { grant_type: 'ig_refresh_token', access_token: open(acc.tokenEnc) },
        timeout: 20_000,
      });
      acc.tokenEnc = seal(res.data.access_token);
      acc.tokenExpiresAt = new Date(Date.now() + Number(res.data.expires_in || 0) * 1000);
      acc.tokenRefreshedAt = new Date();
      acc.lastError = null;
      await this.repo.save(acc);
      this.logger.log(`🔄 @${acc.username} tokeni yangilandi (${acc.tokenExpiresAt.toISOString().slice(0, 10)} gacha)`);
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e.message;
      const expired = acc.tokenExpiresAt && new Date(acc.tokenExpiresAt).getTime() < Date.now();
      acc.lastError = String(msg).slice(0, 500);
      if (expired) acc.status = 'error';
      await this.repo.save(acc);
      this.logger.error(`Token yangilanmadi @${acc.username}: ${msg}`);
      await this.telegram
        .notifyUserText(
          acc.userId,
          `⚠️ <b>Instagram tokeni yangilanmadi</b>\n@${acc.username ?? acc.igUserId}\n` +
            (expired
              ? 'Token muddati tugagan — panel → Sozlamalar orqali Instagram\'ni qayta ulang.'
              : 'Keyinroq yana urinib ko\'riladi.'),
        )
        .catch(() => undefined);
    }
  }

  /** Token ishlayotganini tekshirish uchun (panel holati) */
  async markError(acc: IgAccount, message: string) {
    acc.status = 'error';
    acc.lastError = message.slice(0, 500);
    await this.repo.save(acc);
  }
}

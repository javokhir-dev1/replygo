import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import axios from 'axios';
import { IgAccount } from './entities/ig-account.entity';
import { IgAccountSnapshot } from './entities/ig-account-snapshot.entity';
import { UsersService } from '../users/users.service';
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
    @InjectRepository(IgAccountSnapshot) private readonly snaps: Repository<IgAccountSnapshot>,
    private readonly telegram: TelegramService,
    private readonly users: UsersService,
  ) {}

  onModuleInit() {
    // Ishga tushgach biroz kutib birinchi tekshiruv (baza va boshqa modullar tayyor bo'lsin)
    const tick = async () => {
      await this.refreshDue();
      await this.snapshotDue();
    };
    setTimeout(() => void tick(), 60_000).unref();
    this.timer = setInterval(() => void tick(), REFRESH_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Foydalanuvchining ulangan (uzilmagan) akkauntlari, ulangan tartibida */
  listForUser(userId: number) {
    return this.repo.find({ where: { userId, status: Not('disconnected') }, order: { connectedAt: 'ASC' } });
  }

  /** Foydalanuvchining bitta akkaunti — begonaniki bo'lsa 404 */
  async getForUser(userId: number, id: number) {
    const acc = await this.repo.findOne({ where: { id, userId, status: Not('disconnected') } });
    if (!acc) throw new NotFoundException('Akkaunt topilmadi');
    return acc;
  }

  /**
   * Panelda tanlangan akkaunt. Tanlov yo'q yoki eskirgan bo'lsa — birinchi
   * ulangan akkaunt tanlanadi va eslab qolinadi. Umuman akkaunt bo'lmasa null.
   */
  async activeFor(userId: number): Promise<IgAccount | null> {
    const user = await this.users.findById(userId);
    const list = await this.listForUser(userId);
    if (!list.length) {
      if (user?.activeIgAccountId) await this.users.setActiveIgAccount(userId, null);
      return null;
    }
    const chosen = list.find((a) => a.id === user?.activeIgAccountId) ?? list[0];
    if (chosen.id !== user?.activeIgAccountId) await this.users.setActiveIgAccount(userId, chosen.id);
    return chosen;
  }

  /** Faol akkaunt shart bo'lgan amallar uchun (qoida yaratish va h.k.) */
  async requireActive(userId: number): Promise<IgAccount> {
    const acc = await this.activeFor(userId);
    if (!acc) throw new BadRequestException('Avval Instagram akkauntni ulang (Sozlamalar)');
    return acc;
  }

  async select(userId: number, id: number) {
    const acc = await this.getForUser(userId, id);
    await this.users.setActiveIgAccount(userId, acc.id);
    return acc;
  }

  /** Webhook uchun: faqat ulangan (uzilmagan) akkaunt */
  byIgUserId(igUserId: string) {
    return this.repo.findOne({ where: { igUserId: String(igUserId), status: Not('disconnected') } });
  }

  /** InstagramService chaqiruvlari uchun ochilgan token */
  creds(acc: IgAccount): IgCredentials {
    return { token: open(acc.tokenEnc), accountId: acc.igUserId };
  }

  /**
   * OAuth natijasini saqlaydi.
   *   - shu foydalanuvchida bu akkaunt bor (yoki uzilgan) → token yangilanadi, qayta faollashadi
   *   - boshqa foydalanuvchida ULANGAN → rad etiladi
   *   - boshqa foydalanuvchida uzilgan → u eski bog'lanish olib tashlanadi, yangisi yaratiladi
   */
  async save(
    userId: number,
    info: { igUserId: string; username?: string | null; picture?: string | null; token: string; expiresInSec?: number | null },
  ): Promise<IgAccount> {
    const igUserId = String(info.igUserId);
    let acc = await this.repo.findOne({ where: { igUserId } });
    if (acc && acc.userId !== userId) {
      if (acc.status !== 'disconnected') {
        throw new ConflictException('Bu Instagram akkaunt boshqa ReplyGo foydalanuvchisiga ulangan.');
      }
      await this.repo.remove(acc); // eski egasining qoidalari unda qoladi, akkauntga bog'lanmaydi
      acc = null;
    }

    acc = acc ?? this.repo.create({ userId, igUserId });
    acc.username = info.username ?? acc.username ?? null;
    acc.profilePictureUrl = info.picture ?? acc.profilePictureUrl ?? null;
    acc.tokenEnc = seal(info.token);
    acc.tokenExpiresAt = info.expiresInSec ? new Date(Date.now() + info.expiresInSec * 1000) : null;
    acc.tokenRefreshedAt = new Date();
    acc.status = 'active';
    acc.lastError = null;
    const saved = await this.repo.save(acc);
    await this.users.setActiveIgAccount(userId, saved.id); // yangi ulangan akkaunt — tanlanadi
    return saved;
  }

  /** Uzish: token o'chiriladi, qator qoladi (qoidalar va statistika saqlanadi) */
  async disconnect(userId: number, id: number): Promise<IgAccount> {
    const acc = await this.getForUser(userId, id);
    acc.status = 'disconnected';
    acc.tokenEnc = '';
    acc.tokenExpiresAt = null;
    await this.repo.save(acc);
    await this.activeFor(userId); // faol bo'lgan bo'lsa — boshqasiga o'tadi
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

  /** Toshkent vaqti bo'yicha bugungi sana (YYYY-MM-DD) */
  private today(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
  }

  /** Har akkaunt uchun kuniga bitta snapshot (obunachilar o'sishi grafigi uchun) */
  async snapshotDue() {
    const day = this.today();
    for (const acc of await this.repo.find({ where: { status: 'active' } })) {
      if (await this.snaps.findOne({ where: { igAccountId: acc.id, day } })) continue;
      try {
        const res = await axios.get(`${GRAPH}/v21.0/${acc.igUserId}`, {
          params: { fields: 'followers_count,media_count,username,profile_picture_url', access_token: open(acc.tokenEnc) },
          timeout: 20_000,
        });
        await this.recordStats(acc, res.data);
        await this.snaps.save({ igAccountId: acc.id, day, followersCount: res.data.followers_count ?? null, mediaCount: res.data.media_count ?? null });
      } catch (e: any) {
        this.logger.warn(`Snapshot olinmadi @${acc.username}: ${e?.response?.data?.error?.message || e.message}`);
      }
    }
  }

  /** Instagram'dan kelgan ko'rsatkichlarni keshga yozadi (ro'yxatda API'siz ko'rsatish uchun) */
  async recordStats(acc: IgAccount, info: { followers_count?: number; media_count?: number; username?: string; profile_picture_url?: string }) {
    const patch: Partial<IgAccount> = {};
    if (info.followers_count != null) patch.followersCount = info.followers_count;
    if (info.media_count != null) patch.mediaCount = info.media_count;
    if (info.username) patch.username = info.username;
    if (info.profile_picture_url) patch.profilePictureUrl = info.profile_picture_url;
    if (Object.keys(patch).length) await this.repo.update({ id: acc.id }, patch);
  }

  /** Token ishlayotganini tekshirish uchun (panel holati) */
  async markError(acc: IgAccount, message: string) {
    acc.status = 'error';
    acc.lastError = message.slice(0, 500);
    await this.repo.save(acc);
  }
}

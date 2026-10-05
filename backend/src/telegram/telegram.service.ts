import { Injectable, Logger, OnModuleInit, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { TelegramChat } from './entities/telegram-chat.entity';
import { TELEGRAM_QUEUE, JOB_NOTIFY } from './telegram.constants';
import { callTelegram, escapeHtml } from './telegram.api';
import { SettingsService } from '../settings/settings.service';

/** LogsService dan keladigan ma'lumot (Log entity bilan bir xil shakl) */
export interface LogLike {
  id?: number;
  userId?: number | null;
  /** Qaysi Instagram akkauntdan (bir nechta akkaunt bo'lsa ajratish uchun) */
  accountUsername?: string | null;
  type: string;
  action: string;
  message?: string;
  user?: string;
  userMessage?: string;
  createdAt?: Date;
}

// Telegram xabar uzunligi 4096 belgi; matn qismlarini shundan ancha past
// kesamiz — bitta uzun izoh butun xabarni yeb qo'ymasin.
const MAX_FIELD = 400;
const LINK_TTL_MS = 15 * 60_000;

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token: string;
  private readonly webAppUrl: string;
  private botUsername: string | null = null;
  private polling = false;
  private offset = 0;
  // Bir martalik bog'lash kodlari: kod → egasi. Xotirada — 15 daqiqa yashaydi,
  // qayta ishga tushsa yo'qoladi (foydalanuvchi shunchaki yangisini oladi).
  private readonly links = new Map<string, { userId: number; exp: number }>();

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(TelegramChat)
    private readonly repo: Repository<TelegramChat>,
    @InjectQueue(TELEGRAM_QUEUE) private readonly queue: Queue,
    private readonly settings: SettingsService,
  ) {
    this.token = this.config.get<string>('TELEGRAM_BOT_TOKEN') || '';
    this.webAppUrl = this.config.get<string>('TELEGRAM_WEBAPP_URL') || '';
  }

  get enabled(): boolean {
    return !!this.token;
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('TELEGRAM_BOT_TOKEN berilmagan — Telegram loglari o\'chirilgan');
      return;
    }

    try {
      const me = await callTelegram<{ username: string }>(this.token, 'getMe');
      this.botUsername = me.username;
      this.logger.log(`Telegram bot ulandi: @${me.username}`);
    } catch (e: any) {
      this.logger.error(`Telegram bot tokeni yaroqsiz: ${e.message}`);
      return;
    }

    await this.setupMenuButton();

    this.polling = true;
    void this.pollLoop();
  }

  onModuleDestroy() {
    this.polling = false;
  }

  /* ------------------------- chatlar va egalari ------------------------- */

  /** Panel: "Telegram'ni ulash" — bir martalik havola */
  createLink(userId: number) {
    if (!this.enabled || !this.botUsername) {
      throw new ServiceUnavailableException('Telegram bot sozlanmagan yoki ulanmagan');
    }
    const now = Date.now();
    for (const [k, v] of this.links) if (v.exp < now) this.links.delete(k);
    // Telegram start-parametri: [A-Za-z0-9_-], 64 belgigacha
    const code = crypto.randomBytes(12).toString('base64url');
    this.links.set(code, { userId, exp: now + LINK_TTL_MS });
    return { url: `https://t.me/${this.botUsername}?start=${code}`, expiresInSec: LINK_TTL_MS / 1000 };
  }

  private consumeLink(code: string): number | null {
    const hit = this.links.get(code);
    this.links.delete(code); // bir martalik — muvaffaqiyatli yoki yo'q
    return hit && hit.exp > Date.now() ? hit.userId : null;
  }

  async registerChat(chatId: string, title: string | null, userId: number): Promise<void> {
    const existing = await this.repo.findOne({ where: { chatId } });
    const row = existing ?? this.repo.create({ chatId });
    row.userId = userId;
    row.isActive = true;
    if (title) row.title = title;
    await this.repo.save(row);
    this.logger.log(`Telegram chat bog'landi: ${chatId} (${title ?? '-'}) → foydalanuvchi #${userId}`);
  }

  async deactivateChat(chatId: string): Promise<void> {
    await this.repo.update({ chatId }, { isActive: false });
    this.logger.log(`Telegram chat o'chirildi: ${chatId}`);
  }

  /** Panel: chatni egasidan uzish (faqat o'z chatini) */
  async unlink(userId: number, chatId: string) {
    const res = await this.repo.delete({ chatId, userId });
    return { removed: (res.affected ?? 0) > 0 };
  }

  /** Chat kimga tegishli (faol bo'lsa). Mini App ruxsati shu bilan tekshiriladi */
  async ownerOf(chatId: string | number): Promise<number | null> {
    const c = await this.repo.findOne({ where: { chatId: String(chatId), isActive: true } });
    return c?.userId ?? null;
  }

  chatsFor(userId: number) {
    return this.repo.find({ where: { userId }, order: { createdAt: 'ASC' } });
  }

  private async activeChatsFor(userId: number): Promise<TelegramChat[]> {
    return this.repo.find({ where: { userId, isActive: true } });
  }

  /** Panel uchun holat */
  async statusFor(userId: number) {
    const chats = await this.chatsFor(userId);
    return {
      configured: this.enabled,
      connected: !!this.botUsername,
      username: this.botUsername,
      webAppUrl: this.webAppUrl || null,
      chats: chats.map((c) => ({ chatId: c.chatId, title: c.title, isActive: c.isActive })),
    };
  }

  /* --------------------------- yuborish --------------------------- */

  /**
   * Log yozuvini EGASINING chatlariga navbat orqali yuboradi.
   *
   * Shu bilan: Telegram rate limiti nazorat qilinadi, xato bo'lsa qayta
   * urinish bo'ladi va Instagram oqimi Telegram sekinligidan sekinlashmaydi.
   */
  async notifyLog(log: LogLike): Promise<void> {
    if (!this.enabled || !log.userId) return;
    if (!(await this.settings.get(log.userId)).telegramEnabled) return;
    const chats = await this.activeChatsFor(log.userId);
    if (!chats.length) return;

    const text = this.formatLog(log);
    await Promise.all(
      chats.map((c) =>
        this.queue.add(
          JOB_NOTIFY,
          { chatId: c.chatId, text },
          {
            attempts: +(this.config.get('TELEGRAM_QUEUE_ATTEMPTS') ?? 5),
            backoff: { type: 'exponential' as const, delay: 5_000 },
            removeOnComplete: 500,
            removeOnFail: 1_000,
            // Bitta log bitta chatga faqat bir marta — Instagram tomonidagi
            // retry yoki dublikat webhook Telegramda takrorlanmasin.
            jobId: log.id ? `log-${log.id}-${c.chatId}`.replace(/:/g, '-') : undefined,
          },
        ),
      ),
    );
  }

  /** Bitta foydalanuvchiga tizim xabari (masalan token yangilanmadi) */
  async notifyUserText(userId: number, text: string): Promise<void> {
    if (!this.enabled) return;
    const chats = await this.activeChatsFor(userId);
    await Promise.all(chats.map((c) => this.queue.add(JOB_NOTIFY, { chatId: c.chatId, text })));
  }

  /** Processor chaqiradi — haqiqiy yuborish shu yerda */
  sendMessage(chatId: string, text: string, replyMarkup?: object) {
    return callTelegram(this.token, 'sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  }

  /** Statistika WebApp'ini ochadigan tugma (xabar tagida) */
  private statsKeyboard(): object | undefined {
    if (!this.webAppUrl) return undefined;
    return {
      inline_keyboard: [[{ text: '📊 Statistika', web_app: { url: this.webAppUrl } }]],
    };
  }

  /**
   * Chat oynasidagi doimiy menyu tugmasi ("/" yonidagi) — Mini App'ni ochadi.
   * Bir marta o'rnatiladi, keyin bot uchun global saqlanadi.
   */
  private async setupMenuButton() {
    if (!this.webAppUrl) {
      this.logger.warn('TELEGRAM_WEBAPP_URL berilmagan — statistika tugmasi qo\'yilmadi');
      return;
    }
    try {
      await callTelegram(this.token, 'setChatMenuButton', {
        menu_button: {
          type: 'web_app',
          text: 'webapp',
          web_app: { url: this.webAppUrl },
        },
      });
      this.logger.log(`Telegram menyu tugmasi o'rnatildi: ${this.webAppUrl}`);
    } catch (e: any) {
      this.logger.error(`Menyu tugmasini o'rnatib bo'lmadi: ${e.message}`);
    }
  }

  /* -------------------------- formatlash -------------------------- */

  private cut(text: string, max = MAX_FIELD): string {
    const t = String(text ?? '').trim();
    if (t.length <= max) return t;
    return t.substring(0, max) + '…';
  }

  /**
   * Log → Telegram xabari.
   *
   * Foydalanuvchi so'ragan tarkib: kim yozgan, nima yozgan, bot nima javob
   * bergan, muvaffaqiyatlimi yoki xatomi, qaysi turdagi amal (javob/DM).
   */
  formatLog(log: LogLike): string {
    const ok = log.type === 'success';
    const icon = ok ? '✅' : '❌';

    // Amal turiga qarab ikonka — ro'yxatda ko'z bilan ajratish oson bo'lsin
    const action = log.action || 'Amal';
    let kind = '💬';
    if (/DM/i.test(action)) kind = '📨';
    else if (/obuna/i.test(action)) kind = '🔒';

    const lines: string[] = [`${icon} ${kind} <b>${escapeHtml(action)}</b>`];
    if (log.accountUsername) lines.push(`📸 akkaunt: @${escapeHtml(log.accountUsername)}`);

    if (log.user) lines.push(`👤 <b>@${escapeHtml(log.user)}</b>`);
    if (log.userMessage) lines.push(`💬 <i>${escapeHtml(this.cut(log.userMessage))}</i>`);

    if (log.message) {
      const body = escapeHtml(this.cut(log.message));
      lines.push(ok ? `↩️ ${body}` : `⚠️ <code>${body}</code>`);
    }

    const at = log.createdAt ? new Date(log.createdAt) : new Date();
    lines.push(`🕒 ${at.toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}`);

    return lines.join('\n');
  }

  /* ------------------------ /start tinglash ------------------------ */

  /**
   * Long polling — faqat buyruqlarni (/start, /stop, /id) ushlash uchun.
   * Instagram webhooklariga aloqasi yo'q.
   */
  private async pollLoop() {
    while (this.polling) {
      try {
        const updates = await callTelegram<any[]>(
          this.token,
          'getUpdates',
          { offset: this.offset, timeout: 30, allowed_updates: ['message'] },
          40_000,
        );
        for (const u of updates) {
          this.offset = u.update_id + 1;
          await this.handleUpdate(u).catch((e) =>
            this.logger.error(`Telegram update xatosi: ${e.message}`),
          );
        }
      } catch (e: any) {
        if (this.polling) {
          this.logger.warn(`Telegram polling xatosi: ${e.message}`);
          await new Promise((r) => setTimeout(r, 5_000));
        }
      }
    }
  }

  private async handleUpdate(u: any) {
    const msg = u.message;
    const text: string = msg?.text?.trim() || '';
    if (!msg?.chat?.id || !text.startsWith('/')) return;

    const chatId = String(msg.chat.id);
    const title =
      msg.chat.username || msg.chat.title ||
      [msg.chat.first_name, msg.chat.last_name].filter(Boolean).join(' ') || null;
    const cmd = text.split(/[\s@]/)[0].toLowerCase();

    if (cmd === '/id') {
      await this.sendMessage(chatId, `Chat ID: <code>${escapeHtml(chatId)}</code>`);
      return;
    }

    if (cmd === '/start') {
      // "/start KOD" — panel bergan havola orqali kelgan
      const code = text.split(/\s+/)[1]?.trim();
      if (code) {
        const userId = this.consumeLink(code);
        if (!userId) {
          await this.sendMessage(chatId, '⚠️ Havola eskirgan yoki allaqachon ishlatilgan. Panel → Sozlamalar → Telegram\'dan yangisini oling.');
          return;
        }
        await this.registerChat(chatId, title, userId);
        await this.sendMessage(chatId, this.welcomeText(), this.statsKeyboard());
        return;
      }

      // Kodsiz /start: oldin bog'langan bo'lsa — qayta yoqamiz, bo'lmasa yo'l ko'rsatamiz
      const existing = await this.repo.findOne({ where: { chatId } });
      if (existing?.userId) {
        await this.registerChat(chatId, title, existing.userId);
        await this.sendMessage(chatId, this.welcomeText(), this.statsKeyboard());
      } else {
        await this.sendMessage(
          chatId,
          [
            '👋 <b>ReplyGo</b>',
            '',
            'Loglarni olish uchun chatni akkauntingizga bog\'lang:',
            'panel → <b>Sozlamalar</b> → <b>Telegram\'ni ulash</b>.',
          ].join('\n'),
        );
      }
      return;
    }

    if (cmd === '/stop') {
      await this.deactivateChat(chatId);
      await this.sendMessage(chatId, '🔕 Loglar to\'xtatildi. Qayta yoqish: /start');
      return;
    }
  }

  private welcomeText() {
    return [
      '✅ <b>ReplyGo loglari ulandi</b>',
      '',
      'Endi har bir komment javobi va DM shu yerga tushadi:',
      '• kim yozgani va izoh matni',
      '• bot qanday javob bergani',
      '• muvaffaqiyatli ✅ yoki xato ❌',
      '',
      'To\'xtatish uchun /stop yuboring.',
    ].join('\n');
  }
}

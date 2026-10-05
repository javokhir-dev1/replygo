import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type IORedis from 'ioredis';
import { InstagramService, IgCredentials } from '../instagram/instagram.service';
import { IgRateLimitError } from '../instagram/ig-errors';
import { IgAccountsService } from '../ig-accounts/ig-accounts.service';
import type { IgAccount } from '../ig-accounts/entities/ig-account.entity';
import { AutomationsService } from '../automations/automations.service';
import { LogsService } from '../logs/logs.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { SettingsService } from '../settings/settings.service';
import { COMMENTS_QUEUE, MESSAGING_QUEUE, JOB_COMMENT, JOB_MESSAGING, IG_REDIS } from './queue.constants';

// Obuna-tekshirish matnlari uchun standart qiymatlar (entity default o'rniga)
const DEF_ASK_MSG = "Ma'lumotni olish uchun quyidagi tugmani bosing 👇";
const DEF_ASK_BTN = "Ma'lumotni olish";
const DEF_FAIL_MSG =
  "Siz hali obuna bo'lmagansiz. Iltimos, avval sahifamizga obuna bo'ling, keyin tugmani bosing.";
const DEF_FAIL_BTN = "Obuna bo'ldim ✅";

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly instagram: InstagramService,
    private readonly accounts: IgAccountsService,
    private readonly automations: AutomationsService,
    private readonly logs: LogsService,
    private readonly rateLimit: RateLimitService,
    private readonly settings: SettingsService,
    @InjectQueue(COMMENTS_QUEUE) private readonly commentsQueue: Queue,
    @InjectQueue(MESSAGING_QUEUE) private readonly messagingQueue: Queue,
    @Inject(IG_REDIS) private readonly redis: IORedis,
  ) {}

  /**
   * Idempotentlik: bitta amalni (masalan bir kommentga javob) faqat BIR marta bajaradi.
   *
   * fn() `true` qaytarsa — amal BAJARILDI, marker qo'yiladi va qayta urinilmaydi.
   * fn() `false` qaytarsa — amal muvaffaqiyatsiz, marker QO'YILMAYDI, ya'ni
   * keyingi urinishda qayta bajariladi.
   * fn() throw qilsa (429) — marker qo'yilmaydi, navbat pauza qilib retry qiladi.
   *
   * DIQQAT: ilgari marker fn() natijasidan qat'i nazar qo'yilardi. Natijada bitta
   * o'tkinchi xato (masalan yopiq DM oynasi) o'sha kommentga javob berishni
   * 7 kunga butunlay bloklab qo'yardi.
   */
  private async runOnce(key: string, ttlSec: number, fn: () => Promise<boolean>): Promise<boolean> {
    try {
      if (await this.redis.exists(key)) {
        this.logger.log(`⏭  Idempotentlik: '${key}' allaqachon bajarilgan, o'tkazib yuborildi`);
        return false;
      }
    } catch (e: any) {
      // Redis o'qishda xato bo'lsa ham amalni bajaramiz (faqat log)
      this.logger.warn(`Idempotency o'qishda xato: ${e.message}`);
    }

    const ok = await fn(); // 429 bo'lsa bu yerdan throw bo'ladi (marker qo'yilmaydi)
    if (!ok) return false; // muvaffaqiyatsiz — keyinroq qayta urinish mumkin

    try {
      await this.redis.set(key, '1', 'EX', ttlSec);
    } catch {
      /* marker yozilmasa ham kritik emas */
    }
    return true;
  }

  private get jobOpts() {
    return {
      attempts: +(this.config.get('QUEUE_ATTEMPTS') ?? 3),
      backoff: { type: 'exponential' as const, delay: 5_000 },
      // Bajarilgan/xato joblarni cheklangan miqdorda saqlaymiz (dedup oynasi + tozalik)
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    };
  }

  private pickRandom(templates: string[]): string | null {
    const valid = (templates || []).filter((t) => t?.trim());
    if (!valid.length) return null;
    return valid[Math.floor(Math.random() * valid.length)];
  }

  /**
   * BullMQ jobId ichida ':' belgisiga RUXSAT BERMAYDI — u Redis kalitlarida
   * ajratuvchi sifatida band ("Custom Ids cannot contain :").
   * Payload'lar (masalan `FOLLOWCHECK:12`) va Meta ID'lari ichida ':' uchrashi
   * mumkin, shuning uchun jobId'ni har doim shu funksiya orqali o'tkazamiz.
   */
  private safeJobId(...parts: (string | number | undefined | null)[]): string {
    return parts
      .map((p) => String(p ?? ''))
      .join('-')
      .replace(/:/g, '-');
  }

  /**
   * Webhook entry'sini NAVBATGA qo'shadi (to'g'ridan-to'g'ri ishlamaydi).
   * Shu bilan: rate limit, retry, concurrency nazorati va restart'ga chidamlilik ta'minlanadi.
   */
  async enqueueEntry(entry: any) {
    // Ko'p foydalanuvchili rejim: entry.id — hodisa kelgan Instagram akkaunt.
    // Faqat ReplyGo'ga ulangan akkauntlar ishlanadi.
    const acc = entry.id ? await this.accounts.byIgUserId(String(entry.id)) : null;
    if (!acc) {
      this.logger.warn(`Webhook: ulanmagan akkaunt (${entry.id ?? '?'}), e'tiborsiz`);
      return;
    }
    // Job'da faqat akkaunt ID'si — token ishlov paytida bazadan olinadi
    // (navbatda turgan paytda token yangilanishi mumkin)
    const igUserId = acc.igUserId;

    // Kommentlar (changes)
    if (Array.isArray(entry.changes)) {
      for (const change of entry.changes) {
        if (change.field === 'comments' && change.value?.id) {
          // Kommentlar navbatiga (sekin/xavfsiz worker).
          // jobId = comment id → Meta qayta yuborsa dublikat job yaratilmaydi.
          await this.commentsQueue.add(JOB_COMMENT, { igUserId, data: change.value }, {
            ...this.jobOpts,
            jobId: this.safeJobId('comment', change.value.id),
          });
        } else {
          this.logger.log(`Webhook: '${change.field}' field (ishlanmaydi), e'tiborsiz`);
        }
      }
    }

    // Xabarlar / tugma bosishlari (messaging) — obunani tekshirish oqimi uchun
    if (Array.isArray(entry.messaging)) {
      for (const msg of entry.messaging) {
        const mid = msg.message?.mid;
        const dedup = mid
          ? this.safeJobId('msg', mid)
          : this.safeJobId(
              'msg',
              msg.sender?.id,
              msg.timestamp,
              msg.postback?.payload || msg.message?.quick_reply?.payload || '',
            );
        // DM navbatiga (tez/mustaqil worker) — komment yuklamasidan ta'sirlanmaydi.
        await this.messagingQueue.add(JOB_MESSAGING, { igUserId, data: msg }, {
          ...this.jobOpts,
          jobId: dedup,
        });
      }
    }

    if (!Array.isArray(entry.changes) && !Array.isArray(entry.messaging)) {
      this.logger.warn(`Webhook: changes/messaging yo'q. Entry: ${JSON.stringify(entry)}`);
    }
  }


  /** Job → akkaunt. Akkaunt uzilgan bo'lsa null (job jim tugaydi) */
  private async resolve(job: any): Promise<{ acc: IgAccount; data: any } | null> {
    if (!job?.igUserId) {
      this.logger.warn('Eski formatdagi job (akkauntsiz) — e\'tiborsiz');
      return null;
    }
    const acc = await this.accounts.byIgUserId(String(job.igUserId));
    if (!acc) {
      this.logger.warn(`Akkaunt ${job.igUserId} uzilgan — job e'tiborsiz`);
      return null;
    }
    return { acc, data: job.data };
  }

  /**
   * Yuklamaga qarab sekinlashish (DM oldidan).
   *
   * Odatdagi holatda (daqiqasiga bir nechta komment) navbat bo'sh turadi va
   * javob DARHOL ketadi. So'rovlar ko'payib navbatda kutayotganlar soni
   * DM_BUSY_THRESHOLD dan oshsa — har DM oldidan 5–10 s kutamiz.
   *
   * Ya'ni sekinlashuv faqat kerak bo'lganda yoqiladi: kam yuklamada tezlik
   * yo'qotmaymiz, ko'p yuklamada Instagram limitiga urilmaymiz.
   */
  private async adaptiveDmDelay(userId: number): Promise<boolean> {
    const { dmMinDelayMs: minMs, dmMaxDelayMs: maxMs, dmBusyThreshold: threshold } = await this.settings.get(userId);
    if (maxMs <= 0) return false;

    let waiting = 0;
    try {
      waiting = await this.commentsQueue.getWaitingCount();
    } catch {
      return false; // Redis o'qilmasa sekinlashtirmaymiz
    }
    if (waiting < threshold) return false;

    this.logger.log(`🐢 Navbatda ${waiting} ta kutyapti — DM oldidan ${minMs}-${maxMs}ms kutiladi`);
    await this.rateLimit.randomDelay(Math.max(0, minMs), maxMs);
    return true;
  }

  /**
   * Tugmani ketma-ket bosaverishdan himoya.
   *
   * Bitta foydalanuvchi oynada DM_BUTTON_MAX_PRESSES dan ko'p bosса, uning
   * so'rovlari to'xtatiladi va bir marta ogohlantirish yuboriladi. Oyna
   * tugagach (DM_BUTTON_WINDOW_SEC) hisob nolga tushadi va yana ishlaydi.
   */
  private async buttonThrottle(
    userId: number,
    igUserId: string,
    senderId: string,
  ): Promise<{ blocked: boolean; windowSec: number }> {
    const { dmButtonMaxPresses: max, dmButtonWindowSec: windowSec } = await this.settings.get(userId);
    if (max <= 0) return { blocked: false, windowSec };

    try {
      const count = await this.redis.incr(`btn:${igUserId}:${senderId}`);
      if (count === 1) await this.redis.expire(`btn:${igUserId}:${senderId}`, windowSec);
      return { blocked: count > max, windowSec };
    } catch (e: any) {
      this.logger.warn(`Tugma hisobini o'qib bo'lmadi: ${e.message}`);
      return { blocked: false, windowSec };
    }
  }

  /** Quick reply / postback tugma bosilganda — obunani tekshirish (processor chaqiradi) */
  async handleMessaging(job: any) {
    const r = await this.resolve(job);
    if (!r) return;
    const msg = r.data;
    const userId = r.acc.userId;
    const creds: IgCredentials = this.accounts.creds(r.acc);
    const botAccountId = r.acc.igUserId;
    const senderId: string = msg.sender?.id;

    // O'zimiz yuborgan (echo) yoki botning o'z xabarlarini e'tiborsiz qoldiramiz
    if (msg.message?.is_echo) return;
    if (senderId && senderId === botAccountId) return;

    const payload: string | undefined =
      msg.message?.quick_reply?.payload || msg.postback?.payload;

    // Faqat obuna-tekshirish payloadlari bilan ishlaymiz; oddiy DMlarga tegmaymiz
    if (!payload || !payload.startsWith('FOLLOWCHECK:') || !senderId) return;

    const autoId = Number(payload.split(':')[1]);
    if (!autoId) return;

    // Ketma-ket bosaverishdan himoya — Instagram limitiga ham, foydalanuvchiga
    // ham foydasi yo'q. Ogohlantirish oyna davomida faqat BIR marta ketadi.
    const throttle = await this.buttonThrottle(userId, botAccountId, senderId);
    if (throttle.blocked) {
      const mins = Math.max(1, Math.round(throttle.windowSec / 60));
      this.logger.warn(`⏳ ${senderId} tugmani juda ko'p bosdi — so'rov to'xtatildi`);
      await this.runOnce(`btnwarn:${botAccountId}:${senderId}`, throttle.windowSec, async () => {
        try {
          await this.instagram.sendDM(
            creds,
            senderId,
            `⏳ Juda ko'p so'rov yuborildi. Iltimos, ${mins} daqiqadan so'ng qayta urinib ko'ring.`,
          );
          return true;
        } catch (err: any) {
          if (err instanceof IgRateLimitError) throw err;
          return false;
        }
      });
      return;
    }

    let auto: any;
    try {
      // Faqat shu akkaunt egasining qoidasi — begona payload boshqa qoidani ishga tushirmasin
      auto = await this.automations.findOne(autoId, userId);
    } catch {
      this.logger.warn(`Obuna tekshiruvi: avtomatizatsiya #${autoId} topilmadi`);
      return;
    }
    // Payload boshqa akkaunt qoidasiga ishora qilsa (soxta/eski tugma) — e'tiborsiz
    if (!auto || !auto.isActive || !auto.followCheckEnabled || auto.igAccountId !== r.acc.id) return;

    // Profil + obuna holati (foydalanuvchi endi bizga xabar yozgani uchun mavjud)
    let profile: { username?: string; is_user_follow_business?: boolean };
    try {
      profile = await this.instagram.getUserProfile(creds, senderId);
    } catch (err: any) {
      if (err instanceof IgRateLimitError) throw err; // navbatni pauza qilib retry
      const igErr = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      this.logger.error(`[Obuna tekshiruvi xato] ${igErr}`);
      return;
    }

    const name = profile.username || 'foydalanuvchi';

    if (profile.is_user_follow_business === true) {
      // Obuna tasdiqlandi → asosiy DM yuboramiz (bir marta)
      await this.runOnce(`main:${senderId}:${auto.id}`, 24 * 3600, async () => {
        const sent = await this.sendMainDm(userId, { igAccountId: r.acc.id, accountUsername: r.acc.username, automationId: auto.id }, creds, senderId, auto, name, '');
        if (sent) this.logger.log(`✅ Obuna tasdiqlandi, asosiy DM yuborildi @${name}`);
        return sent;
      });
    } else {
      // Obuna emas → qayta so'rov + "Obuna bo'ldim" tugmasi.
      // Qisqa TTL: retry dublikatini oldini oladi, lekin keyinroq qayta so'rashga ruxsat beradi.
      await this.runOnce(`fail:${senderId}:${auto.id}`, 120, async () => {
        try {
          await this.instagram.sendPostbackButtons(creds, senderId, auto.followFailMessage || DEF_FAIL_MSG, [
            { title: auto.followFailButton || DEF_FAIL_BTN, payload: `FOLLOWCHECK:${auto.id}` },
          ]);
          this.logger.log(`⛔ @${name} hali obuna emas — qayta so'rov yuborildi`);
          return true;
        } catch (err: any) {
          if (err instanceof IgRateLimitError) throw err;
          const igErr = err.response?.data ? JSON.stringify(err.response.data) : err.message;
          this.logger.error(`[Obuna qayta so'rov xato] ${igErr}`);
          return false;
        }
      });
    }
  }

  /**
   * Asosiy DM (shablon + URL tugmalar) yuborish.
   * Bu yerda recipient.id TO'G'RI: bu funksiya faqat foydalanuvchi tugmani
   * bosgandan keyin chaqiriladi, ya'ni u bizga xabar yozgan va 24 soatlik
   * oyna ochiq.
   */
  private async sendMainDm(
    userId: number,
    logCtx: { igAccountId: number; accountUsername: string | null; automationId: number },
    creds: IgCredentials,
    recipientId: string,
    auto: any,
    name: string,
    commentText: string,
  ): Promise<boolean> {
    const tmpl = this.pickRandom(auto.dmTemplates);
    if (!tmpl) {
      this.logger.warn(
        `⚠️  Avtomatizatsiya #${auto.id} ("${auto.name}") da DM yoqilgan, lekin DM shabloni bo'sh — yuborilmadi`,
      );
      return false;
    }
    const dmText = tmpl.replace('{name}', name).replace('{comment}', commentText);
    try {
      const validButtons = (auto.dmButtons || []).filter(
        (b: any) => b.title?.trim() && b.url?.trim(),
      );
      if (validButtons.length) {
        await this.instagram.sendDMButtons(creds, recipientId, dmText, validButtons);
      } else {
        await this.instagram.sendDM(creds, recipientId, dmText);
      }
      await this.logs.create({
        userId,
        ...logCtx,
        type: 'success',
        action: 'Asosiy DM (obunadan keyin)',
        message: dmText.substring(0, 100),
        user: name,
      });
      return true;
    } catch (err: any) {
      if (err instanceof IgRateLimitError) throw err; // navbatni pauza qilib retry
      const igError = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      this.logger.error(`[Asosiy DM xato] ${igError}`);
      await this.logs.create({
        userId,
        ...logCtx,
        type: 'error',
        action: 'Asosiy DM (obunadan keyin)',
        message: igError.substring(0, 300),
        user: name,
      });
      return false;
    }
  }

  async handleComment(job: any) {
    const r = await this.resolve(job);
    if (!r) return;
    const commentData = r.data;
    const userId = r.acc.userId;
    const creds: IgCredentials = this.accounts.creds(r.acc);
    const botAccountId = r.acc.igUserId;

    const commentId: string = commentData.id;
    const commentText: string = commentData.text ?? '';
    const commenterId: string = commentData.from?.id;
    const commenterName: string = commentData.from?.username || 'foydalanuvchi';
    const mediaId: string = commentData.media?.id;

    // O'z izohimizga javob bermaymiz
    if (commenterId && commenterId === botAccountId) return;

    this.logger.log(`Yangi komment @${commenterName}: "${commentText}"`);

    // Faqat komment kelgan akkauntning qoidalari (foydalanuvchida bir nechta bo'lishi mumkin)
    const activeAutomations = await this.automations.findActiveForAccount(r.acc.id);
    if (!activeAutomations.length) return;

    // Tizim sozlamalari (baza, system_settings). perUserLimit 0 = cheksiz
    const {
      perUserLimit,
      commentMinDelayMs: minDelay,
      commentMaxDelayMs: maxDelay,
    } = await this.settings.get(userId);

    for (const auto of activeAutomations) {
      // Dashboard uchun: har log qaysi akkaunt/qoida/post/kommentga tegishli
      const logCtx = {
        igAccountId: r.acc.id,
        accountUsername: r.acc.username,
        automationId: auto.id,
        mediaId: mediaId ?? null,
        commentId: commentId ?? null,
      };

      // Post ko'lami
      if (auto.postScope === 'specific') {
        if (!mediaId || !auto.postIds.includes(mediaId)) continue;
      }

      // Kalit so'z tekshiruvi
      let keywordMatched = true;
      if (auto.triggerType === 'keyword') {
        const validKw = (auto.keywords || []).filter((k) => k?.trim());
        if (validKw.length > 0) {
          const lower = commentText.toLowerCase();
          keywordMatched = validKw.some((kw) => lower.includes(kw.toLowerCase()));
        }
      }
      if (!keywordMatched) continue;

      // Foydalanuvchi limiti (perUserLimit <= 0 bo'lsa tekshirilmaydi)
      if (perUserLimit > 0 && mediaId && commenterId) {
        const limitCheck = await this.rateLimit.canReply(commenterId, perUserLimit, mediaId);
        if (!limitCheck.allowed) {
          this.logger.log(`Limit: @${commenterName} — ${limitCheck.reason}`);
          continue;
        }
      }

      // Inson kabi ko'rinishi uchun tasodifiy kechikish (0 bo'lsa — darhol)
      if (maxDelay > 0) {
        await this.rateLimit.randomDelay(Math.max(0, minDelay), maxDelay);
      }

      let repliedOrDmed = false;

      // --- Izohga ochiq javob ---
      if (auto.replyEnabled) {
        const tmpl = this.pickRandom(auto.replyTemplates);
        if (!tmpl) {
          this.logger.warn(
            `⚠️  #${auto.id} ("${auto.name}"): komment javobi yoqilgan, lekin shablon bo'sh`,
          );
        } else {
          const reply = tmpl.replace('{name}', commenterName).replace('{comment}', commentText);
          const sent = await this.runOnce(`reply:${commentId}:${auto.id}`, 7 * 24 * 3600, async () => {
            try {
              await this.instagram.replyToComment(creds, commentId, reply);
              this.logger.log(`✅ Komment javob @${commenterName}: "${reply.substring(0, 60)}"`);
              await this.logs.create({
                userId,
                ...logCtx,
                type: 'success',
                action: 'Komment Javob',
                message: reply.substring(0, 100),
                user: commenterName,
                userMessage: commentText?.substring(0, 200),
              });
              return true;
            } catch (err: any) {
              if (err instanceof IgRateLimitError) throw err; // navbatni pauza qilib retry
              const igErr = err.response?.data ? JSON.stringify(err.response.data) : err.message;
              this.logger.error(`[Komment javob xato] ${igErr}`);
              await this.logs.create({
                userId,
                ...logCtx,
                type: 'error',
                action: 'Komment Javob',
                message: igErr.substring(0, 300),
                user: commenterName,
              });
              return false;
            }
          });
          if (sent) repliedOrDmed = true;
        }
      }

      // --- DM ---
      if (auto.dmEnabled && !commenterId) {
        this.logger.warn(
          `⚠️  #${auto.id}: DM yoqilgan, lekin webhook'da from.id yo'q — DM yuborib bo'lmaydi`,
        );
      }
      if (!auto.dmEnabled) {
        this.logger.log(`ℹ️  #${auto.id} ("${auto.name}"): DM o'chirilgan (dmEnabled=false)`);
      }
      if (auto.dmEnabled && commenterId) {
        // Yuklama yuqori bo'lsa shu yerda sekinlashamiz (kam yuklamada — darhol)
        await this.adaptiveDmDelay(userId);

        if (auto.followCheckEnabled) {
          // Obunani tekshirish yoqilgan: asosiy DM o'rniga avval obuna so'rovi yuboramiz.
          // Foydalanuvchi tugmani bosgach (messaging webhook) obuna tekshiriladi.
          const askMsg = auto.followAskMessage || DEF_ASK_MSG;
          const askBtn = auto.followAskButton || DEF_ASK_BTN;
          this.logger.log(`🔒 #${auto.id}: obuna tekshiruvi yoqilgan — avval so'rov yuboriladi`);
          const sent = await this.runOnce(`ask:${commentId}:${auto.id}`, 7 * 24 * 3600, async () => {
            try {
              // Birinchi kontakt: kommentga private reply, tugma xabarga qo'shilib chiqadi
              await this.instagram.sendCommentButtons(creds, commentId, askMsg, [
                { title: askBtn, payload: `FOLLOWCHECK:${auto.id}` },
              ]);
              this.logger.log(`📨 Obuna so'rovi yuborildi @${commenterName}`);
              await this.logs.create({
                userId,
                ...logCtx,
                type: 'success',
                action: 'Obuna so\'rovi',
                message: askMsg.substring(0, 100),
                user: commenterName,
                userMessage: commentText?.substring(0, 200),
              });
              return true;
            } catch (err: any) {
              if (err instanceof IgRateLimitError) throw err;
              const igError = err.response?.data ? JSON.stringify(err.response.data) : err.message;
              this.logger.error(`[Obuna so'rovi xato] ${igError}`);
              await this.logs.create({
                userId,
                ...logCtx,
                type: 'error',
                action: 'Obuna so\'rovi',
                message: igError.substring(0, 300),
                user: commenterName,
              });
              return false;
            }
          });
          if (sent) repliedOrDmed = true;
        } else {
          // Oddiy DM (obunani tekshirishsiz)
          const tmpl = this.pickRandom(auto.dmTemplates);
          if (!tmpl) {
            this.logger.warn(
              `⚠️  #${auto.id} ("${auto.name}"): DM yoqilgan, lekin DM shabloni bo'sh — yuborilmadi`,
            );
          } else {
            const dmText = tmpl.replace('{name}', commenterName).replace('{comment}', commentText);
            const sent = await this.runOnce(`dm:${commentId}:${auto.id}`, 7 * 24 * 3600, async () => {
              try {
                const validButtons = (auto.dmButtons || []).filter(
                  (b) => b.title?.trim() && b.url?.trim(),
                );
                // PRIVATE REPLY (recipient.comment_id) — kommentga javoban.
                // Oddiy DM (recipient.id) bu yerda ISHLAMAYDI: u 24 soatlik
                // xabar oynasi ochiq bo'lishini talab qiladi, komment yozgan
                // odamda esa odatda u yopiq (code 10 / subcode 2534022).
                // Private reply 7 kun ichida, komment boshiga bir marta ishlaydi.
                if (validButtons.length) {
                  await this.instagram.sendPrivateReplyButtons(
                    creds,
                    commentId,
                    dmText,
                    validButtons,
                  );
                } else {
                  await this.instagram.sendPrivateReply(creds, commentId, dmText);
                }
                this.logger.log(`✅ DM @${commenterName}: "${dmText.substring(0, 60)}"`);
                await this.logs.create({
                  userId,
                  ...logCtx,
                  type: 'success',
                  action: 'Kommentdan DM',
                  message: dmText.substring(0, 100),
                  user: commenterName,
                  userMessage: commentText?.substring(0, 200),
                });
                return true;
              } catch (err: any) {
                if (err instanceof IgRateLimitError) throw err;
                const igError = err.response?.data ? JSON.stringify(err.response.data) : err.message;
                this.logger.error(`[Kommentdan DM xato] ${igError}`);
                await this.logs.create({
                  userId,
                  ...logCtx,
                  type: 'error',
                  action: 'Kommentdan DM',
                  message: igError.substring(0, 300),
                  user: commenterName,
                });
                return false;
              }
            });
            if (sent) repliedOrDmed = true;
          }
        }
      }

      if (repliedOrDmed && commenterId) {
        await this.rateLimit.recordReply(commenterId, 24, mediaId);
        break; // bitta izohga faqat bitta avtomatizatsiya javob beradi
      }
    }
  }
}

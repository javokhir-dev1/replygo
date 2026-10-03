import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { TelegramService } from './telegram.service';
import { TelegramRateLimitError, TelegramChatGoneError } from './telegram.api';
import { TELEGRAM_QUEUE } from './telegram.constants';

/**
 * Telegram xabarlari worker'i.
 *
 * Telegram cheklovlari Instagram'nikidan boshqacha:
 *   - bitta chatga ~1 xabar/soniya
 *   - guruhga ~20 xabar/daqiqa
 *   - umumiy ~30 xabar/soniya
 * Shuning uchun standart: 20 xabar / 60 soniya, concurrency 1 (ketma-ket).
 * Ko'p log kelsa navbat o'zi ushlab turadi va asta-sekin yuboradi — bu
 * foydalanuvchi so'ragan "juda ko'p bo'lsa navbat bilan borsin" xulqi.
 *
 * Xabarlar navbatda kutadi, YO'QOLMAYDI: Redis'da saqlanadi, dastur
 * qayta ishga tushsa ham qolgani yuboriladi.
 */
@Processor(TELEGRAM_QUEUE, {
  concurrency: Number(process.env.TELEGRAM_CONCURRENCY ?? 1),
  limiter: {
    max: Number(process.env.TELEGRAM_RATE_MAX ?? 20),
    duration: Number(process.env.TELEGRAM_RATE_DURATION_MS ?? 60_000),
  },
})
export class TelegramProcessor extends WorkerHost {
  private readonly logger = new Logger(TelegramProcessor.name);

  constructor(private readonly telegram: TelegramService) {
    super();
  }

  async process(job: Job<{ chatId: string; text: string }>): Promise<void> {
    const { chatId, text } = job.data;
    try {
      await this.telegram.sendMessage(chatId, text);
    } catch (err) {
      // 429 — butun navbatni pauza qilamiz va jobni FAILED hisoblamaymiz
      if (err instanceof TelegramRateLimitError) {
        this.logger.warn(`Telegram 429 — navbat ${err.retryAfterMs}ms pauza`);
        await this.worker.rateLimit(err.retryAfterMs);
        throw Worker.RateLimitError();
      }

      // Bot bloklangan / chat o'chirilgan — qayta urinishning ma'nosi yo'q,
      // chatni ro'yxatdan chiqaramiz va jobni muvaffaqiyatli deb yopamiz.
      if (err instanceof TelegramChatGoneError) {
        this.logger.warn(`${err.message} — chat ro'yxatdan chiqarildi`);
        await this.telegram.deactivateChat(chatId);
        return;
      }

      throw err;
    }
  }
}

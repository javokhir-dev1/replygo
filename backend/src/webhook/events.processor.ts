import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { WebhookService } from './webhook.service';
import { IgRateLimitError } from '../instagram/ig-errors';
import { throttleRemainingMs } from '../instagram/ig-throttle';
import { COMMENTS_QUEUE, MESSAGING_QUEUE } from './queue.constants';

/**
 * Rate-limit himoyasi:
 *  1) PROAKTIV — header'lardagi ish foizi yuqori bo'lsa (throttle darvozasi yoqilgan),
 *     job'ni ishlatmasdan navbatni sekinlashtiramiz.
 *  2) REAKTIV — Instagram 429/kod qaytarsa, estimated_time_to_regain_access davomida
 *     butun navbatni pauza qilamiz va job'ni FAILED hisoblamasdan qayta qo'yamiz.
 * Ikkalasi ham "limitga urilganda so'rov yuborishni to'xtating" tavsiyasini bajaradi.
 */
async function processWithRateLimit(
  worker: Worker,
  fn: () => Promise<void>,
): Promise<void> {
  // 1) Proaktiv sekinlashish
  const wait = throttleRemainingMs();
  if (wait > 0) {
    await worker.rateLimit(wait);
    throw Worker.RateLimitError();
  }

  // 2) Reaktiv (429)
  try {
    await fn();
  } catch (err) {
    if (err instanceof IgRateLimitError) {
      await worker.rateLimit(err.retryAfterMs);
      throw Worker.RateLimitError();
    }
    throw err;
  }
}

/**
 * KOMMENTLAR worker'i — sekin va xavfsiz.
 * concurrency default 1 (ketma-ket) + rate limit → Instagram spam himoyasi.
 */
@Processor(COMMENTS_QUEUE, {
  concurrency: Number(process.env.QUEUE_COMMENT_CONCURRENCY ?? 1),
  limiter: {
    max: Number(process.env.QUEUE_COMMENT_RATE_MAX ?? 20),
    duration: Number(process.env.QUEUE_COMMENT_RATE_DURATION_MS ?? 60_000),
  },
})
export class CommentsProcessor extends WorkerHost {
  private readonly logger = new Logger(CommentsProcessor.name);

  constructor(private readonly webhook: WebhookService) {
    super();
  }

  async process(job: Job): Promise<void> {
    await processWithRateLimit(this.worker, () => this.webhook.handleComment(job.data));
  }
}

/**
 * DM (tugma-bosish) worker'i — tez va mustaqil.
 * Alohida navbat bo'lgani uchun komment yuklamasidan umuman ta'sirlanmaydi.
 */
@Processor(MESSAGING_QUEUE, {
  concurrency: Number(process.env.QUEUE_MESSAGING_CONCURRENCY ?? 5),
  limiter: {
    max: Number(process.env.QUEUE_MESSAGING_RATE_MAX ?? 30),
    duration: Number(process.env.QUEUE_MESSAGING_RATE_DURATION_MS ?? 60_000),
  },
})
export class MessagingProcessor extends WorkerHost {
  private readonly logger = new Logger(MessagingProcessor.name);

  constructor(private readonly webhook: WebhookService) {
    super();
  }

  async process(job: Job): Promise<void> {
    await processWithRateLimit(this.worker, () => this.webhook.handleMessaging(job.data));
  }
}

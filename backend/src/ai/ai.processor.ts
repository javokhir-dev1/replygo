import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AiService } from './ai.service';
import { AI_QUEUE } from './ai.constants';

/**
 * Bir vaqtda bitta tahlil: Whisper protsessorni, Claude esa obuna limitini band qiladi.
 * Uzoq ishlar (5–20 daqiqa) — BullMQ lock'i fon jarayonlarida avtomatik yangilanadi.
 */
@Processor(AI_QUEUE, { concurrency: 1, lockDuration: 60_000 })
export class AiProcessor extends WorkerHost {
  constructor(private readonly ai: AiService) {
    super();
  }

  async process(job: Job<{ id: number }>): Promise<void> {
    await this.ai.process(job.data.id);
  }
}

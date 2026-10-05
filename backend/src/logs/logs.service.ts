import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Log } from './entities/log.entity';
import { TelegramService } from '../telegram/telegram.service';

export interface CreateLogInput {
  userId: number;
  igAccountId?: number | null;
  automationId?: number | null;
  mediaId?: string | null;
  commentId?: string | null;
  /** Bazaga yozilmaydi — faqat Telegram xabarida qaysi akkaunt ekanini ko'rsatish uchun */
  accountUsername?: string | null;
  type: string;
  action: string;
  message?: string;
  user?: string;
  userMessage?: string;
}

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(
    @InjectRepository(Log)
    private repo: Repository<Log>,
    private readonly telegram: TelegramService,
  ) {}

  /**
   * Log yozadi va uni Telegram'ga ham uzatadi.
   *
   * Telegram NAVBAT orqali ketadi (bu yerda hech narsa kutilmaydi), shuning
   * uchun Telegram sekin yoki o'chiq bo'lsa ham Instagram javoblari
   * sekinlashmaydi. Navbatga qo'shishda xato bo'lsa ham log baribir
   * bazada qoladi — bildirishnoma logdan muhimroq emas.
   */
  async create(input: CreateLogInput) {
    const { accountUsername, ...data } = input;
    const log = await this.repo.save(this.repo.create(data));

    try {
      await this.telegram.notifyLog({ ...log, accountUsername });
    } catch (e: any) {
      this.logger.warn(`Telegram bildirishnomasi navbatga qo'shilmadi: ${e.message}`);
    }

    return log;
  }

  findAll(userId: number, limit = 100) {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: Math.min(limit, 500) });
  }

  /** Faqat o'z loglarini o'chiradi (ilgari TRUNCATE edi — hammasini) */
  clear(userId: number) {
    return this.repo.delete({ userId });
  }
}

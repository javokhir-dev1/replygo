import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { TelegramChat } from './entities/telegram-chat.entity';
import { Log } from '../logs/entities/log.entity';
import { Automation } from '../automations/entities/automation.entity';
import { TelegramController } from './telegram.controller';
import { TelegramStatsService } from './telegram-stats.service';
import { TelegramService } from './telegram.service';
import { TelegramProcessor } from './telegram.processor';
import { TELEGRAM_QUEUE } from './telegram.constants';

/**
 * Global: LogsService har qanday moduldan chaqirilganda Telegram'ga
 * yubora olishi uchun (aylanma bog'liqlik yaratmasdan).
 */
@Global()
@Module({
  imports: [
    // Log/Automation faqat O'QISH uchun (statistika) — LogsModule'ga
    // bog'lanmaymiz, aylanma bog'liqlik bo'lmasin.
    TypeOrmModule.forFeature([TelegramChat, Log, Automation]),
    BullModule.registerQueue({ name: TELEGRAM_QUEUE }),
  ],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramProcessor, TelegramStatsService],
  exports: [TelegramService],
})
export class TelegramModule {}

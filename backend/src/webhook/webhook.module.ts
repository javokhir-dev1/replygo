import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import IORedis from 'ioredis';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { CommentsProcessor, MessagingProcessor } from './events.processor';
import { COMMENTS_QUEUE, MESSAGING_QUEUE, IG_REDIS } from './queue.constants';
import { InstagramModule } from '../instagram/instagram.module';
import { AutomationsModule } from '../automations/automations.module';
import { LogsModule } from '../logs/logs.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';

@Module({
  imports: [
    InstagramModule,
    AutomationsModule,
    LogsModule,
    RateLimitModule,
    BullModule.registerQueue({ name: COMMENTS_QUEUE }, { name: MESSAGING_QUEUE }),
  ],
  controllers: [WebhookController],
  providers: [
    WebhookService,
    CommentsProcessor,
    MessagingProcessor,
    {
      // Idempotentlik markerlari uchun alohida Redis klienti
      provide: IG_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new IORedis(config.get<string>('REDIS_URL') || 'redis://localhost:6379', {
          maxRetriesPerRequest: null,
        }),
    },
  ],
})
export class WebhookModule {}

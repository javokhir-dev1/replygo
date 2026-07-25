import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import IORedis from 'ioredis';

import { AuthModule } from './auth/auth.module';
import { InstagramModule } from './instagram/instagram.module';
import { AutomationsModule } from './automations/automations.module';
import { LogsModule } from './logs/logs.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: true, // bitta userli kichik loyiha uchun qulay; productionda migration afzal
      }),
    }),
    // BullMQ (Redis) — webhook eventlarini navbat orqali ishlash uchun
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // BullMQ worker uchun maxRetriesPerRequest: null shart
        connection: new IORedis(
          config.get<string>('REDIS_URL') || 'redis://localhost:6379',
          { maxRetriesPerRequest: null },
        ),
      }),
    }),
    // Auth global guard'ni ham ro'yxatdan o'tkazadi — qolgan modullardan oldin turadi
    AuthModule,
    InstagramModule,
    AutomationsModule,
    LogsModule,
    RateLimitModule,
    WebhookModule,
  ],
})
export class AppModule {}

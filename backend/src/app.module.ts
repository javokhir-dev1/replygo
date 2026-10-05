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
import { TelegramModule } from './telegram/telegram.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';
import { IgAccountsModule } from './ig-accounts/ig-accounts.module';
import { LegacyMigrationService } from './bootstrap/legacy-migration.service';
import { DashboardModule } from './dashboard/dashboard.module';
import { AiModule } from './ai/ai.module';

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
    // Foydalanuvchilar (global) — Auth undan foydalanadi
    UsersModule,
    // Auth global guard'ni ham ro'yxatdan o'tkazadi — qolgan modullardan oldin turadi
    AuthModule,
    // Global: har foydalanuvchining Instagram ulanishi, OAuth, token yangilash
    IgAccountsModule,
    // Global: paneldan o'zgartiriladigan ish sozlamalari (baza → .env → standart)
    SettingsModule,
    // Global: loglarni Telegram'ga uzatadi (LogsService shunga tayanadi)
    TelegramModule,
    InstagramModule,
    AutomationsModule,
    LogsModule,
    RateLimitModule,
    WebhookModule,
    DashboardModule,
    // Lokal Claude CLI bilan post/profil tahlili
    AiModule,
  ],
  // Bitta-adminli versiyadan ko'chirish (idempotent)
  providers: [LegacyMigrationService],
})
export class AppModule {}

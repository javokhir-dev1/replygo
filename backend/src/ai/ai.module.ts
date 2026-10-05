import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AiAnalysis } from './entities/ai-analysis.entity';
import { AiService } from './ai.service';
import { AiProcessor } from './ai.processor';
import { AiController } from './ai.controller';
import { AI_QUEUE } from './ai.constants';
import { InstagramModule } from '../instagram/instagram.module';

/** Lokal Claude CLI orqali post va profil tahlili (faqat AI_ALLOWED_USERS uchun) */
@Module({
  imports: [TypeOrmModule.forFeature([AiAnalysis]), BullModule.registerQueue({ name: AI_QUEUE }), InstagramModule],
  controllers: [AiController],
  providers: [AiService, AiProcessor],
})
export class AiModule {}

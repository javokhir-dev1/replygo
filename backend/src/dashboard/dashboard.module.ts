import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Log } from '../logs/entities/log.entity';
import { Automation } from '../automations/entities/automation.entity';
import { IgAccountSnapshot } from '../ig-accounts/entities/ig-account-snapshot.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Log, Automation, IgAccountSnapshot])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

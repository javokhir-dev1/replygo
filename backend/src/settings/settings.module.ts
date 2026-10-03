import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSettings } from './entities/app-settings.entity';
import { SystemSetting } from './entities/system-setting.entity';
import { SystemSettingsService } from './system-settings.service';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

/** Global: webhook va telegram modullari sozlamalarni import qilmasdan oladi */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AppSettings, SystemSetting])],
  controllers: [SettingsController],
  providers: [SettingsService, SystemSettingsService],
  exports: [SettingsService, SystemSettingsService],
})
export class SettingsModule {}

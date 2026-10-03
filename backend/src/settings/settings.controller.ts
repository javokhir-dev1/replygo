import { Body, Controller, Delete, Get, Put } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { TelegramService } from '../telegram/telegram.service';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

/** Panel sozlamalari — har foydalanuvchiga alohida, JWT bilan himoyalangan */
@Controller('api/settings')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly telegram: TelegramService,
  ) {}

  private async withTelegram(userId: number, body: object) {
    return { ...body, telegram: await this.telegram.statusFor(userId) };
  }

  @Get()
  async get(@CurrentUser() user: AuthUser) {
    return this.withTelegram(user.id, await this.settings.describe(user.id));
  }

  @Put()
  async update(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) {
    return this.withTelegram(user.id, await this.settings.update(user.id, dto));
  }

  @Delete()
  async reset(@CurrentUser() user: AuthUser) {
    return this.withTelegram(user.id, await this.settings.reset(user.id));
  }
}

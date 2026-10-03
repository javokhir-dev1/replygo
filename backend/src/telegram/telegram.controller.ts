import { Body, Controller, Delete, Get, Logger, Param, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/public.decorator';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { TelegramService } from './telegram.service';
import { TelegramStatsService } from './telegram-stats.service';
import { verifyInitData } from './telegram-webapp';

@Controller('api/telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly stats: TelegramStatsService,
    private readonly telegram: TelegramService,
  ) {}

  /**
   * Mini App statistikasi.
   *
   * @Public — Telegram ichida panel JWT'si yo'q. O'rniga Telegram imzolagan
   * `initData` tekshiriladi, so'ng shu Telegram chat qaysi ReplyGo
   * foydalanuvchisiga bog'langani topiladi — faqat O'SHANING statistikasi.
   */
  @Public()
  @Post('stats')
  async getStats(@Body() body: { initData?: string }) {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN') || '';
    const res = verifyInitData(body?.initData || '', token);
    if (!res.ok) {
      this.logger.warn(`WebApp kirish rad etildi: ${res.reason}`);
      throw new UnauthorizedException(res.reason || 'Tekshiruvdan o\'tmadi');
    }

    // Shaxsiy chatda chat ID = Telegram foydalanuvchi ID'si
    const userId = await this.telegram.ownerOf(res.user.id);
    if (!userId) {
      throw new UnauthorizedException(
        'Bu Telegram akkaunt ReplyGo\'ga bog\'lanmagan. Panel → Sozlamalar → Telegram\'ni ulash.',
      );
    }

    return {
      user: { id: res.user.id, username: res.user.username ?? null },
      stats: await this.stats.build(userId),
    };
  }

  /** Panel: bir martalik bog'lash havolasi */
  @Post('link')
  link(@CurrentUser() user: AuthUser) {
    return this.telegram.createLink(user.id);
  }

  @Get('chats')
  async chats(@CurrentUser() user: AuthUser) {
    return (await this.telegram.statusFor(user.id)).chats;
  }

  @Delete('chats/:chatId')
  unlink(@CurrentUser() user: AuthUser, @Param('chatId') chatId: string) {
    return this.telegram.unlink(user.id, chatId);
  }
}

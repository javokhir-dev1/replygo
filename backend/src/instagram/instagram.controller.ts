import { Controller, Get, Logger } from '@nestjs/common';
import { InstagramService } from './instagram.service';
import { IgCredsProvider } from '../config/ig-creds.provider';

@Controller('api/instagram')
export class InstagramController {
  private readonly logger = new Logger(InstagramController.name);

  constructor(
    private readonly instagram: InstagramService,
    private readonly credsProvider: IgCredsProvider,
  ) {}

  // Frontend "postlarni tanlash" uchun
  @Get('posts')
  async posts() {
    const posts = await this.instagram.getRecentPosts(this.credsProvider.creds, 24);
    return { posts };
  }

  // Ulangan akkaunt ma'lumoti (status ko'rsatish uchun)
  @Get('account')
  async account() {
    const { token, accountId } = this.credsProvider.creds;
    this.logger.log(`Akkauntga ulanish tekshiruvi: accountId=${accountId || '(bo\'sh)'}, token=${token ? 'bor' : '(bo\'sh)'}`);

    if (!token || !accountId) {
      this.logger.warn('IG_ACCESS_TOKEN yoki IG_ACCOUNT_ID .env da sozlanmagan');
      return { connected: false, error: 'IG_ACCESS_TOKEN yoki IG_ACCOUNT_ID sozlanmagan' };
    }

    try {
      const info = await this.instagram.getAccountInfo(this.credsProvider.creds);
      this.logger.log(`✅ Akkaunt ulandi: @${info.username} (${info.id})`);
      return { connected: true, ...info };
    } catch (e: any) {
      const igError = e?.response?.data ? JSON.stringify(e.response.data) : e.message;
      this.logger.error(`❌ Akkauntga ulanish xatosi: ${igError}`);
      return { connected: false, error: e?.response?.data || e.message };
    }
  }
}

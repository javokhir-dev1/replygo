import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { UsersService } from '../users/users.service';
import { IgAccountsService } from '../ig-accounts/ig-accounts.service';

/**
 * Bitta-adminli versiyadan ko'p foydalanuvchiliga o'tish.
 *
 * Ilgari: bitta admin (.env), bitta Instagram (.env), egasiz qoidalar/loglar.
 * Endi: hamma narsa foydalanuvchiga tegishli. Shu servis ishga tushganda:
 *   1. .env dagi ADMIN_USERNAME/PASSWORD bo'lsa — shu foydalanuvchini yaratadi
 *   2. egasiz (userId IS NULL) qoidalar, loglar va Telegram chatlarini unga beradi
 *   3. .env dagi IG_ACCESS_TOKEN/IG_ACCOUNT_ID ni uning Instagram ulanishiga aylantiradi
 *
 * Idempotent: hammasi "yo'q bo'lsa" sharti bilan — keyingi ishga tushishlarda
 * hech narsa o'zgarmaydi. .env dagi qiymatlarni keyin olib tashlash mumkin.
 */
@Injectable()
export class LegacyMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger('LegacyMigration');

  constructor(
    private readonly config: ConfigService,
    private readonly ds: DataSource,
    private readonly users: UsersService,
    private readonly accounts: IgAccountsService,
  ) {}

  async onApplicationBootstrap() {
    try {
      await this.run();
    } catch (e: any) {
      // Ko'chirish xatosi butun backend'ni yiqitmasin — faqat log
      this.logger.error(`Ko'chirish bajarilmadi: ${e.message}`);
    }
  }

  private async run() {
    const username = this.config.get<string>('ADMIN_USERNAME');
    const password = this.config.get<string>('ADMIN_PASSWORD');
    if (!username || !password) return;

    let admin = await this.users.findByUsername(username);
    if (!admin) {
      admin = await this.users.create(username, password);
      this.logger.log(`👤 .env admini foydalanuvchi sifatida yaratildi: ${admin.username} (#${admin.id})`);
    }

    // Egasiz qatorlar → admin
    for (const table of ['automations', 'logs', 'telegram_chats']) {
      const res = await this.ds.query(`UPDATE "${table}" SET "userId" = $1 WHERE "userId" IS NULL`, [admin.id]);
      const n = Array.isArray(res) ? res[1] : 0;
      if (n) this.logger.log(`${table}: ${n} ta egasiz qator ${admin.username} ga biriktirildi`);
    }

    // .env dagi Instagram → admin ulanishi (agar hali hech kimda bo'lmasa)
    const token = this.config.get<string>('IG_ACCESS_TOKEN');
    const igUserId = this.config.get<string>('IG_ACCOUNT_ID');
    if (token && igUserId && !(await this.accounts.forUser(admin.id)) && !(await this.accounts.byIgUserId(igUserId))) {
      await this.accounts.save(admin.id, { igUserId, token, username: null, expiresInSec: null });
      this.logger.log(`🔗 .env dagi Instagram (${igUserId}) ${admin.username} ga ulandi`);
    }
  }
}

import { Controller, Delete, Get, Logger, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { InstagramService } from './instagram.service';
import { IgAccountsService } from '../ig-accounts/ig-accounts.service';
import { IgOAuthService } from '../ig-accounts/ig-oauth.service';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { IgRateLimitError } from './ig-errors';

@Controller('api/instagram')
export class InstagramController {
  private readonly logger = new Logger(InstagramController.name);

  constructor(
    private readonly instagram: InstagramService,
    private readonly accounts: IgAccountsService,
    private readonly oauth: IgOAuthService,
  ) {}

  /** Joriy foydalanuvchining Instagram holati (panel va sozlamalar uchun) */
  @Get('account')
  async account(@CurrentUser() user: AuthUser) {
    const acc = await this.accounts.forUser(user.id);
    if (!acc) return { connected: false, canConnect: this.oauth.configured };

    const base = {
      connected: true,
      canConnect: this.oauth.configured,
      igUserId: acc.igUserId,
      username: acc.username,
      profile_picture_url: acc.profilePictureUrl,
      status: acc.status,
      tokenExpiresAt: acc.tokenExpiresAt,
      lastError: acc.lastError,
    };
    try {
      const info = await this.instagram.getAccountInfo(this.accounts.creds(acc));
      return { ...base, ...info, ok: true };
    } catch (e: any) {
      if (e instanceof IgRateLimitError) return { ...base, ok: true };
      const msg = e?.response?.data?.error?.message || e.message;
      this.logger.warn(`@${acc.username} tekshiruvi xato: ${msg}`);
      return { ...base, ok: false, error: msg };
    }
  }

  /** "Postlarni tanlash" uchun — faqat o'z akkaunti */
  @Get('posts')
  async posts(@CurrentUser() user: AuthUser) {
    const acc = await this.accounts.forUser(user.id);
    if (!acc) return { posts: [] };
    return { posts: await this.instagram.getRecentPosts(this.accounts.creds(acc), 24) };
  }

  /** "Instagram bilan ulash" — OAuth manzilini qaytaradi (frontend shu yerga yo'naltiradi) */
  @Post('connect')
  async connect(@CurrentUser() user: AuthUser) {
    return { url: await this.oauth.authorizeUrl(user.id) };
  }

  /**
   * Instagram shu yerga qaytaradi. @Public — brauzer yo'naltirishida JWT
   * sarlavhasi bo'lmaydi; foydalanuvchi imzolangan `state` orqali aniqlanadi.
   */
  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDesc: string,
    @Res() res: Response,
  ) {
    const back = (q: Record<string, string>) =>
      res.redirect(`${this.oauth.frontend}/instagram/settings?${new URLSearchParams(q).toString()}`);

    if (error) return back({ ig_error: errorDesc || "Ruxsat berilmadi" });
    try {
      const acc = await this.oauth.complete(code, state);
      return back({ ig: 'connected', u: acc.username ?? '' });
    } catch (e: any) {
      return back({ ig_error: e?.response?.message || e.message || 'Ulab bo\'lmadi' });
    }
  }

  /** Instagram'ni uzish — token o'chiriladi, webhook obunasi bekor qilinadi */
  @Delete('connection')
  async disconnect(@CurrentUser() user: AuthUser) {
    const acc = await this.accounts.forUser(user.id);
    if (!acc) return { connected: false };
    try {
      await this.oauth.unsubscribe(this.accounts.creds(acc).token);
    } catch {
      /* token ochilmasa ham ulanish o'chiriladi */
    }
    await this.accounts.remove(user.id);
    this.logger.log(`Instagram uzildi: @${acc.username} (foydalanuvchi #${user.id})`);
    return { connected: false };
  }
}

import { Controller, Delete, Get, Logger, Param, ParseIntPipe, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { InstagramService } from './instagram.service';
import { InstagramMediaService } from './instagram-media.service';
import { IgAccountsService } from '../ig-accounts/ig-accounts.service';
import { IgOAuthService } from '../ig-accounts/ig-oauth.service';
import type { IgAccount } from '../ig-accounts/entities/ig-account.entity';
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
    private readonly media: InstagramMediaService,
  ) {}

  /** Panelda tanlangan akkaunt kredensiallari; akkaunt yo'q bo'lsa null */
  private async credsFor(userId: number) {
    const acc = await this.accounts.activeFor(userId);
    return acc ? this.accounts.creds(acc) : null;
  }

  /** Ro'yxat uchun — keshlangan qiymatlar, Instagram API'ga bormasdan */
  private brief(acc: IgAccount, activeId: number | null) {
    return {
      id: acc.id,
      igUserId: acc.igUserId,
      username: acc.username,
      profile_picture_url: acc.profilePictureUrl,
      followers_count: acc.followersCount,
      status: acc.status,
      lastError: acc.lastError,
      active: acc.id === activeId,
    };
  }

  /** Foydalanuvchining barcha ulangan akkauntlari (almashtirgich uchun) */
  @Get('accounts')
  async list(@CurrentUser() user: AuthUser) {
    const active = await this.accounts.activeFor(user.id);
    const list = await this.accounts.listForUser(user.id);
    return { accounts: list.map((a) => this.brief(a, active?.id ?? null)), canConnect: this.oauth.configured };
  }

  /** Akkauntni almashtirish — panel shundan keyin shu akkaunt bo'yicha ishlaydi */
  @Post('accounts/:id/select')
  async select(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    const acc = await this.accounts.select(user.id, id);
    return this.brief(acc, acc.id);
  }

  /** Akkauntni uzish — token o'chiriladi, qoidalar va statistika saqlanadi */
  @Delete('accounts/:id')
  async disconnect(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    const acc = await this.accounts.getForUser(user.id, id);
    try {
      await this.oauth.unsubscribe(this.accounts.creds(acc).token);
    } catch {
      /* token ochilmasa ham uziladi */
    }
    await this.accounts.disconnect(user.id, id);
    this.logger.log(`Instagram uzildi: @${acc.username} (foydalanuvchi #${user.id})`);
    return { ok: true };
  }

  /** Tanlangan akkaunt — jonli ma'lumot bilan (sozlamalar va chap panel uchun) */
  @Get('account')
  async account(@CurrentUser() user: AuthUser) {
    const acc = await this.accounts.activeFor(user.id);
    if (!acc) return { connected: false, canConnect: this.oauth.configured };

    const base = {
      connected: true,
      canConnect: this.oauth.configured,
      ...this.brief(acc, acc.id),
      tokenExpiresAt: acc.tokenExpiresAt,
    };
    try {
      const info = await this.instagram.getAccountInfo(this.accounts.creds(acc));
      await this.accounts.recordStats(acc, info);
      return { ...base, ...info, id: acc.id, ok: true };
    } catch (e: any) {
      if (e instanceof IgRateLimitError) return { ...base, ok: true };
      const msg = e?.response?.data?.error?.message || e.message;
      this.logger.warn(`@${acc.username} tekshiruvi xato: ${msg}`);
      return { ...base, ok: false, error: msg };
    }
  }

  /** "Postlarni tanlash" uchun — tanlangan akkaunt postlari */
  @Get('posts')
  async posts(@CurrentUser() user: AuthUser) {
    const acc = await this.accounts.activeFor(user.id);
    if (!acc) return { posts: [] };
    return { posts: await this.instagram.getRecentPosts(this.accounts.creds(acc), 24) };
  }

  /** "Postlarim": postlar va Reels, har biri statistikasi bilan (sahifalab) */
  @Get('media')
  async mediaList(@CurrentUser() user: AuthUser, @Query('after') after?: string, @Query('limit') limit?: string) {
    const creds = await this.credsFor(user.id);
    if (!creds) return { connected: false, items: [], after: null };
    return { connected: true, ...(await this.media.media(creds, { after: after || undefined, limit: Number(limit) || 24 })) };
  }

  /** Faol istoriyalar (Instagram API faqat oxirgi 24 soatdagisini beradi) */
  @Get('stories')
  async stories(@CurrentUser() user: AuthUser) {
    const creds = await this.credsFor(user.id);
    if (!creds) return { connected: false, items: [] };
    return { connected: true, ...(await this.media.stories(creds)) };
  }

  /** Akkaunt bo'yicha davr statistikasi (ko'rishlar, qamrov...) va kunlik qamrov */
  @Get('overview')
  async overview(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    const creds = await this.credsFor(user.id);
    if (!creds) return { connected: false };
    return { connected: true, ...(await this.media.overview(creds, Number(days) || 30)) };
  }

  /** "Instagram bilan ulash" (yangi yoki qo'shimcha akkaunt) — OAuth manzili */
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

    if (error) return back({ ig_error: errorDesc || 'Ruxsat berilmadi' });
    try {
      const acc = await this.oauth.complete(code, state);
      return back({ ig: 'connected', u: acc.username ?? '' });
    } catch (e: any) {
      return back({ ig_error: e?.response?.message || e.message || 'Ulab bo\'lmadi' });
    }
  }
}

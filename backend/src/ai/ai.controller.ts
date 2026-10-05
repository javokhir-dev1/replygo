import { Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { AiService } from './ai.service';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@Controller('api/ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** Panel tugmalarni ko'rsatish-ko'rsatmasligini shu bilan biladi */
  @Get('status')
  status(@CurrentUser() user: AuthUser) {
    return { enabled: this.ai.isAllowed(user.username) };
  }

  @Post('media/:mediaId')
  async analyzeMedia(@CurrentUser() user: AuthUser, @Param('mediaId') mediaId: string) {
    this.ai.assertAllowed(user.username);
    if (!/^\d{5,30}$/.test(mediaId)) throw new Error("Noto'g'ri media ID");
    return this.ai.start(user.id, 'media', mediaId);
  }

  @Post('profile')
  async analyzeProfile(@CurrentUser() user: AuthUser) {
    this.ai.assertAllowed(user.username);
    return this.ai.start(user.id, 'profile', null);
  }

  @Get('analyses')
  async list(@CurrentUser() user: AuthUser, @Query('kind') kind?: string, @Query('mediaId') mediaId?: string) {
    this.ai.assertAllowed(user.username);
    const k = kind === 'media' || kind === 'profile' ? kind : undefined;
    return this.ai.list(user.id, k, mediaId || undefined);
  }

  @Get('analyses/:id')
  async get(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    this.ai.assertAllowed(user.username);
    return this.ai.get(user.id, id);
  }
}

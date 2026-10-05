import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService, Range } from './dashboard.service';
import { IgAccountsService } from '../ig-accounts/ig-accounts.service';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

const RANGES: Range[] = ['today', '7d', '30d'];

@Controller('api/dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly accounts: IgAccountsService,
  ) {}

  /** Tanlangan Instagram akkaunt statistikasi. ?range=today|7d|30d */
  @Get()
  async get(@CurrentUser() user: AuthUser, @Query('range') range?: string) {
    const r: Range = RANGES.includes(range as Range) ? (range as Range) : '7d';
    const acc = await this.accounts.activeFor(user.id);
    if (!acc) return { connected: false };
    return { connected: true, ...(await this.dashboard.build(acc, r)) };
  }
}

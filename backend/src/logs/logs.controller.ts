import { Controller, Get, Delete, Query } from '@nestjs/common';
import { LogsService } from './logs.service';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@Controller('api/logs')
export class LogsController {
  constructor(private readonly service: LogsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.service.findAll(user.id, limit ? +limit || 100 : 100);
  }

  @Delete()
  async clear(@CurrentUser() user: AuthUser) {
    await this.service.clear(user.id);
    return { ok: true };
  }
}

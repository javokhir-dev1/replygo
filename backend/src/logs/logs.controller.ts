import { Controller, Get, Delete, Query } from '@nestjs/common';
import { LogsService } from './logs.service';

@Controller('api/logs')
export class LogsController {
  constructor(private readonly service: LogsService) {}

  @Get()
  findAll(@Query('limit') limit?: string) {
    return this.service.findAll(limit ? +limit : 100);
  }

  @Delete()
  clear() {
    return this.service.clear();
  }
}

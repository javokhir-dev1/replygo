import { Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { IgAccountsService } from '../ig-accounts/ig-accounts.service';

@Controller('api/automations')
export class AutomationsController {
  constructor(
    private readonly service: AutomationsService,
    private readonly accounts: IgAccountsService,
  ) {}

  /** Tanlangan Instagram akkaunt qoidalari (akkaunt yo'q bo'lsa — bo'sh) */
  @Get()
  async findAll(@CurrentUser() user: AuthUser) {
    const acc = await this.accounts.activeFor(user.id);
    return acc ? this.service.findAll(user.id, acc.id) : [];
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user.id);
  }

  /** Yangi qoida tanlangan akkauntga bog'lanadi */
  @Post()
  async create(@Body() dto: CreateAutomationDto, @CurrentUser() user: AuthUser) {
    const acc = await this.accounts.requireActive(user.id);
    return this.service.create(user.id, acc.id, dto);
  }

  /**
   * DIQQAT: body tipi aniq KLASS. Ilgari `Partial<CreateAutomationDto>` edi —
   * u runtime'da `Object` bo'lib, ValidationPipe tekshiruvni butunlay o'tkazib
   * yuborardi (whitelist ham ishlamasdi). Panel har doim to'liq formani yuboradi.
   */
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateAutomationDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, user.id, dto);
  }

  @Patch(':id/toggle')
  toggle(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.toggle(id, user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user.id);
  }
}

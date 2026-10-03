import { Body, Controller, Get, HttpCode, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangeUsernameDto, ChangePasswordDto } from './dto/change-credentials.dto';
import { Public } from './public.decorator';
import { CurrentUser, AuthUser } from './current-user.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private ip(req: Request) {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  /** Ro'yxatdan o'tish — ochiq; IP bo'yicha soatiga cheklangan */
  @Public()
  @Post('register')
  @HttpCode(201)
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto.username, dto.password, this.ip(req));
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.username, dto.password, this.ip(req));
  }

  /** Loginni o'zgartirish — joriy parol bilan tasdiqlanadi, yangi token qaytadi */
  @Patch('username')
  changeUsername(@CurrentUser() user: AuthUser, @Body() dto: ChangeUsernameDto, @Req() req: Request) {
    return this.auth.changeUsername(user.id, dto.username, dto.password, this.ip(req));
  }

  /** Parolni o'zgartirish — boshqa qurilmalardagi sessiyalar bekor bo'ladi */
  @Patch('password')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto, @Req() req: Request) {
    return this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword, this.ip(req));
  }

  /** Token hali amal qilyaptimi — frontend sahifa ochilganda tekshiradi */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { id: user.id, username: user.username };
  }
}

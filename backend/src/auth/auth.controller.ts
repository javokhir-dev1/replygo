import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './public.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Login — yagona ochiq panel endpointi */
  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return this.auth.login(dto.username, dto.password, ip);
  }

  /** Token hali amal qilyaptimi — frontend sahifa ochilganda tekshiradi */
  @Get('me')
  me(@Req() req: Request & { user?: any }) {
    return { username: req.user?.username ?? null };
  }
}

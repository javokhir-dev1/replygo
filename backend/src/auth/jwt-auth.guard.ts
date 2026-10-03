import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';
import { UsersService } from '../users/users.service';

/**
 * Global guard: @Public() qo'yilmagan HAR BIR endpoint uchun
 * `Authorization: Bearer <token>` talab qilinadi.
 *
 * Yangi controller qo'shilganda uni himoyalashni unutib qo'yish mumkin emas —
 * himoya default holat, ochiqlik esa aniq belgilanadi.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: any }>();
    const header = req.headers['authorization'];
    if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token yuborilmadi');
    }

    const token = header.slice(7).trim();
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException("Token yaroqsiz yoki muddati tugagan");
    }

    // Ko'p foydalanuvchili rejimda sub = foydalanuvchi ID'si. Eski bitta-admin
    // tokenlarida sub = 'admin' edi — ular rad etiladi (qayta kirish kerak).
    const id = Number(payload?.sub);
    if (!Number.isInteger(id) || id <= 0) {
      throw new UnauthorizedException('Sessiya eskirgan, qaytadan kiring');
    }

    // Foydalanuvchi hali bormi va sessiya versiyasi mosmi (parol o'zgargandan
    // keyin boshqa qurilmalardagi eski tokenlar shu yerda rad etiladi)
    const user = await this.users.findById(id);
    if (!user || (Number(payload.v) || 0) !== user.tokenVersion) {
      throw new UnauthorizedException('Sessiya tugadi, qaytadan kiring');
    }
    req.user = { id, username: user.username };
    return true;
  }
}

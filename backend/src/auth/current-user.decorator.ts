import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** JWT guard qo'ygan joriy foydalanuvchi */
export interface AuthUser {
  id: number;
  username: string;
}

/** Controller'da: `@CurrentUser() user: AuthUser` */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);

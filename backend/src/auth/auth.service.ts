import { Injectable, Logger, OnModuleInit, UnauthorizedException, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { verifyPassword, DUMMY_HASH } from '../common/password';

/** Bitta IP uchun urinishlar hisobi */
interface AttemptState {
  count: number;
  lockedUntil: number;
  windowStart: number;
}

const MAX_LOGIN_FAILS = 5;
const LOCK_MS = 15 * 60_000; // 5 marta xato → 15 daqiqa blok
const MAX_REGISTERS = 5; // bitta IP'dan soatiga
const REGISTER_WINDOW_MS = 60 * 60_000;
const SWEEP_MS = 60 * 60_000;

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly loginFails = new Map<string, AttemptState>();
  private readonly registers = new Map<string, AttemptState>();
  private lastSweep = Date.now();

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  /** JWT_SECRET'siz tokenlarni imzolab bo'lmaydi — noto'g'ri deploy'ni erta ushlaymiz */
  onModuleInit() {
    const secret = this.config.get<string>('JWT_SECRET') || '';
    if (!secret) {
      throw new Error(".env da JWT_SECRET to'ldirilmagan. `openssl rand -hex 32` bilan yarating.");
    }
    if (secret.length < 32) {
      this.logger.warn(`JWT_SECRET juda qisqa (${secret.length} belgi). Kamida 32 belgi tavsiya etiladi.`);
    }
  }

  /** Eskirgan yozuvlarni vaqti-vaqti bilan tozalaymiz (xotira o'smasligi uchun) */
  private sweep(now: number) {
    if (now - this.lastSweep < SWEEP_MS) return;
    this.lastSweep = now;
    for (const map of [this.loginFails, this.registers]) {
      for (const [ip, st] of map) {
        if (st.lockedUntil < now && now - st.windowStart > SWEEP_MS) map.delete(ip);
      }
    }
  }

  private assertNotLocked(ip: string) {
    const now = Date.now();
    this.sweep(now);
    const st = this.loginFails.get(ip);
    if (st && st.lockedUntil > now) {
      const min = Math.ceil((st.lockedUntil - now) / 60_000);
      throw new UnauthorizedException(`Juda ko'p xato urinish. ${min} daqiqadan keyin qayta urinib ko'ring.`);
    }
  }

  private registerFailure(ip: string) {
    const now = Date.now();
    const st = this.loginFails.get(ip) ?? { count: 0, lockedUntil: 0, windowStart: now };
    st.count += 1;
    if (st.count >= MAX_LOGIN_FAILS) {
      st.lockedUntil = now + LOCK_MS;
      st.count = 0;
      this.logger.warn(`Login bloklandi (IP: ${ip}) — ${MAX_LOGIN_FAILS} marta xato parol`);
    }
    this.loginFails.set(ip, st);
  }

  private async issue(user: { id: number; username: string; tokenVersion?: number }) {
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') || '7d';
    // v — sessiya versiyasi; parol o'zgarganda oshadi va eski tokenlar bekor bo'ladi
    const token = await this.jwt.signAsync(
      { sub: String(user.id), username: user.username, v: user.tokenVersion ?? 0 },
      { expiresIn },
    );
    return { token, username: user.username, expiresIn };
  }

  async register(username: string, password: string, ip: string) {
    const now = Date.now();
    this.sweep(now);
    const st = this.registers.get(ip);
    if (st && now - st.windowStart < REGISTER_WINDOW_MS && st.count >= MAX_REGISTERS) {
      throw new HttpException(
        'Bu manzildan juda ko\'p ro\'yxatdan o\'tildi. Birozdan so\'ng urinib ko\'ring.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.users.create(username, password);

    const cur = st && now - st.windowStart < REGISTER_WINDOW_MS ? st : { count: 0, lockedUntil: 0, windowStart: now };
    cur.count += 1;
    this.registers.set(ip, cur);

    this.logger.log(`🆕 Yangi foydalanuvchi: ${user.username} (#${user.id}, IP: ${ip})`);
    await this.users.touchLogin(user.id);
    return this.issue(user);
  }

  /** Joriy parolni tekshiradi; xato bo'lsa login kabi IP bo'yicha bloklashga hisoblanadi */
  private async confirmPassword(userId: number, password: string, ip: string) {
    this.assertNotLocked(ip);
    const user = await this.users.findById(userId);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      this.registerFailure(ip);
      this.logger.warn(`Joriy parol xato (foydalanuvchi #${userId}, IP: ${ip})`);
      throw new UnauthorizedException("Joriy parol noto'g'ri");
    }
    return user;
  }

  async changeUsername(userId: number, username: string, password: string, ip: string) {
    const before = await this.confirmPassword(userId, password, ip);
    const user = await this.users.changeUsername(userId, username);
    this.logger.log(`Login o'zgardi: ${before.username} → ${user.username} (#${userId})`);
    return this.issue(user); // token ichidagi login ham yangilanadi
  }

  async changePassword(userId: number, current: string, next: string, ip: string) {
    await this.confirmPassword(userId, current, ip);
    if (current === next) throw new BadRequestException('Yangi parol eskisidan farq qilsin');
    const user = await this.users.changePassword(userId, next);
    this.logger.log(`Parol o'zgardi: ${user.username} (#${userId}) — boshqa sessiyalar bekor qilindi`);
    return this.issue(user); // shu qurilma kirgan holicha qoladi
  }

  async login(username: string, password: string, ip: string) {
    this.assertNotLocked(ip);

    const user = await this.users.findByUsername(username);
    // Foydalanuvchi topilmasa ham xesh tekshiramiz — vaqtdan "bunday login bor-yo'q" bilinmasin
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !ok) {
      this.registerFailure(ip);
      this.logger.warn(`Muvaffaqiyatsiz login urinishi (IP: ${ip})`);
      throw new UnauthorizedException("Login yoki parol noto'g'ri");
    }

    this.loginFails.delete(ip);
    await this.users.touchLogin(user.id);
    this.logger.log(`✅ Login: ${user.username} (IP: ${ip})`);
    return this.issue(user);
  }
}

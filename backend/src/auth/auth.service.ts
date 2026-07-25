import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

/** Bitta IP uchun urinishlar hisobi (brute-force himoyasi) */
interface AttemptState {
  count: number;
  lockedUntil: number;
}

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60_000; // 5 marta xato → 15 daqiqa blok
const ATTEMPT_TTL_MS = 60 * 60_000; // eski yozuvlarni tozalash oynasi

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly attempts = new Map<string, AttemptState>();
  private lastSweep = Date.now();

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  /** Ishga tushganda sozlamalar to'liq ekanini tekshiramiz — noto'g'ri deploy'ni erta ushlaydi */
  onModuleInit() {
    const missing = ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'JWT_SECRET'].filter(
      (k) => !this.config.get<string>(k),
    );
    if (missing.length) {
      throw new Error(
        `.env da quyidagilar to'ldirilmagan: ${missing.join(', ')}. ` +
          'Panel himoyasi ularsiz ishlamaydi.',
      );
    }
    const secret = this.config.get<string>('JWT_SECRET') || '';
    if (secret.length < 32) {
      this.logger.warn(
        `JWT_SECRET juda qisqa (${secret.length} belgi). Kamida 32 belgi tavsiya etiladi: ` +
          "`openssl rand -hex 32` bilan yarating.",
      );
    }
  }

  /**
   * Vaqt bo'yicha oshkor bo'lmaydigan taqqoslash.
   * Oddiy `===` satrlarni birinchi farqda to'xtatadi va nazariy jihatdan
   * parolni belgima-belgi topishga imkon beradi.
   */
  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    // Uzunlik farqi ham oshkor bo'lmasligi uchun avval hash olamiz
    const hashA = crypto.createHash('sha256').update(bufA).digest();
    const hashB = crypto.createHash('sha256').update(bufB).digest();
    return crypto.timingSafeEqual(hashA, hashB);
  }

  /** Eskirgan urinish yozuvlarini vaqti-vaqti bilan tozalaymiz (xotira o'smasligi uchun) */
  private sweep(now: number) {
    if (now - this.lastSweep < ATTEMPT_TTL_MS) return;
    this.lastSweep = now;
    for (const [ip, st] of this.attempts) {
      if (st.lockedUntil < now - ATTEMPT_TTL_MS) this.attempts.delete(ip);
    }
  }

  private assertNotLocked(ip: string) {
    const now = Date.now();
    this.sweep(now);
    const st = this.attempts.get(ip);
    if (st && st.lockedUntil > now) {
      const min = Math.ceil((st.lockedUntil - now) / 60_000);
      throw new UnauthorizedException(
        `Juda ko'p xato urinish. ${min} daqiqadan keyin qayta urinib ko'ring.`,
      );
    }
  }

  private registerFailure(ip: string) {
    const now = Date.now();
    const st = this.attempts.get(ip) ?? { count: 0, lockedUntil: 0 };
    st.count += 1;
    if (st.count >= MAX_ATTEMPTS) {
      st.lockedUntil = now + LOCK_MS;
      st.count = 0;
      this.logger.warn(`Login bloklandi (IP: ${ip}) — ${MAX_ATTEMPTS} marta xato parol`);
    }
    this.attempts.set(ip, st);
  }

  async login(username: string, password: string, ip: string) {
    this.assertNotLocked(ip);

    const expectedUser = this.config.get<string>('ADMIN_USERNAME') || '';
    const expectedPass = this.config.get<string>('ADMIN_PASSWORD') || '';

    // Ikkalasini ham har doim tekshiramiz — qaysi biri xato ekani vaqtdan bilinmasin
    const userOk = this.safeEqual(username, expectedUser);
    const passOk = this.safeEqual(password, expectedPass);

    if (!userOk || !passOk) {
      this.registerFailure(ip);
      this.logger.warn(`Muvaffaqiyatsiz login urinishi (IP: ${ip})`);
      // Qaysi maydon xato ekanini aytmaymiz
      throw new UnauthorizedException("Login yoki parol noto'g'ri");
    }

    this.attempts.delete(ip);
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') || '7d';
    const token = await this.jwt.signAsync({ sub: 'admin', username }, { expiresIn });

    this.logger.log(`✅ Muvaffaqiyatli login (IP: ${ip})`);
    return { token, username, expiresIn };
  }
}

import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from './entities/system-setting.entity';

/** Tizim (admin) sozlamalari — barcha foydalanuvchilarga umumiy */
export interface SystemSettings {
  /** Bitta odamga, bitta post ostida, 24 soatda nechta javob. 0 = cheksiz */
  perUserLimit: number;
  /** Komment javobidan oldingi tasodifiy kechikish (ms). 0/0 = darhol */
  commentMinDelayMs: number;
  commentMaxDelayMs: number;
  /** Navbatda shuncha komment kutayotgan bo'lsa DM oldidan sekinlashadi */
  dmBusyThreshold: number;
  dmMinDelayMs: number;
  dmMaxDelayMs: number;
  /** Tugmani ketma-ket bosish chegarasi (0 = himoya o'chiq) va oyna (s) */
  dmButtonMaxPresses: number;
  dmButtonWindowSec: number;
}

/**
 * Har kalit: standart qiymat, ruxsat etilgan oraliq va bir martalik
 * ko'chirish uchun eski .env kaliti (bazada hali yo'q bo'lsa shundan olinadi).
 */
const SPEC: { [K in keyof SystemSettings]: { def: number; min: number; max: number; legacyEnv: string } } = {
  perUserLimit: { def: 10, min: 0, max: 1000, legacyEnv: 'PER_USER_COMMENT_LIMIT' },
  commentMinDelayMs: { def: 5_000, min: 0, max: 60_000, legacyEnv: 'COMMENT_MIN_DELAY_MS' },
  commentMaxDelayMs: { def: 10_000, min: 0, max: 60_000, legacyEnv: 'COMMENT_MAX_DELAY_MS' },
  dmBusyThreshold: { def: 3, min: 0, max: 1000, legacyEnv: 'DM_BUSY_THRESHOLD' },
  dmMinDelayMs: { def: 5_000, min: 0, max: 60_000, legacyEnv: 'DM_MIN_DELAY_MS' },
  dmMaxDelayMs: { def: 10_000, min: 0, max: 60_000, legacyEnv: 'DM_MAX_DELAY_MS' },
  dmButtonMaxPresses: { def: 10, min: 0, max: 100, legacyEnv: 'DM_BUTTON_MAX_PRESSES' },
  dmButtonWindowSec: { def: 120, min: 10, max: 3600, legacyEnv: 'DM_BUTTON_WINDOW_SEC' },
};
const KEYS = Object.keys(SPEC) as (keyof SystemSettings)[];

// Bazadan qayta o'qish oralig'i: admin panel (yoki to'g'ridan-to'g'ri SQL)
// orqali o'zgartirilgan qiymat qayta ishga tushirishsiz shu vaqt ichida kuchga kiradi.
const RELOAD_MS = 30_000;

/**
 * Manba — FAQAT baza (`system_settings` jadvali).
 *
 * Birinchi ishga tushishda bazada yo'q kalitlar eski .env qiymatidan (bo'lmasa
 * standartdan) to'ldiriladi. Shundan keyin .env dagi bu qatorlar kerak emas.
 * Har komment uchun bazaga borilmaydi — qiymatlar xotirada keshlanadi.
 */
@Injectable()
export class SystemSettingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('SystemSettings');
  private cache: SystemSettings = Object.fromEntries(KEYS.map((k) => [k, SPEC[k].def])) as any;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(SystemSetting) private readonly repo: Repository<SystemSetting>,
  ) {}

  async onModuleInit() {
    await this.seed();
    await this.reload();
    this.timer = setInterval(() => void this.reload(), RELOAD_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Bazada yo'q kalitlarni .env (eski) yoki standart qiymat bilan to'ldiradi */
  private async seed() {
    const existing = new Set((await this.repo.find({ select: { key: true } })).map((r) => r.key));
    for (const key of KEYS) {
      if (existing.has(key)) continue;
      const raw = this.config.get<string>(SPEC[key].legacyEnv);
      const fromEnv = raw !== undefined && String(raw).trim() !== '' && Number.isFinite(Number(raw));
      const value = this.clamp(key, fromEnv ? Number(raw) : SPEC[key].def);
      await this.repo.save({ key, value });
      this.logger.log(
        fromEnv
          ? `${key} = ${value} — .env (${SPEC[key].legacyEnv}) dan bazaga ko'chirildi`
          : `${key} = ${value} — standart qiymat bazaga yozildi`,
      );
    }
  }

  private async reload() {
    try {
      const rows = await this.repo.find();
      const next = { ...this.cache };
      for (const r of rows) {
        if ((KEYS as string[]).includes(r.key) && Number.isFinite(Number(r.value))) {
          (next as any)[r.key] = this.clamp(r.key as keyof SystemSettings, Number(r.value));
        }
      }
      this.cache = next;
    } catch (e: any) {
      // Baza vaqtincha o'qilmasa oxirgi ma'lum qiymatlar bilan davom etamiz
      this.logger.warn(`Sozlamalarni qayta o'qib bo'lmadi: ${e.message}`);
    }
  }

  private clamp(key: keyof SystemSettings, v: number) {
    const { min, max } = SPEC[key];
    return Math.min(max, Math.max(min, Math.round(v)));
  }

  /** Joriy qiymatlar (xotiradan, sinxron) */
  get current(): SystemSettings {
    return { ...this.cache };
  }

  /** Admin panel uchun: qiymatlar + standart + oraliqlar */
  describe() {
    return {
      values: this.current,
      spec: Object.fromEntries(KEYS.map((k) => [k, { def: SPEC[k].def, min: SPEC[k].min, max: SPEC[k].max }])),
    };
  }

  /** Admin panel shu orqali o'zgartiradi (hozircha endpoint yo'q) */
  async update(patch: Partial<SystemSettings>) {
    const next = { ...this.cache };
    for (const key of KEYS) {
      if (patch[key] === undefined) continue;
      const v = Number(patch[key]);
      if (!Number.isFinite(v) || v < SPEC[key].min || v > SPEC[key].max) {
        throw new BadRequestException(`${key}: ${SPEC[key].min}..${SPEC[key].max} oralig'ida bo'lsin`);
      }
      next[key] = Math.round(v);
    }
    if (next.commentMinDelayMs > next.commentMaxDelayMs) {
      throw new BadRequestException("Komment kechikishi: minimum maksimumdan katta bo'lmasin");
    }
    if (next.dmMinDelayMs > next.dmMaxDelayMs) {
      throw new BadRequestException("DM kechikishi: minimum maksimumdan katta bo'lmasin");
    }
    await this.repo.save(KEYS.filter((k) => patch[k] !== undefined).map((key) => ({ key, value: next[key] })));
    this.cache = next;
    this.logger.log(`Yangilandi: ${Object.keys(patch).join(', ')}`);
    return this.describe();
  }
}

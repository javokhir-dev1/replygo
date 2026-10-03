import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettings } from './entities/app-settings.entity';
import { RuntimeSettings, SettingsSource } from './settings.types';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SystemSettingsService } from './system-settings.service';

/** Foydalanuvchining o'zi boshqaradigan sozlamalar (.env — umumiy standart) */
type UserSettings = Pick<RuntimeSettings, 'telegramEnabled'>;
const USER_SPEC: { [K in keyof UserSettings]: { env: string; def: UserSettings[K] } } = {
  telegramEnabled: { env: 'TELEGRAM_ENABLED', def: true },
};
const USER_KEYS = Object.keys(USER_SPEC) as (keyof UserSettings)[];

/**
 * Bot ishlayotganda kerak bo'ladigan sozlamalar = tizim + foydalanuvchi.
 *
 *   - tizim (tezlik, limitlar)   → SystemSettingsService, baza, hamma uchun bitta
 *   - foydalanuvchi (Telegram)   → app_settings, har kimga alohida, keshlanadi
 *
 * Chaqiruvchilar (webhook, telegram) faqat `get(userId)` ni biladi — manba
 * qayerdaligi ularga ahamiyatsiz.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly cache = new Map<number, { overrides: Partial<UserSettings>; updatedAt: Date | null }>();

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(AppSettings) private readonly repo: Repository<AppSettings>,
    private readonly system: SystemSettingsService,
  ) {}

  private async entry(userId: number) {
    const hit = this.cache.get(userId);
    if (hit) return hit;
    let row: AppSettings | null = null;
    try {
      row = await this.repo.findOne({ where: { id: userId } });
    } catch (e: any) {
      this.logger.error(`Sozlamalarni o'qib bo'lmadi (#${userId}): ${e.message}`);
      return { overrides: {}, updatedAt: null };
    }
    // Eski yozuvlarda tizim kalitlari ham bo'lishi mumkin — faqat foydalanuvchinikini olamiz
    const data = row?.data ?? {};
    const overrides = Object.fromEntries(USER_KEYS.filter((k) => k in data).map((k) => [k, data[k]])) as Partial<UserSettings>;
    const e = { overrides, updatedAt: row?.updatedAt ?? null };
    this.cache.set(userId, e);
    return e;
  }

  private envDefault<K extends keyof UserSettings>(key: K): UserSettings[K] | undefined {
    const raw = this.config.get<string>(USER_SPEC[key].env);
    if (raw === undefined || raw === null || String(raw).trim() === '') return undefined;
    return !/^(0|false|no|off)$/i.test(String(raw)) as UserSettings[K];
  }

  private mergeUser(overrides: Partial<UserSettings>): UserSettings {
    const out = {} as UserSettings;
    for (const k of USER_KEYS) (out as any)[k] = overrides[k] ?? this.envDefault(k) ?? USER_SPEC[k].def;
    return out;
  }

  /** Bot uchun: tizim + shu foydalanuvchi sozlamalari */
  async get(userId: number): Promise<RuntimeSettings> {
    return { ...this.system.current, ...this.mergeUser((await this.entry(userId)).overrides) };
  }

  /** Panel uchun: qiymat + qayerdan kelgani */
  async describe(userId: number) {
    const { overrides, updatedAt } = await this.entry(userId);
    const sys = this.system.current;
    const values: RuntimeSettings = { ...sys, ...this.mergeUser(overrides) };
    const defaults: RuntimeSettings = { ...sys, ...this.mergeUser({}) };
    const sources = {} as Record<keyof RuntimeSettings, SettingsSource>;
    for (const k of Object.keys(sys) as (keyof RuntimeSettings)[]) sources[k] = 'system';
    for (const k of USER_KEYS) sources[k] = k in overrides ? 'panel' : this.envDefault(k) !== undefined ? 'env' : 'default';
    return { values, defaults, sources, updatedAt };
  }

  async update(userId: number, dto: UpdateSettingsDto) {
    const { overrides: cur } = await this.entry(userId);
    const overrides: Partial<UserSettings> = { ...cur };
    for (const k of USER_KEYS) if ((dto as any)[k] !== undefined) (overrides as any)[k] = (dto as any)[k];
    const saved = await this.repo.save({ id: userId, data: overrides });
    this.cache.set(userId, { overrides, updatedAt: saved.updatedAt ?? new Date() });
    this.logger.log(`Sozlamalar yangilandi (#${userId}): ${Object.keys(dto).join(', ')}`);
    return this.describe(userId);
  }

  /** Foydalanuvchi o'zgartirishlarini bekor qiladi */
  async reset(userId: number) {
    await this.repo.delete({ id: userId });
    this.cache.set(userId, { overrides: {}, updatedAt: null });
    return this.describe(userId);
  }
}

import type { SystemSettings } from './system-settings.service';

/**
 * Bot ishlayotganda ishlatiladigan barcha sozlamalar:
 *   - tizim (admin) sozlamalari — `system_settings` jadvali, hamma uchun umumiy
 *   - foydalanuvchi sozlamalari — `app_settings` jadvali, har kimga alohida
 */
export interface RuntimeSettings extends SystemSettings {
  /** Telegram'ga log yuborish yoqilganmi (foydalanuvchining o'zi boshqaradi) */
  telegramEnabled: boolean;
}

/** system — admin/baza; panel — foydalanuvchi o'zgartirgan; env/default — foydalanuvchi sozlamasi uchun */
export type SettingsSource = 'system' | 'panel' | 'env' | 'default';

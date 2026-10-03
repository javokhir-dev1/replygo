import { IsOptional, IsBoolean } from 'class-validator';

/**
 * Foydalanuvchi o'zi o'zgartira oladigan sozlamalar.
 *
 * Tezlik va limitlar (kechikishlar, foydalanuvchi limiti, DM sekinlashuvi,
 * tugma himoyasi) ataylab bu yerda YO'Q — ular .env dan olinadi va keyinchalik
 * faqat admin panelidan boshqariladi. Ro'yxatda bo'lmagan maydonlarni
 * ValidationPipe (whitelist) olib tashlaydi.
 *
 * DIQQAT: bu alohida KLASS bo'lishi shart — `Partial<...>` runtime'da `Object`
 * bo'lib, validatsiyani butunlay o'chirib qo'yardi.
 */
export class UpdateSettingsDto {
  @IsOptional() @IsBoolean()
  telegramEnabled?: boolean;
}

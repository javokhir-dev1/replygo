import { SetMetadata } from '@nestjs/common';

/**
 * Shu dekorator qo'yilgan endpoint global guard'dan o'tkazib yuboriladi.
 * Faqat webhook (Meta chaqiradi) va login uchun ishlatiladi.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

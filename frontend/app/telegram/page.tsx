'use client';

import { Send } from 'lucide-react';

/** Telegram bo'limi — hozircha bo'sh (funksiyalar keyinroq qo'shiladi) */
export default function TelegramHome() {
  return (
    <div>
      <p className="eyebrow">Telegram</p>
      <h1 className="title mt-2">Tez orada</h1>
      <p className="subtitle mt-1.5">Telegram bo&apos;limi ustida ish ketyapti.</p>

      <div className="panel mt-10 px-6 py-16 text-center">
        <span className="inline-grid place-items-center w-12 h-12 rounded-full bg-[var(--accent-soft)]">
          <Send size={20} strokeWidth={1.5} className="text-[var(--accent-ink)]" />
        </span>
        <p className="text-[15px] font-medium mt-5">Bu yerda Telegram avtomatizatsiyasi bo&apos;ladi</p>
        <p className="subtitle mt-1.5 max-w-sm mx-auto">
          Hozircha Telegram faqat log va statistika uchun ishlatiladi — uni Instagram → Sozlamalar
          bo&apos;limida ulash mumkin.
        </p>
      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Eski manzildan yangisiga yo'naltirish — query (?ig=connected kabi) saqlanadi.
 * `to` funksiya bo'lsa, brauzerda hisoblanadi (masalan oxirgi bo'lim).
 */
export function Redirect({ to }: { to: string | (() => string) }) {
  useEffect(() => {
    const target = typeof to === 'function' ? to() : to;
    window.location.replace(target + window.location.search);
  }, [to]);
  return (
    <div className="flex-1 grid place-items-center py-24">
      <Loader2 size={18} strokeWidth={1.75} className="animate-spin text-[var(--muted)]" />
    </div>
  );
}

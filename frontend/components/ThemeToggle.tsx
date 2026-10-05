'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { getTheme, setTheme, resolveTheme, THEME_CHANGED } from '@/lib/theme';

/**
 * Kun/tun tezkor almashtirgichi — bir bosishda.
 * "Tizim" rejimi Sozlamalarda; bu yerda bosilsa aniq kun yoki tun tanlanadi.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [effective, setEffective] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    const sync = () => setEffective(resolveTheme(getTheme()));
    sync();
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    window.addEventListener(THEME_CHANGED, sync);
    mq?.addEventListener?.('change', sync);
    return () => {
      window.removeEventListener(THEME_CHANGED, sync);
      mq?.removeEventListener?.('change', sync);
    };
  }, []);

  const dark = effective === 'dark';
  const label = dark ? 'Kun rejimiga o\'tish' : 'Tun rejimiga o\'tish';

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      title={label}
      aria-label={label}
      className={`icon-btn ${className}`}
      // SSR'da rejim noma'lum — ikonka hidratsiyadan keyin chiqadi (miltillamasin)
      style={effective ? undefined : { visibility: 'hidden' }}
    >
      {dark ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
    </button>
  );
}

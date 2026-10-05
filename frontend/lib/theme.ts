'use client';

/**
 * Ko'rinish rejimi (kun/tun) — faqat shu brauzer uchun, localStorage'da.
 *
 * Backend'ga yozilmaydi: bu qurilmaga xos tanlov (telefonda tun, ish
 * kompyuterida kun bo'lishi mumkin). <html data-theme> atributi orqali
 * globals.css dagi tokenlar almashadi.
 */
export type ThemeMode = 'system' | 'light' | 'dark';

export const THEME_KEY = 'replygo_theme';

/** Rejim o'zgarganda — barcha boshqaruvlar (chap panel, sozlamalar) sinxron bo'lishi uchun */
export const THEME_CHANGED = 'replygo:theme-changed';

export function getTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function setTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  try {
    if (mode === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* maxfiy rejim — tanlov faqat shu sahifa uchun qoladi */
  }
  window.dispatchEvent(new Event(THEME_CHANGED));
}

/** Hozir amalda qaysi rejim ko'rinyapti ("tizim" bo'lsa — qurilma sozlamasi) */
export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Sahifa chizilishidan OLDIN ishlaydigan skript (layout <head> ichida).
 * Bu bo'lmasa, tun rejimini tanlagan odam har yuklashda bir lahza oq
 * ekranni ko'radi (React hidratsiyasigacha).
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

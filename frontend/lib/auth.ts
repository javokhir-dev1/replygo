'use client';

const TOKEN_KEY = 'replygo_token';

/** SSR paytida localStorage yo'q — shuning uchun har safar tekshiramiz */
const hasWindow = () => typeof window !== 'undefined';

export const getToken = (): string | null =>
  hasWindow() ? window.localStorage.getItem(TOKEN_KEY) : null;

/** Token almashganda (login o'zgardi) — chap panel shu hodisani tinglaydi */
export const TOKEN_CHANGED = 'replygo:token-changed';

export const setToken = (token: string) => {
  if (!hasWindow()) return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event(TOKEN_CHANGED));
};

export const clearToken = () => {
  if (hasWindow()) window.localStorage.removeItem(TOKEN_KEY);
};

/**
 * Token bor-yo'qligini bilish uchun yengil tekshiruv.
 * Bu FAQAT UI uchun — haqiqiy tekshiruvni backend guard qiladi.
 * Muddati tugagan tokenni oldindan tashlab yuboramiz, keraksiz 401 bo'lmasin.
 */
export function hasValidToken(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
      clearToken();
      return false;
    }
    return true;
  } catch {
    // Buzuq token — tozalaymiz
    clearToken();
    return false;
  }
}

/** Token ichidagi login (faqat ko'rsatish uchun — imzo backend'da tekshiriladi) */
export function getUsername(): string | null {
  const token = getToken();
  if (!token) return null;
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64)).username ?? null;
  } catch {
    return null;
  }
}

/** Chiqish: tokenni o'chirib login sahifasiga qaytaramiz */
export function logout() {
  clearToken();
  if (hasWindow()) window.location.href = '/login';
}

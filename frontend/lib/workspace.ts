'use client';

/**
 * Ish maydonlari: panel ikki mustaqil bo'limga bo'lingan.
 * Har birining o'z menyusi va sahifalari bor; chap paneldagi almashtirgich
 * ular orasida o'tkazadi. Oxirgi tanlangan bo'lim shu brauzerda eslab qolinadi.
 */
export type Workspace = 'instagram' | 'telegram';

export const WORKSPACES: { id: Workspace; label: string; home: string }[] = [
  { id: 'instagram', label: 'Instagram', home: '/instagram' },
  { id: 'telegram', label: 'Telegram', home: '/telegram' },
];

const KEY = 'replygo_workspace';

export function workspaceOf(pathname: string): Workspace {
  return pathname.startsWith('/telegram') ? 'telegram' : 'instagram';
}

export function rememberWorkspace(ws: Workspace) {
  try {
    localStorage.setItem(KEY, ws);
  } catch {
    /* maxfiy rejim — eslab qolinmaydi, xolos */
  }
}

export function lastWorkspaceHome(): string {
  try {
    const ws = localStorage.getItem(KEY);
    return WORKSPACES.find((w) => w.id === ws)?.home ?? '/instagram';
  } catch {
    return '/instagram';
  }
}

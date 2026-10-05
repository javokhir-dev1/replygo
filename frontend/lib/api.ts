import { getToken, clearToken } from './auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/** Backend xatosidan o'qiladigan xabarni ajratib olamiz */
function parseErrorMessage(txt: string, status: number): string {
  try {
    const body = JSON.parse(txt);
    const msg = body?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
  } catch {
    /* JSON emas — xom matnni ishlatamiz */
  }
  return txt || `HTTP ${status}`;
}

async function req(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
    cache: 'no-store',
  });

  // Token yaroqsiz/muddati tugagan — tozalab, login sahifasiga qaytaramiz
  if (res.status === 401 && typeof window !== 'undefined') {
    clearToken();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Sessiya tugadi, qaytadan kiring');
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(parseErrorMessage(txt, res.status));
  }
  return res.status === 204 ? null : res.json();
}

/** Login — token hali yo'q, shuning uchun req() dan tashqarida */
export async function login(username: string, password: string): Promise<{ token: string }> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    cache: 'no-store',
  });
  const txt = await res.text().catch(() => '');
  if (!res.ok) throw new Error(parseErrorMessage(txt, res.status));
  return JSON.parse(txt);
}

/** Ro'yxatdan o'tish — muvaffaqiyatda darhol token qaytadi (alohida login shart emas) */
export async function register(username: string, password: string): Promise<{ token: string }> {
  const res = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    cache: 'no-store',
  });
  const txt = await res.text().catch(() => '');
  if (!res.ok) throw new Error(parseErrorMessage(txt, res.status));
  return JSON.parse(txt);
}

export const getMe = () => req('/api/auth/me');

/** Login/parolni o'zgartirish — har ikkisi yangi token qaytaradi */
export const changeUsername = (username: string, password: string): Promise<{ token: string; username: string }> =>
  req('/api/auth/username', { method: 'PATCH', body: JSON.stringify({ username, password }) });
export const changePassword = (currentPassword: string, newPassword: string): Promise<{ token: string }> =>
  req('/api/auth/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) });

export interface DmButton { title: string; url: string }
export interface Automation {
  id: number;
  name: string;
  triggerType: 'any' | 'keyword';
  keywords: string[];
  replyEnabled: boolean;
  replyTemplates: string[];
  dmEnabled: boolean;
  dmTemplates: string[];
  dmButtons: DmButton[];
  followCheckEnabled: boolean;
  followAskMessage: string;
  followAskButton: string;
  followFailMessage: string;
  followFailButton: string;
  postScope: 'all' | 'specific';
  postIds: string[];
  postData: { id: string; caption?: string; thumbnail?: string }[];
  isActive: boolean;
  createdAt: string;
}

export const getAutomations = (): Promise<Automation[]> => req('/api/automations');
export const createAutomation = (data: any) => req('/api/automations', { method: 'POST', body: JSON.stringify(data) });
export const updateAutomation = (id: number, data: any) => req(`/api/automations/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const toggleAutomation = (id: number) => req(`/api/automations/${id}/toggle`, { method: 'PATCH' });
export const deleteAutomation = (id: number) => req(`/api/automations/${id}`, { method: 'DELETE' });

export const getInstagramPosts = () => req('/api/instagram/posts');
export const getAccount = () => req('/api/instagram/account');
/** OAuth manzilini oladi — chaqiruvchi brauzerni shu yerga yo'naltiradi */
export const connectInstagram = (): Promise<{ url: string }> => req('/api/instagram/connect', { method: 'POST' });

/** Ulangan Instagram akkauntlar (bir nechta bo'lishi mumkin) */
export interface IgAccountBrief {
  id: number;
  igUserId: string;
  username: string | null;
  profile_picture_url: string | null;
  followers_count: number | null;
  status: string;
  lastError: string | null;
  active: boolean;
}
export const getAccounts = (): Promise<{ accounts: IgAccountBrief[]; canConnect: boolean }> => req('/api/instagram/accounts');
/** Akkauntni almashtirish — panel shu akkaunt bo'yicha ishlaydi */
export const selectAccount = (id: number) => req(`/api/instagram/accounts/${id}/select`, { method: 'POST' });
/** Uzish — qoidalar va statistika saqlanadi, qayta ulanganda qaytadi */
export const disconnectAccount = (id: number) => req(`/api/instagram/accounts/${id}`, { method: 'DELETE' });

export type DashboardRange = 'today' | '7d' | '30d';
export const getDashboard = (range: DashboardRange) => req(`/api/dashboard?range=${range}`);

export interface TelegramChatInfo { chatId: string; title: string | null; isActive: boolean }
export const telegramLink = (): Promise<{ url: string; expiresInSec: number }> => req('/api/telegram/link', { method: 'POST' });
export const unlinkTelegramChat = (chatId: string) =>
  req(`/api/telegram/chats/${encodeURIComponent(chatId)}`, { method: 'DELETE' });

export const getLogs = (limit = 100) => req(`/api/logs?limit=${limit}`);
export const clearLogs = () => req('/api/logs', { method: 'DELETE' });

export interface RuntimeSettings {
  perUserLimit: number;
  commentMinDelayMs: number;
  commentMaxDelayMs: number;
  dmBusyThreshold: number;
  dmMinDelayMs: number;
  dmMaxDelayMs: number;
  dmButtonMaxPresses: number;
  dmButtonWindowSec: number;
  telegramEnabled: boolean;
}
export type SettingsSource = 'system' | 'panel' | 'env' | 'default';
export interface SettingsResponse {
  values: RuntimeSettings;
  defaults: RuntimeSettings;
  sources: Record<keyof RuntimeSettings, SettingsSource>;
  updatedAt: string | null;
  telegram: {
    configured: boolean;
    connected: boolean;
    username: string | null;
    webAppUrl: string | null;
    chats: TelegramChatInfo[];
  };
}

export const getSettings = (): Promise<SettingsResponse> => req('/api/settings');
export const updateSettings = (data: Partial<RuntimeSettings>): Promise<SettingsResponse> =>
  req('/api/settings', { method: 'PUT', body: JSON.stringify(data) });
export const resetSettings = (): Promise<SettingsResponse> => req('/api/settings', { method: 'DELETE' });

/* ------------------------------ Postlarim ------------------------------ */

export type MediaKind = 'REELS' | 'FEED' | 'STORY';
export interface MediaItem {
  id: string;
  kind: MediaKind;
  mediaType: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  caption: string | null;
  thumbnail: string | null;
  permalink: string | null;
  timestamp: string;
  likeCount: number | null;
  commentsCount: number | null;
  /** views, reach, likes, comments, shares, saved, total_interactions, ig_reels_avg_watch_time (ms) ... */
  insights: Record<string, number> | null;
}

export const getMedia = (after?: string): Promise<{ connected: boolean; items: MediaItem[]; after: string | null }> =>
  req(`/api/instagram/media?limit=24${after ? `&after=${encodeURIComponent(after)}` : ''}`);
export const getStories = (): Promise<{ connected: boolean; items: MediaItem[] }> => req('/api/instagram/stories');
export const getIgOverview = (days: number) => req(`/api/instagram/overview?days=${days}`);

/* ------------------------- AI tahlil (Claude CLI) ------------------------- */

export type AiStatus = 'queued' | 'running' | 'done' | 'error';
export interface AiAnalysis {
  id: number;
  kind: 'media' | 'profile';
  mediaId: string | null;
  status: AiStatus;
  stage: string | null;
  result: any;
  meta: any;
  error: string | null;
  model: string | null;
  durationMs: number | null;
  createdAt: string;
  finishedAt: string | null;
}

export const getAiStatus = (): Promise<{ enabled: boolean }> => req('/api/ai/status');
export const startMediaAnalysis = (mediaId: string): Promise<AiAnalysis> =>
  req(`/api/ai/media/${encodeURIComponent(mediaId)}`, { method: 'POST' });
export const startProfileAnalysis = (): Promise<AiAnalysis> => req('/api/ai/profile', { method: 'POST' });
export const getAnalysis = (id: number): Promise<AiAnalysis> => req(`/api/ai/analyses/${id}`);
export const listAnalyses = (kind: 'media' | 'profile', mediaId?: string): Promise<AiAnalysis[]> =>
  req(`/api/ai/analyses?kind=${kind}${mediaId ? `&mediaId=${encodeURIComponent(mediaId)}` : ''}`);

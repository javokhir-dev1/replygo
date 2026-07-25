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

export const getMe = () => req('/api/auth/me');

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

export const getLogs = (limit = 100) => req(`/api/logs?limit=${limit}`);
export const clearLogs = () => req('/api/logs', { method: 'DELETE' });

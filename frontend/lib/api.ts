const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function req(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    cache: 'no-store',
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

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

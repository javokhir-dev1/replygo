import axios from 'axios';

const BASE_URL = 'https://api.telegram.org';

/**
 * Telegram rate-limit (429) xatosi.
 *
 * Instagram tomonidagi IgRateLimitError bilan bir xil naqsh: worker buni
 * ushlab, butun navbatni `retry_after` davomida pauza qiladi va jobni
 * FAILED hisoblamasdan qayta qo'yadi.
 */
export class TelegramRateLimitError extends Error {
  constructor(
    public readonly retryAfterMs: number,
    public readonly original?: any,
  ) {
    super(`Telegram rate limit (429), ${Math.round(retryAfterMs / 1000)}s kutiladi`);
    this.name = 'TelegramRateLimitError';
  }
}

/** Chat mavjud emas / bot bloklangan — qayta urinishning foydasi yo'q */
export class TelegramChatGoneError extends Error {
  constructor(
    public readonly chatId: string,
    public readonly description: string,
  ) {
    super(`Chat ${chatId} yaroqsiz: ${description}`);
    this.name = 'TelegramChatGoneError';
  }
}

const MAX_PAUSE_MS = 10 * 60_000; // xavfsizlik uchun eng ko'pi 10 daqiqa

/**
 * Bot API chaqiruvi.
 *
 * Telegram xatoni HTTP 200 ichida ham qaytarishi mumkin ({ok:false}),
 * shuning uchun validateStatus bilan barcha javoblarni o'zimiz tekshiramiz.
 */
export async function callTelegram<T = any>(
  token: string,
  method: string,
  payload: Record<string, any> = {},
  timeoutMs = 20_000,
): Promise<T> {
  const res = await axios.post(`${BASE_URL}/bot${token}/${method}`, payload, {
    timeout: timeoutMs,
    validateStatus: () => true,
  });

  const body = res.data;
  if (body?.ok) return body.result as T;

  const description: string = body?.description || `HTTP ${res.status}`;
  const code: number = body?.error_code ?? res.status;

  if (code === 429) {
    const secs = Number(body?.parameters?.retry_after);
    const ms = Number.isFinite(secs) && secs > 0 ? secs * 1000 : 60_000;
    throw new TelegramRateLimitError(Math.min(ms, MAX_PAUSE_MS), body);
  }

  // 403 = bot bloklangan yoki guruhdan chiqarilgan; 400 + "chat not found"
  if (code === 403 || /chat not found|group chat was upgraded/i.test(description)) {
    throw new TelegramChatGoneError(String(payload.chat_id ?? '?'), description);
  }

  throw new Error(`Telegram ${method}: ${description}`);
}

/** HTML parse_mode uchun — foydalanuvchi matni teg sifatida o'qilib ketmasin */
export function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

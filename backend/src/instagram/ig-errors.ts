/**
 * Instagram/Meta rate-limit (429 va tegishli error kodlari) uchun maxsus xato turi.
 * Bu xato navbatni pauza qilib, jobni qayta urinishga majbur qiladi.
 */
export class IgRateLimitError extends Error {
  constructor(
    public readonly retryAfterMs: number,
    public readonly original?: any,
  ) {
    super('Instagram rate limit (429)');
    this.name = 'IgRateLimitError';
  }
}

// Meta rate-limit (throttling) error kodlari — rasmiy hujjat bo'yicha.
// Platforma limitlari:
//   4   = ilova darajasidagi so'rov limiti
//   17  = foydalanuvchi darajasidagi so'rov limiti
//   32  = sahifa darajasidagi throttling (user token bilan)
//   613 = "Calls to this API have exceeded the rate limit"
// Business Use Case (BUC) limitlari:
//   80000 Ads Insights | 80004 Ads Management | 80003 Custom Audience
//   80002 Instagram    | 80006 Messenger      | 80005 LeadGen
//   80001 Page (page/system token) | 80008 WhatsApp
//   80009 Catalog Management | 80014 Catalog Batch
const RATE_LIMIT_CODES = new Set([
  4, 17, 32, 613, 80000, 80001, 80002, 80003, 80004, 80005, 80006, 80008, 80009, 80014,
]);

/** Xato rate-limit (429 yoki tegishli kod) ekanini aniqlaydi */
export function isRateLimitError(err: any): boolean {
  const status = err?.response?.status;
  if (status === 429) return true;
  const code = err?.response?.data?.error?.code;
  return typeof code === 'number' && RATE_LIMIT_CODES.has(code);
}

const MAX_PAUSE_MS = 60 * 60_000; // xavfsizlik uchun eng ko'pi 1 soat

/**
 * Meta qachon qayta ruxsat berishini header'lardan aniqlaydi:
 * 1) X-Business-Use-Case-Usage → estimated_time_to_regain_access (DAQIQADA)
 * 2) Retry-After (soniya) — agar bo'lsa
 * 3) fallback (default 60s)
 */
export function getRetryAfterMs(err: any, fallbackMs = 60_000): number {
  const headers = err?.response?.headers || {};

  // 1) BUC usage — asosiy manba
  const buc = headers['x-business-use-case-usage'];
  if (buc) {
    try {
      const parsed = typeof buc === 'string' ? JSON.parse(buc) : buc;
      let maxMinutes = 0;
      for (const key of Object.keys(parsed)) {
        for (const item of parsed[key] || []) {
          const m = Number(item?.estimated_time_to_regain_access);
          if (!Number.isNaN(m) && m > maxMinutes) maxMinutes = m;
        }
      }
      if (maxMinutes > 0) return Math.min(maxMinutes * 60_000, MAX_PAUSE_MS);
    } catch {
      /* JSON buzuq bo'lsa keyingi manbaga o'tamiz */
    }
  }

  // 2) Retry-After (soniya)
  const ra = headers['retry-after'];
  if (ra !== undefined) {
    const secs = Number(ra);
    if (!Number.isNaN(secs) && secs > 0) return Math.min(secs * 1000, MAX_PAUSE_MS);
  }

  // 3) default
  return fallbackMs;
}

/**
 * Header'lardagi ISH FOIZINI (0-100) qaytaradi — proaktiv sekinlashish uchun.
 * X-App-Usage (platforma) va X-Business-Use-Case-Usage (BUC) dagi
 * call_count / total_time / total_cputime dan eng kattasini oladi.
 */
export function getUsagePercent(headers: any): number {
  if (!headers) return 0;
  let max = 0;
  const consider = (o: any) => {
    if (!o) return;
    for (const k of ['call_count', 'total_time', 'total_cputime']) {
      const v = Number(o[k]);
      if (!Number.isNaN(v) && v > max) max = v;
    }
  };

  const appUsage = headers['x-app-usage'];
  if (appUsage) {
    try {
      consider(typeof appUsage === 'string' ? JSON.parse(appUsage) : appUsage);
    } catch {
      /* ignore */
    }
  }

  const buc = headers['x-business-use-case-usage'];
  if (buc) {
    try {
      const parsed = typeof buc === 'string' ? JSON.parse(buc) : buc;
      for (const key of Object.keys(parsed)) {
        for (const item of parsed[key] || []) consider(item);
      }
    } catch {
      /* ignore */
    }
  }

  return max;
}

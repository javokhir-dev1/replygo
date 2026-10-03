import * as crypto from 'crypto';

/**
 * Telegram WebApp initData tekshiruvi (rasmiy algoritm).
 *
 * Mini App brauzerda ochiladi, ya'ni manzilni kim bo'lsa ham bilib olishi
 * mumkin. Shuning uchun har bir so'rovda Telegram imzolagan `initData`
 * qatori yuboriladi va shu yerda tekshiriladi:
 *
 *   secret = HMAC_SHA256(key="WebAppData", msg=bot_token)
 *   hash   = HMAC_SHA256(key=secret, msg=data_check_string)
 *
 * data_check_string — `hash` dan boshqa barcha maydonlar "k=v" ko'rinishida,
 * alifbo tartibida, "\n" bilan birlashtirilgan.
 */
export interface InitDataUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface VerifiedInitData {
  ok: boolean;
  reason?: string;
  user?: InitDataUser;
  authDate?: Date;
}

// initData eskirgan bo'lsa qabul qilmaymiz — o'g'irlangan qator abadiy
// ishlayvermasin.
const MAX_AGE_MS = 24 * 3600_000;

export function verifyInitData(initData: string, botToken: string): VerifiedInitData {
  if (!initData) return { ok: false, reason: 'initData bo\'sh' };
  if (!botToken) return { ok: false, reason: 'bot tokeni sozlanmagan' };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'hash yo\'q' };

  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key !== 'hash') pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  const a = Buffer.from(hash, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'imzo mos kelmadi' };
  }

  const authDateRaw = Number(params.get('auth_date'));
  if (!Number.isFinite(authDateRaw)) return { ok: false, reason: 'auth_date yo\'q' };
  const authDate = new Date(authDateRaw * 1000);
  if (Date.now() - authDate.getTime() > MAX_AGE_MS) {
    return { ok: false, reason: 'initData eskirgan, ilovani qayta oching' };
  }

  let user: InitDataUser | undefined;
  const rawUser = params.get('user');
  if (rawUser) {
    try {
      user = JSON.parse(rawUser);
    } catch {
      return { ok: false, reason: 'user maydoni buzuq' };
    }
  }
  if (!user?.id) return { ok: false, reason: 'foydalanuvchi aniqlanmadi' };

  return { ok: true, user, authDate };
}

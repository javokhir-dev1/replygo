import * as crypto from 'crypto';

/**
 * Instagram tokenlarini bazada shifrlab saqlash (AES-256-GCM).
 *
 * Kalit: TOKEN_ENCRYPTION_KEY, berilmasa JWT_SECRET dan hosil qilinadi.
 * DIQQAT: kalit o'zgarsa saqlangan tokenlar ochilmay qoladi — foydalanuvchilar
 * Instagram'ni qayta ulashi kerak bo'ladi.
 */
function key(): Buffer {
  const material = process.env.TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!material) throw new Error('TOKEN_ENCRYPTION_KEY yoki JWT_SECRET sozlanmagan');
  return crypto.createHash('sha256').update('replygo-token-v1:' + material).digest();
}

export function seal(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
}

export function open(sealed: string): string {
  const [v, iv, tag, ct] = String(sealed || '').split(':');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Token formati noto\'g\'ri');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8');
}

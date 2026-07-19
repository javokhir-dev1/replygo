// Ikkita alohida navbat: kommentlar sekin/xavfsiz, DM'lar tez/mustaqil ishlaydi
export const COMMENTS_QUEUE = 'instagram-comments';
export const MESSAGING_QUEUE = 'instagram-messaging';

// Job nomlari (har navbatda bitta tur, lekin aniqlik uchun saqlanadi)
export const JOB_COMMENT = 'comment';
export const JOB_MESSAGING = 'messaging';

// Idempotentlik markerlari uchun Redis klienti DI tokeni
export const IG_REDIS = 'IG_REDIS';

/**
 * Proaktiv throttle darvozasi (bir jarayon ichida, xotirada).
 *
 * Instagram javob header'laridagi ish foizi (call_count/total_time/total_cputime)
 * yuqori bo'lsa, InstagramService bu darvozani yoqadi. Worker'lar har job'dan
 * oldin buni tekshiradi va navbatni vaqtincha to'xtatadi — Meta hujjatidagi
 * "kvota tugashidan oldin sekinlashing" tavsiyasi.
 */
let throttledUntil = 0;

/** Navbatni ms davomida sekinlashtirishni belgilaydi (uzunroq bo'lsa saqlaydi) */
export function setThrottle(ms: number): void {
  const until = Date.now() + ms;
  if (until > throttledUntil) throttledUntil = until;
}

/** Qancha vaqt sekinlashish qolganini (ms) qaytaradi; 0 = to'siq yo'q */
export function throttleRemainingMs(): number {
  return Math.max(0, throttledUntil - Date.now());
}

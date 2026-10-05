/**
 * ReplyGo belgisi: "R" harfi va chat pufakchasi (brend gradienti #7C3AED → #8B5CF6).
 *
 * Manba: public/brand/replygo-logo.png — shaffof fon, shuning uchun kun va tun
 * rejimida bir xil ishlaydi. Favicon va Apple ikonka app/ papkasida
 * (icon.png, apple-icon.png, favicon.ico) — Next.js ularni o'zi ulaydi.
 */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/replygo-logo.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      className="inline-block shrink-0 select-none"
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}

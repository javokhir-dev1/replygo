/**
 * ReplyGo belgisi: siyoh kvadrat ichida "javob" o'qi.
 * Rang tokenlardan olinadi — tungi rejimda o'zi teskari bo'ladi.
 */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-grid place-items-center shrink-0"
      style={{ width: size, height: size, borderRadius: size * 0.3, background: 'var(--accent)' }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <path
          d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
          stroke="var(--on-accent)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

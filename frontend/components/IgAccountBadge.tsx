'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Instagram, Plus } from 'lucide-react';
import { getAccount } from '@/lib/api';

/** Sozlamalarda ulash/uzishdan keyin shu hodisa yuboriladi — nishon yangilanadi */
export const ACCOUNT_CHANGED = 'replygo:ig-account-changed';
export const notifyAccountChanged = () => window.dispatchEvent(new Event(ACCOUNT_CHANGED));

/**
 * Ulangan Instagram akkaunt — Instagram bo'limining tepasida doim ko'rinadi.
 * Bosilsa sozlamalarga olib boradi (ulash, uzish, qayta ulash shu yerda).
 */
export function IgAccountBadge({ compact = false }: { compact?: boolean }) {
  const [acc, setAcc] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getAccount()
        .then((a) => alive && setAcc(a))
        .catch(() => alive && setAcc({ connected: false }));
    load();
    window.addEventListener(ACCOUNT_CHANGED, load);
    return () => {
      alive = false;
      window.removeEventListener(ACCOUNT_CHANGED, load);
    };
  }, []);

  if (!acc) {
    return compact ? <div className="skeleton h-7 w-28" /> : <div className="skeleton h-[52px]" />;
  }

  const broken = acc.connected && (acc.ok === false || acc.status === 'error');

  if (compact) {
    return (
      <Link href="/instagram/settings" className="inline-flex items-center gap-2 min-w-0 text-[13px]" title="Instagram akkaunt">
        {acc.connected ? (
          <>
            <Avatar url={acc.profile_picture_url} size={22} />
            <span className="font-medium truncate">@{acc.username ?? acc.igUserId}</span>
            <span className="dot" style={{ background: broken ? 'var(--crit)' : 'var(--good)' }} />
          </>
        ) : (
          <span className="text-[var(--muted)] inline-flex items-center gap-1.5">
            <Plus size={13} strokeWidth={2} /> Instagram&apos;ni ulash
          </span>
        )}
      </Link>
    );
  }

  return (
    <Link
      href="/instagram/settings"
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
        acc.connected
          ? 'hover:bg-[var(--sunken)]'
          : 'border border-dashed border-[var(--line-strong)] hover:border-[var(--ink-2)]'
      }`}
      title={acc.connected ? 'Akkaunt sozlamalari' : 'Instagram akkauntni ulash'}
    >
      {acc.connected ? (
        <>
          <Avatar url={acc.profile_picture_url} size={32} />
          <span className="flex-1 min-w-0">
            <span className="block text-[13.5px] font-medium truncate">@{acc.username ?? acc.igUserId}</span>
            <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--muted)] num">
              <span className="dot" style={{ background: broken ? 'var(--crit)' : 'var(--good)' }} />
              {broken
                ? 'Qayta ulash kerak'
                : acc.followers_count != null
                  ? `${Number(acc.followers_count).toLocaleString('uz-UZ')} obunachi`
                  : 'Ulangan'}
            </span>
          </span>
        </>
      ) : (
        <>
          <span className="grid place-items-center w-8 h-8 rounded-full bg-[var(--sunken)] shrink-0">
            <Instagram size={15} strokeWidth={1.75} className="text-[var(--muted)]" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-medium">Akkaunt ulanmagan</span>
            <span className="block text-[11.5px] text-[var(--muted)]">Ulash uchun bosing</span>
          </span>
        </>
      )}
    </Link>
  );
}

function Avatar({ url, size }: { url?: string | null; size: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  ) : (
    <span className="grid place-items-center rounded-full bg-[var(--sunken)] shrink-0" style={{ width: size, height: size }}>
      <Instagram size={size * 0.45} strokeWidth={1.75} className="text-[var(--muted)]" />
    </span>
  );
}

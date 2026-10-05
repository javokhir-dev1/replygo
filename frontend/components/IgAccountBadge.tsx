'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Instagram, Plus, Check, ChevronsUpDown, Settings2, Loader2 } from 'lucide-react';
import { getAccounts, selectAccount, connectInstagram, type IgAccountBrief } from '@/lib/api';

/** Sozlamalarda ulash/uzishdan keyin shu hodisa yuboriladi — almashtirgich yangilanadi */
export const ACCOUNT_CHANGED = 'replygo:ig-account-changed';
export const notifyAccountChanged = () => window.dispatchEvent(new Event(ACCOUNT_CHANGED));

/**
 * Instagram akkaunt almashtirgichi — Instagram bo'limining tepasida.
 *
 * Bosilganda menyu: barcha ulangan akkauntlar (tanlangani belgilangan),
 * "Akkaunt qo'shish" va "Boshqarish". Akkaunt almashtirilganda sahifa qayta
 * yuklanadi — qoidalar, dashboard va postlar yangi akkaunt bo'yicha olinadi.
 */
export function IgAccountBadge({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<{ accounts: IgAccountBrief[]; canConnect: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<number | 'add' | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getAccounts()
        .then((d) => alive && setData(d))
        .catch(() => alive && setData({ accounts: [], canConnect: false }));
    load();
    window.addEventListener(ACCOUNT_CHANGED, load);
    return () => {
      alive = false;
      window.removeEventListener(ACCOUNT_CHANGED, load);
    };
  }, []);

  // Tashqariga bosilsa yoki Esc — yopiladi
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => root.current && !root.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!data) return compact ? <div className="skeleton h-7 w-28" /> : <div className="skeleton h-[52px]" />;

  const active = data.accounts.find((a) => a.active) ?? null;

  const choose = async (a: IgAccountBrief) => {
    if (a.active) return setOpen(false);
    setBusy(a.id);
    try {
      await selectAccount(a.id);
      window.location.reload(); // barcha sahifa ma'lumotlari yangi akkaunt bo'yicha
    } catch {
      setBusy(null);
    }
  };

  const add = async () => {
    setBusy('add');
    try {
      const { url } = await connectInstagram();
      window.location.href = url;
    } catch {
      setBusy(null);
    }
  };

  // Hech qanday akkaunt yo'q — to'g'ridan-to'g'ri sozlamalarga
  if (!active) {
    return compact ? (
      <Link href="/instagram/settings" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--accent-ink)] font-medium">
        <Plus size={13} strokeWidth={2} /> Instagram&apos;ni ulash
      </Link>
    ) : (
      <Link
        href="/instagram/settings"
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 border border-dashed border-[var(--accent-line)] hover:bg-[var(--accent-soft)] transition-colors"
      >
        <span className="grid place-items-center w-8 h-8 rounded-full bg-[var(--accent-soft)] shrink-0">
          <Instagram size={15} strokeWidth={1.75} className="text-[var(--accent-ink)]" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-medium">Akkaunt ulanmagan</span>
          <span className="block text-[11.5px] text-[var(--muted)]">Ulash uchun bosing</span>
        </span>
      </Link>
    );
  }

  const broken = active.status === 'error';

  return (
    <div ref={root} className={`relative ${compact ? '' : 'w-full'}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Akkauntni almashtirish"
        className={
          compact
            ? 'inline-flex items-center gap-2 min-w-0 text-[13px] rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-[var(--accent-soft)]'
            : `w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${open ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--accent-soft)]'}`
        }
      >
        <Avatar url={active.profile_picture_url} size={compact ? 22 : 32} />
        {compact ? (
          <span className="font-medium truncate">@{active.username ?? active.igUserId}</span>
        ) : (
          <span className="flex-1 min-w-0">
            <span className="block text-[13.5px] font-medium truncate">@{active.username ?? active.igUserId}</span>
            <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--muted)] num">
              <span className="dot" style={{ background: broken ? 'var(--crit)' : 'var(--good)' }} />
              {broken
                ? 'Qayta ulash kerak'
                : active.followers_count != null
                  ? `${Number(active.followers_count).toLocaleString('uz-UZ')} obunachi`
                  : 'Ulangan'}
            </span>
          </span>
        )}
        <ChevronsUpDown size={14} strokeWidth={1.75} className="text-[var(--muted)] shrink-0" />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-30 mt-1.5 panel p-1.5 shadow-[0_12px_32px_-12px_rgba(76,29,149,.28)] ${compact ? 'left-0 w-[260px]' : 'left-0 right-0'}`}
        >
          <p className="eyebrow px-2.5 pt-1.5 pb-1">Akkauntlar</p>
          {data.accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              role="menuitemradio"
              aria-checked={a.active}
              onClick={() => choose(a)}
              disabled={busy !== null}
              className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--accent-soft)] disabled:opacity-60"
            >
              <Avatar url={a.profile_picture_url} size={26} />
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-medium truncate">@{a.username ?? a.igUserId}</span>
                <span className="block text-[11px] text-[var(--muted)] num">
                  {a.status === 'error' ? 'Qayta ulash kerak' : a.followers_count != null ? `${Number(a.followers_count).toLocaleString('uz-UZ')} obunachi` : 'Ulangan'}
                </span>
              </span>
              {busy === a.id ? (
                <Loader2 size={14} className="animate-spin text-[var(--muted)]" />
              ) : (
                a.active && <Check size={15} strokeWidth={2.25} className="text-[var(--accent-ink)]" />
              )}
            </button>
          ))}
          <div className="hairline my-1.5" />
          <button
            type="button"
            role="menuitem"
            onClick={add}
            disabled={busy !== null || !data.canConnect}
            className="w-full flex items-center gap-2.5 rounded-lg px-2.5 h-9 text-[13px] text-[var(--accent-ink)] font-medium hover:bg-[var(--accent-soft)] disabled:opacity-50"
          >
            {busy === 'add' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} strokeWidth={2} />}
            Akkaunt qo&apos;shish
          </button>
          <Link
            href="/instagram/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-2.5 h-9 text-[13px] text-[var(--ink-2)] hover:bg-[var(--accent-soft)]"
          >
            <Settings2 size={15} strokeWidth={1.75} /> Akkauntlarni boshqarish
          </Link>
        </div>
      )}
    </div>
  );
}

export function Avatar({ url, size }: { url?: string | null; size: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  ) : (
    <span className="grid place-items-center rounded-full bg-[var(--accent-soft)] shrink-0" style={{ width: size, height: size }}>
      <Instagram size={size * 0.45} strokeWidth={1.75} className="text-[var(--accent-ink)]" />
    </span>
  );
}

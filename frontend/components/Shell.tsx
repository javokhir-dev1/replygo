'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Loader2, Zap, ScrollText, SlidersHorizontal, Instagram, Send, LayoutGrid } from 'lucide-react';
import { hasValidToken, logout, getUsername, TOKEN_CHANGED } from '@/lib/auth';
import { Mark } from './Mark';
import { IgAccountBadge } from './IgAccountBadge';
import { WORKSPACES, workspaceOf, rememberWorkspace, type Workspace } from '@/lib/workspace';

/**
 * Panel qobig'i + kirish darvozasi.
 *
 * Muhim: bu tekshiruv FAQAT foydalanuvchi tajribasi uchun — kimdir uni
 * brauzerda chetlab o'tsa ham, ma'lumot ko'rmaydi, chunki backend'dagi
 * global guard har bir so'rovda tokenni talab qiladi.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Panel qobig'idan tashqarida turadigan sahifalar:
  //   /login, /register — hali token yo'q
  //   /tg    — Telegram Mini App; u yerda JWT emas, Telegram initData imzosi
  //            tekshiriladi, shuning uchun login darvozasiga tushmasligi kerak
  const isBare = pathname === '/login' || pathname === '/register' || pathname === '/tg';
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (isBare) {
      setReady(true);
      return;
    }
    if (hasValidToken()) {
      setUsername(getUsername());
      setReady(true);
    } else {
      router.replace('/login');
    }
  }, [isBare, pathname, router]);

  // Login sozlamalarda o'zgarsa — chap paneldagi nom ham yangilansin
  useEffect(() => {
    const sync = () => setUsername(getUsername());
    window.addEventListener(TOKEN_CHANGED, sync);
    return () => window.removeEventListener(TOKEN_CHANGED, sync);
  }, []);

  const ws = workspaceOf(pathname);
  useEffect(() => {
    if (!isBare) rememberWorkspace(ws);
  }, [ws, isBare]);

  // Login va Mini App — o'z sahifa tartibiga ega, qobiqsiz
  if (isBare) {
    return <main className="flex-1 w-full">{children}</main>;
  }

  // Tekshiruv tugamaguncha kontentni ko'rsatmaymiz (miltillashning oldini oladi)
  if (!ready) {
    return (
      <div className="flex-1 grid place-items-center">
        <Loader2 size={18} strokeWidth={1.75} className="animate-spin text-[var(--muted)]" />
      </div>
    );
  }

  // Har bo'limning o'z menyusi — almashtirganda butunlay almashadi
  const NAV: Record<Workspace, { href: string; label: string; Icon: typeof Zap }[]> = {
    instagram: [
      { href: '/instagram', label: 'Avtomatizatsiya', Icon: Zap },
      { href: '/instagram/logs', label: 'Loglar', Icon: ScrollText },
      { href: '/instagram/settings', label: 'Sozlamalar', Icon: SlidersHorizontal },
    ],
    telegram: [{ href: '/telegram', label: 'Umumiy', Icon: LayoutGrid }],
  };
  const WS_ICON: Record<Workspace, typeof Zap> = { instagram: Instagram, telegram: Send };
  const nav = NAV[ws];
  const home = WORKSPACES.find((w) => w.id === ws)!.home;
  // Bo'lim bosh sahifasi aniq mos kelsin, ichki sahifalar esa prefiks bo'yicha
  const isActive = (href: string) => (href === home ? pathname === href : pathname.startsWith(href));

  /** Instagram | Telegram almashtirgichi */
  const switcher = (compact = false) => (
    <div className="seg" role="tablist" aria-label="Bo'lim">
      {WORKSPACES.map((w) => {
        const Icon = WS_ICON[w.id];
        return (
          <Link
            key={w.id}
            href={w.home}
            role="tab"
            aria-selected={ws === w.id}
            data-on={ws === w.id}
            className={`h-8 rounded-lg inline-flex items-center justify-center gap-1.5 font-medium transition-colors ${
              compact ? 'text-[12.5px]' : 'text-[13px]'
            } ${ws === w.id ? 'bg-[var(--surface)] text-[var(--ink)] shadow-[0_0_0_1px_var(--line),0_1px_2px_rgba(0,0,0,.04)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
          >
            <Icon size={14} strokeWidth={1.75} />
            {w.label}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col md:flex-row">
      {/* Chap panel (planshet va keng ekran) */}
      <aside className="hidden md:flex w-[240px] shrink-0 flex-col border-r border-[var(--line)] sticky top-0 h-screen px-3 py-5">
        <Link href="/" className="flex items-center gap-2.5 px-3 text-[15px] font-semibold tracking-[-0.01em]">
          <Mark size={22} />
          ReplyGo
        </Link>

        <div className="mt-6">{switcher()}</div>

        {ws === 'instagram' && (
          <div className="mt-4">
            <IgAccountBadge />
          </div>
        )}

        <p className="eyebrow px-3 mt-7 mb-2">{ws === 'instagram' ? 'Instagram' : 'Telegram'}</p>
        <nav className="flex flex-col gap-0.5">
          {nav.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 h-9 px-3 rounded-[9px] text-[13.5px] transition-colors ${
                  active
                    ? 'bg-[var(--sunken)] text-[var(--ink)] font-medium'
                    : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--sunken)]'
                }`}
              >
                <Icon size={15} strokeWidth={active ? 2 : 1.75} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-[var(--line)] flex items-center gap-2.5 px-2">
          <span
            aria-hidden
            className="grid place-items-center w-7 h-7 rounded-full bg-[var(--sunken)] text-[12px] font-semibold uppercase text-[var(--ink-2)]"
          >
            {username?.[0] ?? '?'}
          </span>
          <span className="flex-1 min-w-0 text-[13px] font-medium truncate">{username}</span>
          <button onClick={logout} title="Chiqish" aria-label="Chiqish" className="icon-btn">
            <LogOut size={15} strokeWidth={1.75} />
          </button>
        </div>
      </aside>

      {/* Telefon: yuqori panel */}
      <header
        className="md:hidden sticky top-0 z-20 border-b border-[var(--line)] backdrop-blur-md"
        style={{ background: 'color-mix(in srgb, var(--bg) 85%, transparent)' }}
      >
        <div className="flex items-center gap-3 h-12 px-5">
          <Link href="/" aria-label="ReplyGo" className="shrink-0">
            <Mark size={20} />
          </Link>
          <div className="flex-1 max-w-[260px]">{switcher(true)}</div>
          <button onClick={logout} title="Chiqish" aria-label="Chiqish" className="icon-btn -mr-2 ml-auto">
            <LogOut size={15} strokeWidth={1.75} />
          </button>
        </div>
        {ws === 'instagram' && (
          <div className="flex items-center px-5 h-10 border-t border-[var(--line)]">
            <IgAccountBadge compact />
          </div>
        )}
        <nav className="flex gap-5 px-5 h-10 text-[13px] overflow-x-auto border-t border-[var(--line)]">
          {nav.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative h-full inline-flex items-center whitespace-nowrap ${
                  active ? 'text-[var(--ink)] font-medium' : 'text-[var(--muted)]'
                }`}
              >
                {label}
                {active && <span className="absolute left-0 right-0 -bottom-px h-px bg-[var(--ink)]" />}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 min-w-0">
        <div className="wrap pt-8 md:pt-12 pb-20">{children}</div>
      </main>
    </div>
  );
}

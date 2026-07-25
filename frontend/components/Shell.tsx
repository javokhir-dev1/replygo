'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Zap, ScrollText, LogOut, Loader2 } from 'lucide-react';
import { hasValidToken, logout } from '@/lib/auth';

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
  const isLoginPage = pathname === '/login';
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLoginPage) {
      setReady(true);
      return;
    }
    if (hasValidToken()) {
      setReady(true);
    } else {
      router.replace('/login');
    }
  }, [isLoginPage, pathname, router]);

  // Login sahifasi — header'siz, toza ko'rinish
  if (isLoginPage) {
    return <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">{children}</main>;
  }

  // Tekshiruv tugamaguncha kontentni ko'rsatmaymiz (miltillashning oldini oladi)
  if (!ready) {
    return (
      <div className="flex-1 grid place-items-center">
        <Loader2 size={22} className="animate-spin text-[var(--muted)]" />
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-[var(--border)]">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <span
              className="grid place-items-center w-8 h-8 rounded-lg text-white"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#8B5CF6)' }}
            >
              <Zap size={16} />
            </span>
            ReplyGo
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-lg hover:bg-[var(--bg)] flex items-center gap-1.5"
            >
              <Zap size={14} /> Avtomatizatsiya
            </Link>
            <Link
              href="/logs"
              className="px-3 py-1.5 rounded-lg hover:bg-[var(--bg)] flex items-center gap-1.5"
            >
              <ScrollText size={14} /> Loglar
            </Link>
            <button
              onClick={logout}
              title="Chiqish"
              aria-label="Chiqish"
              className="px-3 py-1.5 rounded-lg hover:bg-[var(--bg)] flex items-center gap-1.5 text-[var(--muted)]"
            >
              <LogOut size={14} />
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">{children}</main>
    </>
  );
}

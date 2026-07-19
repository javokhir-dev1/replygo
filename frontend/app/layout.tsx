import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Zap, ScrollText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'ReplyGo',
  description: 'Instagram komment/DM avtomatizatsiyasi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-[var(--border)]">
            <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2 font-bold text-lg">
                <span className="grid place-items-center w-8 h-8 rounded-lg text-white" style={{ background: 'linear-gradient(135deg,#7C3AED,#8B5CF6)' }}>
                  <Zap size={16} />
                </span>
                ReplyGo
              </Link>
              <nav className="flex items-center gap-1 text-sm">
                <Link href="/" className="px-3 py-1.5 rounded-lg hover:bg-[var(--bg)] flex items-center gap-1.5">
                  <Zap size={14} /> Avtomatizatsiya
                </Link>
                <Link href="/logs" className="px-3 py-1.5 rounded-lg hover:bg-[var(--bg)] flex items-center gap-1.5">
                  <ScrollText size={14} /> Loglar
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}

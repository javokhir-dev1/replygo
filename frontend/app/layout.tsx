import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Shell } from '@/components/Shell';
import { THEME_BOOT_SCRIPT } from '@/lib/theme';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'ReplyGo',
  description: 'Instagram komment/DM avtomatizatsiyasi',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf8ff' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0a12' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: data-theme ni boot-skript React'dan oldin qo'yadi
    <html lang="uz" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <div className="min-h-screen flex flex-col">
          <Shell>{children}</Shell>
        </div>
      </body>
    </html>
  );
}

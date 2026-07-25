import './globals.css';
import type { Metadata } from 'next';
import { Shell } from '@/components/Shell';

export const metadata: Metadata = {
  title: 'ReplyGo',
  description: 'Instagram komment/DM avtomatizatsiyasi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>
        <div className="min-h-screen flex flex-col">
          <Shell>{children}</Shell>
        </div>
      </body>
    </html>
  );
}

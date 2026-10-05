'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Mark } from '@/components/Mark';
import { ThemeToggle } from '@/components/ThemeToggle';
import { login } from '@/lib/api';
import { setToken, hasValidToken } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Allaqachon kirgan bo'lsa — panelga
  useEffect(() => {
    if (hasValidToken()) router.replace('/');
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await login(username.trim(), password);
      setToken(res.token);
      // replace: brauzer "orqaga" tugmasi login sahifasiga qaytarmasin
      router.replace('/');
    } catch (err: any) {
      setError(err.message || "Kirishda xato yuz berdi");
      setPassword('');
      setBusy(false);
    }
  };

  return (
    <div className="brand-glow relative min-h-screen flex items-center justify-center px-5">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-[340px]">
        <Mark size={32} />
        <h1 className="title mt-8">Xush kelibsiz</h1>
        <p className="subtitle mt-1.5">ReplyGo paneliga kirish</p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="username" className="label">Login</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="field"
            />
          </div>

          <div>
            <label htmlFor="password" className="label">Parol</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
            />
          </div>

          {error && (
            <p role="alert" className="text-[13px] text-[var(--crit)]">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn btn-primary w-full !h-10 !mt-6">
            {busy && <Loader2 size={15} strokeWidth={2} className="animate-spin" />}
            {busy ? 'Tekshirilmoqda…' : 'Kirish'}
          </button>
        </form>

        <p className="subtitle mt-8">
          Akkauntingiz yo&apos;qmi?{' '}
          <Link href="/register" className="text-[var(--ink)] font-medium underline underline-offset-4 decoration-[var(--line-strong)] hover:decoration-[var(--ink)]">
            Ro&apos;yxatdan o&apos;tish
          </Link>
        </p>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Lock, User, Loader2 } from 'lucide-react';
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
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <span
            className="grid place-items-center w-12 h-12 rounded-xl text-white mb-3"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#8B5CF6)' }}
          >
            <Zap size={22} />
          </span>
          <h1 className="text-xl font-bold">ReplyGo</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Panelga kirish</p>
        </div>

        <form
          onSubmit={submit}
          className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-4"
        >
          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-1.5">
              Login
            </label>
            <div className="relative">
              <User
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              />
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                autoFocus
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[var(--border)] bg-white outline-none focus:border-[var(--primary)] transition-colors"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1.5">
              Parol
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              />
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[var(--border)] bg-white outline-none focus:border-[var(--primary)] transition-colors"
              />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-lg text-white font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#8B5CF6)' }}
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? 'Tekshirilmoqda...' : 'Kirish'}
          </button>
        </form>

        <p className="text-xs text-[var(--muted)] text-center mt-4">
          Login va parol backend <code>.env</code> faylida sozlanadi
        </p>
      </div>
    </div>
  );
}

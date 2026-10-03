'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { register } from '@/lib/api';
import { setToken, hasValidToken } from '@/lib/auth';
import { Mark } from '@/components/Mark';

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,32}$/;

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hasValidToken()) router.replace('/');
  }, [router]);

  // Serverga yubormasdan oldin aniq xatolarni shu yerda ko'rsatamiz
  const problem =
    username && !USERNAME_RE.test(username)
      ? "Login 3–32 belgi: lotin harflari, raqam, _ va ."
      : password && password.length < 8
        ? 'Parol kamida 8 belgi'
        : confirm && confirm !== password
          ? 'Parollar mos emas'
          : null;
  const ready = USERNAME_RE.test(username) && password.length >= 8 && confirm === password;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !ready) return;
    setError(null);
    setBusy(true);
    try {
      const res = await register(username.trim(), password);
      setToken(res.token);
      // Yangi foydalanuvchi — avval Instagram'ni ulash kerak
      router.replace('/instagram/settings?welcome=1');
    } catch (err: any) {
      setError(err.message || "Ro'yxatdan o'tishda xato");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-[340px]">
        <Mark size={32} />
        <h1 className="title mt-8">Akkaunt yaratish</h1>
        <p className="subtitle mt-1.5">Keyingi qadamda Instagram akkauntingizni ulaysiz.</p>

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
              name="new-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="label">Parolni takrorlang</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="field"
            />
          </div>

          {(error || problem) && (
            <p role="alert" className={`text-[13px] ${error ? 'text-[var(--crit)]' : 'text-[var(--muted)]'}`}>
              {error || problem}
            </p>
          )}

          <button type="submit" disabled={busy || !ready} className="btn btn-primary w-full !h-10 !mt-6">
            {busy && <Loader2 size={15} strokeWidth={2} className="animate-spin" />}
            {busy ? 'Yaratilmoqda…' : "Ro'yxatdan o'tish"}
          </button>
        </form>

        <p className="subtitle mt-8">
          Akkauntingiz bormi?{' '}
          <Link href="/login" className="text-[var(--ink)] font-medium underline underline-offset-4 decoration-[var(--line-strong)] hover:decoration-[var(--ink)]">
            Kirish
          </Link>
        </p>
      </div>
    </div>
  );
}

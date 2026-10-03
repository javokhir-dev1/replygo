'use client';

import { useEffect, useState } from 'react';
import { Monitor, Sun, Moon, Instagram } from 'lucide-react';
import { getAccount, connectInstagram, disconnectInstagram, changeUsername, changePassword } from '@/lib/api';
import { Section } from '@/components/ui';
import { notifyAccountChanged } from '@/components/IgAccountBadge';
import { getTheme, setTheme, type ThemeMode } from '@/lib/theme';
import { getUsername, setToken } from '@/lib/auth';

/**
 * Sozlamalar: ko'rinish, Instagram akkaunt va ReplyGo akkaunti (login/parol).
 *
 * Tezlik va limitlar bu yerda yo'q — ular tizim sozlamalari (bazada,
 * keyinchalik admin panelidan boshqariladi).
 */

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,32}$/;

export default function SettingsPage() {
  const [account, setAccount] = useState<any>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [welcome, setWelcome] = useState(false);
  const [igBusy, setIgBusy] = useState(false);
  const [theme, setThemeState] = useState<ThemeMode>('system');

  useEffect(() => {
    setThemeState(getTheme());
    getAccount().then(setAccount).catch(() => setAccount({ connected: false }));

    // Instagram OAuth'dan qaytish (?ig=connected | ?ig_error=...) va yangi foydalanuvchi.
    // useSearchParams o'rniga window — statik build'da Suspense talab qilmasin.
    const q = new URLSearchParams(window.location.search);
    if (q.get('ig') === 'connected') setNotice({ ok: true, text: `Instagram ulandi${q.get('u') ? `: @${q.get('u')}` : ''}` });
    if (q.get('ig_error')) setNotice({ ok: false, text: `Instagram ulanmadi: ${q.get('ig_error')}` });
    if (q.get('welcome')) setWelcome(true);
    if (q.toString()) window.history.replaceState(null, '', '/instagram/settings');
  }, []);

  const onConnectIg = async () => {
    setIgBusy(true);
    setNotice(null);
    try {
      const { url } = await connectInstagram();
      window.location.href = url; // Instagram'ga — qaytganda ?ig=connected bilan keladi
    } catch (e: any) {
      setNotice({ ok: false, text: e.message });
      setIgBusy(false);
    }
  };

  const onDisconnectIg = async () => {
    if (!confirm(`@${account?.username ?? 'akkaunt'} uzilsinmi? Bot bu akkauntga javob berishni to'xtatadi.`)) return;
    setIgBusy(true);
    try {
      await disconnectInstagram();
      setAccount({ connected: false, canConnect: account?.canConnect });
      setNotice({ ok: true, text: 'Instagram uzildi' });
      notifyAccountChanged();
    } catch (e: any) {
      setNotice({ ok: false, text: e.message });
    } finally {
      setIgBusy(false);
    }
  };

  // Ko'rinish — darhol qo'llanadi (faqat shu brauzer)
  const chooseTheme = (mode: ThemeMode) => {
    setTheme(mode);
    setThemeState(mode);
  };

  return (
    <div>
      <div>
        <p className="eyebrow">Instagram</p>
        <h1 className="title mt-2">Sozlamalar</h1>
        <p className="subtitle mt-1.5">Akkauntlar va ko&apos;rinish.</p>
      </div>

      {welcome && !account?.connected && (
        <div className="panel mt-6 p-5">
          <p className="text-[14px] font-medium">Xush kelibsiz! Oxirgi qadam qoldi</p>
          <p className="subtitle mt-1">Bot ishlashi uchun Instagram akkauntingizni pastdagi «Instagram bilan ulash» orqali ulang.</p>
        </div>
      )}

      {notice && (
        <p role="status" className={`mt-4 text-[13px] ${notice.ok ? 'text-[var(--ink-2)]' : 'text-[var(--crit)]'}`}>
          {notice.ok ? '✓ ' : ''}{notice.text}
        </p>
      )}

      <div className="mt-8 hairline">
          <Section
            title="Instagram"
            desc="Bot shu akkauntdagi kommentlarga javob beradi va DM yuboradi."
          >
            {!account ? (
              <div className="skeleton h-16" />
            ) : account.connected ? (
              <div className="panel p-4 flex items-center gap-4">
                {account.profile_picture_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={account.profile_picture_url} alt="" className="w-11 h-11 rounded-full object-cover" />
                ) : (
                  <span className="grid place-items-center w-11 h-11 rounded-full bg-[var(--sunken)]">
                    <Instagram size={18} strokeWidth={1.75} className="text-[var(--muted)]" />
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[14.5px] font-medium truncate">@{account.username ?? account.igUserId}</p>
                  <p className="text-[12.5px] text-[var(--muted)] mt-0.5 flex items-center gap-1.5 num">
                    <span className="dot" style={{ background: account.ok === false || account.status === 'error' ? 'var(--crit)' : 'var(--good)' }} />
                    {account.ok === false || account.status === 'error'
                      ? 'Token ishlamayapti — qayta ulang'
                      : [
                          account.followers_count != null && `${account.followers_count} obunachi`,
                        ].filter(Boolean).join(' · ') || 'Ulangan'}
                  </p>
                </div>
                {(account.ok === false || account.status === 'error') && account.canConnect && (
                  <button onClick={onConnectIg} disabled={igBusy} className="btn btn-outline">Qayta ulash</button>
                )}
                <button onClick={onDisconnectIg} disabled={igBusy} className="btn btn-danger">Uzish</button>
              </div>
            ) : (
              <div className="panel p-5">
                <p className="text-[14px] font-medium">Akkaunt ulanmagan</p>
                <p className="subtitle mt-1 leading-relaxed">
                  Instagram professional (Business yoki Creator) akkaunt kerak. Siz Instagram sahifasiga
                  o&apos;tasiz, ruxsat berasiz va shu yerga qaytasiz — parolingiz bizga kelmaydi.
                </p>
                <button onClick={onConnectIg} disabled={igBusy || !account.canConnect} className="btn btn-primary mt-4">
                  <Instagram size={15} strokeWidth={1.75} />
                  {igBusy ? 'Yo\'naltirilmoqda…' : 'Instagram bilan ulash'}
                </button>
                {!account.canConnect && (
                  <p className="text-[12.5px] text-[var(--crit)] mt-3">
                    Server tomonida Instagram ilovasi sozlanmagan (INSTAGRAM_APP_ID). Administratorga murojaat qiling.
                  </p>
                )}
              </div>
            )}
          </Section>

          <Section title="Akkaunt" desc="ReplyGo'ga kirish uchun login va parol. Instagram akkauntidan alohida.">
            <div className="space-y-8">
              <UsernameForm />
              <div className="hairline pt-8">
                <PasswordForm />
              </div>
            </div>
          </Section>

          <Section title="Ko'rinish" desc="Faqat shu qurilma uchun. Darhol qo'llanadi.">
            <div className="seg max-w-[360px]" role="radiogroup" aria-label="Ko'rinish rejimi">
              {([
                ['system', 'Tizim', Monitor],
                ['light', 'Kun', Sun],
                ['dark', 'Tun', Moon],
              ] as const).map(([mode, label, Icon]) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={theme === mode}
                  data-on={theme === mode}
                  onClick={() => chooseTheme(mode)}
                >
                  <Icon size={14} strokeWidth={1.75} /> {label}
                </button>
              ))}
            </div>
          </Section>
      </div>
    </div>
  );
}

/** Natija qatori — formalar ostida */
function Result({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p role="status" className={`text-[13px] ${msg.ok ? 'text-[var(--ink-2)]' : 'text-[var(--crit)]'}`}>
      {msg.ok ? '✓ ' : ''}{msg.text}
    </p>
  );
}

function UsernameForm() {
  const [current, setCurrent] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const u = getUsername();
    setCurrent(u);
    setUsername(u ?? '');
  }, []);

  const normalized = username.trim().toLowerCase();
  const changed = !!current && normalized !== current;
  const valid = USERNAME_RE.test(username.trim());
  const ready = changed && valid && password.length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await changeUsername(username.trim(), password);
      setToken(res.token); // token ichidagi login yangilanadi
      setCurrent(res.username);
      setUsername(res.username);
      setPassword('');
      setMsg({ ok: true, text: `Login o'zgardi: ${res.username}` });
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-[14px] font-medium">Login</p>
      <div>
        <label htmlFor="new-username" className="label">Yangi login</label>
        <input
          id="new-username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          onChange={(e) => { setUsername(e.target.value); setMsg(null); }}
          className="field max-w-[320px]"
        />
        {username && !valid && (
          <p className="text-[12.5px] text-[var(--muted)] mt-1.5">3–32 belgi: lotin harflari, raqam, _ va .</p>
        )}
      </div>
      {changed && valid && (
        <div>
          <label htmlFor="username-confirm" className="label">Joriy parol</label>
          <input
            id="username-confirm"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field max-w-[320px]"
          />
        </div>
      )}
      <Result msg={msg} />
      <button type="submit" disabled={!ready || busy} className="btn btn-outline">
        {busy ? 'Saqlanmoqda…' : 'Loginni saqlash'}
      </button>
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const problem =
    next && next.length < 8
      ? 'Yangi parol kamida 8 belgi'
      : confirm && confirm !== next
        ? 'Parollar mos emas'
        : next && current && next === current
          ? 'Yangi parol eskisidan farq qilsin'
          : null;
  const ready = current.length > 0 && next.length >= 8 && confirm === next && next !== current;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await changePassword(current, next);
      setToken(res.token); // shu qurilma kirgan holicha qoladi
      setCurrent('');
      setNext('');
      setConfirm('');
      setMsg({ ok: true, text: "Parol o'zgardi. Boshqa qurilmalardagi sessiyalar yopildi." });
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-[14px] font-medium">Parol</p>
      {/* Parol menejerlari formani to'g'ri taniy olishi uchun yashirin login maydoni */}
      <input type="text" name="username" autoComplete="username" value={getUsername() ?? ''} readOnly hidden />
      <div>
        <label htmlFor="pw-current" className="label">Joriy parol</label>
        <input id="pw-current" type="password" autoComplete="current-password" value={current}
          onChange={(e) => { setCurrent(e.target.value); setMsg(null); }} className="field max-w-[320px]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 max-w-[656px]">
        <div>
          <label htmlFor="pw-new" className="label">Yangi parol</label>
          <input id="pw-new" type="password" autoComplete="new-password" value={next}
            onChange={(e) => { setNext(e.target.value); setMsg(null); }} className="field" />
        </div>
        <div>
          <label htmlFor="pw-confirm" className="label">Yangi parolni takrorlang</label>
          <input id="pw-confirm" type="password" autoComplete="new-password" value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setMsg(null); }} className="field" />
        </div>
      </div>
      {problem && <p className="text-[12.5px] text-[var(--muted)]">{problem}</p>}
      <Result msg={msg} />
      <button type="submit" disabled={!ready || busy} className="btn btn-outline">
        {busy ? 'Saqlanmoqda…' : "Parolni o'zgartirish"}
      </button>
    </form>
  );
}

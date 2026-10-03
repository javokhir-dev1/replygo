'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * Telegram Mini App — ReplyGo statistikasi.
 *
 * Bu sahifa panel JWT'sini ISHLATMAYDI. Telegram imzolagan `initData` qatori
 * backendga yuboriladi, u yerda HMAC bilan tekshiriladi va faqat botga
 * /start yuborgan foydalanuvchiga ruxsat beriladi. Shuning uchun Shell
 * darvozasidan chetlab o'tadi (components/Shell.tsx dagi isBare).
 */

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Status ranglari (dataviz qo'llanmasidagi tasdiqlangan qiymatlar).
// Mavzuga qarab o'zgarmaydi va HAR DOIM ikonka + yozuv bilan birga keladi —
// rang yolg'iz ma'no tashimasligi kerak.
const GOOD = '#0ca30c';
const CRIT = '#d03b3b';

interface Stats {
  totals: { all: number; success: number; error: number; successRate: number };
  today: { all: number; success: number; error: number };
  week: { all: number; success: number; error: number };
  byAction: { action: string; success: number; error: number }[];
  daily: { day: string; success: number; error: number }[];
  automations: { total: number; active: number };
  recent: {
    id: number; type: string; action: string;
    user: string | null; userMessage: string | null;
    message: string | null; createdAt: string;
  }[];
}

export default function TelegramStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [who, setWho] = useState<string | null>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.async = true;
    script.onload = () => void load();
    script.onerror = () => setError('Telegram skriptini yuklab bo\'lmadi');
    document.head.appendChild(script);

    async function load() {
      const tg = (window as any).Telegram?.WebApp;
      if (!tg) {
        setError('Bu sahifa Telegram ilovasi ichida ochilishi kerak');
        return;
      }
      tg.ready();
      tg.expand();

      try {
        const res = await fetch(`${API}/api/telegram/stats`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: tg.initData }),
          cache: 'no-store',
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setError(body?.message || `Xato (HTTP ${res.status})`);
          return;
        }
        setStats(body.stats);
        setWho(body.user?.username ?? null);
      } catch (e: any) {
        setError(e.message || 'Serverga ulanib bo\'lmadi');
      }
    }
  }, []);

  return (
    <div className="tg">
      <style>{`
        .tg {
          --bg: var(--tg-theme-bg-color, #fafaf9);
          --fg: var(--tg-theme-text-color, #0b0b0b);
          --hint: var(--tg-theme-hint-color, #8b8b86);
          --card: var(--tg-theme-secondary-bg-color, #f2f2f0);
          --sep: color-mix(in srgb, var(--hint) 22%, transparent);
          background: var(--bg); color: var(--fg); min-height: 100vh;
          padding: 28px 20px 40px;
          font-family: var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 14px; line-height: 1.45;
        }
        .tg .num { font-variant-numeric: tabular-nums; }
        .tg-eyebrow { font-size: 11px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; color: var(--hint); }
        .tg-title { font-size: 22px; font-weight: 600; letter-spacing: -0.025em; margin-top: 6px; }
        .tg-sub { font-size: 13px; color: var(--hint); margin-top: 4px; }
        .tg-h { font-size: 11px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase;
                color: var(--hint); margin: 32px 0 12px; }
        .tg-tiles { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 24px;
                    border-top: 1px solid var(--sep); border-bottom: 1px solid var(--sep); }
        .tg-tile { padding: 16px 0; }
        .tg-tile + .tg-tile { padding-left: 14px; border-left: 1px solid var(--sep); }
        .tg-tile .n { font-size: 26px; font-weight: 600; letter-spacing: -0.03em; line-height: 1.1; }
        .tg-tile .l { font-size: 12px; color: var(--hint); margin-top: 4px; }
        .tg-legend { display: flex; gap: 16px; font-size: 12px; color: var(--hint); margin-bottom: 12px; }
        .tg-legend i { width: 8px; height: 8px; border-radius: 2px; display: inline-block; margin-right: 6px; vertical-align: 0; }
        .tg-chart { display: flex; align-items: flex-end; gap: 4px; height: 132px; }
        .tg-col { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; height: 100%; gap: 2px; }
        .tg-bar { border-radius: 2px; min-height: 2px; }
        .tg-bar.top { border-radius: 4px 4px 2px 2px; }
        .tg-empty { height: 2px; background: var(--sep); border-radius: 2px; }
        .tg-d { font-size: 9.5px; color: var(--hint); text-align: center; margin-top: 6px; }
        .tg-list > * + * { border-top: 1px solid var(--sep); }
        .tg-item { padding: 14px 0; }
        .tg-line { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .tg-line .k { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .tg-dot { width: 6px; height: 6px; border-radius: 999px; flex-shrink: 0; }
        .tg-who { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tg-tm { font-size: 12px; color: var(--hint); white-space: nowrap; }
        .tg-q { color: var(--hint); font-size: 13px; margin: 6px 0 0 14px; word-break: break-word; }
        .tg-a { font-size: 13px; margin: 3px 0 0 14px; word-break: break-word; }
        .tg-act { display: flex; justify-content: space-between; padding: 12px 0; font-size: 13.5px; }
        .tg-muted { color: var(--hint); font-size: 13px; }
      `}</style>

      {error && (
        <div>
          <p className="tg-eyebrow">ReplyGo</p>
          <h1 className="tg-title">Ochib bo&apos;lmadi</h1>
          <p className="tg-sub">{error}</p>
        </div>
      )}

      {!error && !stats && <p className="tg-muted">Yuklanmoqda…</p>}

      {stats && (
        <>
          <p className="tg-eyebrow">ReplyGo{who ? ` · @${who}` : ''}</p>
          <h1 className="tg-title">Statistika</h1>
          <p className="tg-sub num">
            {stats.automations.active} ta faol qoida · jami {stats.automations.total}
          </p>

          <div className="tg-tiles">
            <Tile n={stats.totals.all} l="Jami javob" />
            <Tile n={`${stats.totals.successRate}%`} l="Muvaffaqiyat" />
            <Tile n={stats.today.all} l="Bugun" />
          </div>

          <h2 className="tg-h">Oxirgi 14 kun</h2>
          <Legend />
          <DailyChart daily={stats.daily} />

          <h2 className="tg-h">Amal turlari</h2>
          {stats.byAction.length === 0 ? (
            <p className="tg-muted">Hali ma&apos;lumot yo&apos;q</p>
          ) : (
            <div className="tg-list">
              {stats.byAction.map((a) => (
                <div className="tg-act" key={a.action}>
                  <span>{a.action}</span>
                  <span className="num">
                    <span style={{ color: GOOD }}>✓ {a.success}</span>
                    {a.error > 0 && <span style={{ color: CRIT, marginLeft: 12 }}>✕ {a.error}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}

          <h2 className="tg-h">Oxirgi javoblar</h2>
          {stats.recent.length === 0 ? (
            <p className="tg-muted">Hali javob berilmagan</p>
          ) : (
            <div className="tg-list">
              {stats.recent.map((r) => {
                const ok = r.type === 'success';
                return (
                  <div className="tg-item" key={r.id}>
                    <div className="tg-line">
                      <span className="k">
                        <span className="tg-dot" style={{ background: ok ? GOOD : CRIT }} aria-label={ok ? 'muvaffaqiyatli' : 'xato'} />
                        <span className="tg-who">{r.user ? `@${r.user}` : r.action}</span>
                      </span>
                      <span className="tg-tm num">{fmtTime(r.createdAt)}</span>
                    </div>
                    {r.userMessage && <div className="tg-q">“{r.userMessage}”</div>}
                    {r.message && (
                      <div className="tg-a" style={ok ? undefined : { color: CRIT }}>
                        {ok ? '↳ ' : ''}{r.message}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="tg-muted num" style={{ marginTop: 28 }}>
            Jami {stats.totals.success} muvaffaqiyatli · {stats.totals.error} xato
          </p>
        </>
      )}
    </div>
  );
}

function Tile({ n, l }: { n: number | string; l: string }) {
  return (
    <div className="tg-tile">
      <div className="n num">{n}</div>
      <div className="l">{l}</div>
    </div>
  );
}

/** Ikki qatorli ma'lumot uchun afsona doim ko'rinadi — rang yolg'iz qolmasin */
function Legend() {
  return (
    <div className="tg-legend">
      <span><i style={{ background: GOOD }} />Muvaffaqiyatli</span>
      <span><i style={{ background: CRIT }} />Xato</span>
    </div>
  );
}

function DailyChart({ daily }: { daily: Stats['daily'] }) {
  // Bo'sh kunlar ham ko'rinsin — 14 kunlik to'liq o'q
  const days = useMemo(() => {
    const map = new Map(daily.map((d) => [d.day, d]));
    const out: { day: string; success: number; error: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const hit = map.get(key);
      out.push({ day: key, success: hit?.success ?? 0, error: hit?.error ?? 0 });
    }
    return out;
  }, [daily]);

  const max = Math.max(1, ...days.map((d) => d.success + d.error));

  return (
    <div className="tg-chart">
      {days.map((d) => {
        const total = d.success + d.error;
        const pct = (v: number) => (v / max) * 100;
        return (
          <div
            className="tg-col"
            key={d.day}
            title={`${d.day.slice(5)} — ${d.success} muvaffaqiyatli, ${d.error} xato`}
          >
            {total === 0 ? (
              <div className="tg-empty" />
            ) : (
              <>
                {d.error > 0 && (
                  <div
                    className="tg-bar top"
                    style={{ height: `${pct(d.error)}%`, background: CRIT }}
                  />
                )}
                {d.success > 0 && (
                  <div
                    className={d.error > 0 ? 'tg-bar' : 'tg-bar top'}
                    style={{ height: `${pct(d.success)}%`, background: GOOD }}
                  />
                )}
              </>
            )}
            <div className="tg-d num">{d.day.slice(8)}</div>
          </div>
        );
      })}
    </div>
  );
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('uz-UZ', {
      timeZone: 'Asia/Tashkent',
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

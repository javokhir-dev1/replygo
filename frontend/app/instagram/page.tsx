'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight, ArrowRight, Instagram, ExternalLink, AlertTriangle } from 'lucide-react';
import { getDashboard, type DashboardRange } from '@/lib/api';

/**
 * Dashboard — tanlangan Instagram akkaunt statistikasi.
 *
 * Ma'lumot: GET /api/dashboard?range=… (backend: dashboard.service.ts).
 * Grafik ranglari globals.css dagi --series-* va --heat-* tokenlaridan —
 * dataviz validator bilan tekshirilgan; xato rangi doim yorliq bilan.
 */

const RANGES: { id: DashboardRange; label: string }[] = [
  { id: 'today', label: 'Bugun' },
  { id: '7d', label: '7 kun' },
  { id: '30d', label: '30 kun' },
];
const RANGE_KEY = 'replygo_dash_range';
const DOW = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const DOW_FULL = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
const fmt = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('uz-UZ'));

/** "03.10 17:20" — Toshkent vaqti. uz-UZ lokali oy-kun tartibida ("10-03") chiqargani uchun qo'lda */
function fmtTime(iso: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${parts.day}.${parts.month} ${parts.hour}:${parts.minute}`;
}

export default function DashboardPage() {
  const [range, setRange] = useState<DashboardRange>('7d');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RANGE_KEY) as DashboardRange | null;
      if (saved && RANGES.some((r) => r.id === saved)) setRange(saved);
    } catch {
      /* maxfiy rejim */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    getDashboard(range)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [range]);

  const choose = (r: DashboardRange) => {
    setRange(r);
    try {
      localStorage.setItem(RANGE_KEY, r);
    } catch {
      /* maxfiy rejim */
    }
  };

  const periodWord = range === 'today' ? 'kechaga' : range === '7d' ? 'oldingi 7 kunga' : 'oldingi 30 kunga';

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Instagram{data?.account?.username ? ` · @${data.account.username}` : ''}</p>
          <h1 className="title mt-2">Dashboard</h1>
          <p className="subtitle mt-1.5">Bot faoliyati va natijalari.</p>
        </div>
        <div className="seg w-[260px]" role="tablist" aria-label="Davr">
          {RANGES.map((r) => (
            <button key={r.id} type="button" role="tab" aria-selected={range === r.id} data-on={range === r.id} onClick={() => choose(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="mt-6 text-[13px] text-[var(--crit)]">{error}</p>}

      {!data && !error && <Skeleton />}

      {data && !data.connected && (
        <Link href="/instagram/settings" className="panel mt-8 p-5 flex items-center gap-4 group hover:border-[var(--accent-line)] transition-colors">
          <span className="grid place-items-center w-10 h-10 rounded-full bg-[var(--accent-soft)]">
            <Instagram size={18} strokeWidth={1.75} className="text-[var(--accent-ink)]" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[14px] font-medium">Instagram akkauntingizni ulang</span>
            <span className="block subtitle mt-0.5">Statistika ulangan akkaunt bo&apos;yicha ko&apos;rsatiladi.</span>
          </span>
          <ArrowRight size={16} strokeWidth={1.75} className="text-[var(--muted)] group-hover:text-[var(--accent-ink)]" />
        </Link>
      )}

      {data?.connected && (
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {/* 1. Asosiy ko'rsatkichlar */}
          <div className="lg:col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="Javob berilgan kommentlar" k={data.kpis.replies} periodWord={periodWord} />
            <Kpi label="Yuborilgan DM'lar" k={data.kpis.dms} periodWord={periodWord} />
            <Kpi
              label="Muvaffaqiyat darajasi"
              k={{ value: data.kpis.successRate.value, prev: data.kpis.successRate.prev }}
              suffix="%"
              points
              periodWord={periodWord}
              note={data.kpis.successRate.total ? `${fmt(data.kpis.successRate.total)} ta amaldan` : undefined}
            />
            <Kpi label="Yangi odamlar" k={data.kpis.newPeople} periodWord={periodWord} />
          </div>

          {/* 2. Faollik + obunachilar */}
          <Card title="Faollik" desc={range === 'today' ? 'Soatlar bo\'yicha' : 'Kunlar bo\'yicha'} className="lg:col-span-2">
            <ActivityChart series={data.series} />
          </Card>
          <Card title="Obunachilar">
            <Followers f={data.followers} />
          </Card>

          {/* 3. Qachon faol + voronka */}
          <Card title="Qachon faol" desc="Kommentlar hafta kuni va soat bo'yicha" className="lg:col-span-2">
            <Heatmap cells={data.heatmap} />
          </Card>
          <Card title="Obuna voronkasi" desc="Majburiy obuna yoqilgan qoidalar">
            <Funnel f={data.funnel} />
          </Card>

          {/* 4. Qoidalar + postlar */}
          <Card title="Qoidalar bo'yicha" className="lg:col-span-2" action={<Link href="/instagram/automations" className="link">Qoidalar <ArrowRight size={12} /></Link>}>
            <ByAutomation rows={data.byAutomation} />
          </Card>
          <Card title="Postlar bo'yicha" desc="Eng ko'p komment kelganlar">
            <ByPost rows={data.byPost} />
          </Card>

          {/* 5. Faol foydalanuvchilar + xatolar */}
          <Card title="Eng faol foydalanuvchilar" className="lg:col-span-2">
            <TopUsers rows={data.topUsers} />
          </Card>
          <Card title="Xatolar">
            <Errors e={data.errors} />
          </Card>

          {/* 6. So'nggi faoliyat */}
          <Card title="So'nggi faoliyat" desc="Oxirgi 10 ta amal" className="lg:col-span-3">
            <Recent rows={data.recent} />
          </Card>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ qismlar ------------------------------ */

function Card({ title, desc, action, className = '', children }: { title: string; desc?: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={`panel p-5 min-w-0 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[14px] font-medium">{title}</h2>
          {desc && <p className="text-[12px] text-[var(--muted)] mt-0.5">{desc}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-[13px] text-[var(--muted)] py-6 text-center">{text}</p>;
}

function Skeleton() {
  return (
    <div className="mt-8 grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[104px]" />)}
      </div>
      <div className="skeleton h-[280px] lg:col-span-2" />
      <div className="skeleton h-[280px]" />
    </div>
  );
}

/** KPI: katta raqam + oldingi davrga nisbatan o'zgarish (ikonka + yozuv, rang yolg'iz emas) */
function Kpi({ label, k, suffix = '', points = false, note, periodWord }: { label: string; k: { value: number | null; prev: number | null; change?: number | null }; suffix?: string; points?: boolean; note?: string; periodWord: string }) {
  // foiz ko'rsatkichida o'zgarish — punktlarda; qolganlarida — foizda
  const delta = points
    ? k.value != null && k.prev != null ? k.value - k.prev : null
    : k.change ?? null;
  const up = delta != null && delta > 0;
  return (
    <div className="panel p-5">
      <p className="text-[12.5px] text-[var(--muted)]">{label}</p>
      <p className="text-[28px] font-semibold tracking-[-0.03em] mt-2 num leading-none">
        {k.value == null ? '—' : `${fmt(k.value)}${suffix}`}
      </p>
      <p className="text-[12px] mt-2.5 flex items-center gap-1 num min-h-[18px]">
        {delta == null ? (
          <span className="text-[var(--muted)]">{note ?? (k.prev === 0 && k.value ? "oldingi davrda yo'q" : '—')}</span>
        ) : delta === 0 ? (
          <span className="text-[var(--muted)]">o&apos;zgarishsiz · {periodWord} nisbatan</span>
        ) : (
          <>
            <span className="inline-flex items-center gap-0.5 font-medium" style={{ color: up ? 'var(--good)' : 'var(--crit)' }}>
              {up ? <ArrowUpRight size={13} strokeWidth={2.25} /> : <ArrowDownRight size={13} strokeWidth={2.25} />}
              {up ? '+' : ''}{delta}{points ? ' p.' : '%'}
            </span>
            <span className="text-[var(--muted)]">{periodWord} nisbatan</span>
          </>
        )}
      </p>
    </div>
  );
}

/* ---------------------- faollik: ustunli grafik ---------------------- */

const SERIES = [
  { key: 'replies', label: 'Javob', color: 'var(--series-reply)' },
  { key: 'dms', label: 'DM', color: 'var(--series-dm)' },
  { key: 'errors', label: 'Xato', color: 'var(--series-error)' },
] as const;

function bucketLabel(bucket: string, unit: string) {
  return unit === 'hour' ? `${bucket.slice(11, 13)}:00` : `${bucket.slice(8, 10)}.${bucket.slice(5, 7)}`;
}

function ActivityChart({ series }: { series: { unit: string; points: { bucket: string; replies: number; dms: number; errors: number }[] } }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = series.points;
  const totals = pts.map((p) => p.replies + p.dms + p.errors);
  const max = Math.max(...totals, 0);
  if (max === 0) return <Empty text="Bu davrda faollik bo'lmadi" />;

  // Chiroyli o'q: 1-2-5 qadam bilan yuqori chegara
  const niceMax = (() => {
    const pow = 10 ** Math.floor(Math.log10(max));
    const step = [1, 2, 5, 10].find((s) => s * pow >= max / 4) ?? 10;
    return Math.ceil(max / (step * pow)) * step * pow;
  })();
  const ticks = [0, niceMax / 2, niceMax];
  const labelEvery = pts.length > 14 ? Math.ceil(pts.length / 6) : pts.length > 8 ? 2 : 1;
  const H = 180;

  return (
    <div>
      <Legend />
      <div className="relative mt-3 pl-8" onMouseLeave={() => setHover(null)}>
        {/* yo'naltiruvchi chiziqlar va o'q yozuvlari — ataylab xira */}
        {ticks.map((t) => (
          <div key={t} className="absolute left-8 right-0 border-t border-[var(--line)]" style={{ bottom: 22 + (t / niceMax) * H }}>
            <span className="absolute -left-8 -translate-y-1/2 w-6 text-right text-[10.5px] text-[var(--muted)] num">{fmt(t)}</span>
          </div>
        ))}
        <div className="relative flex items-end gap-[3px]" style={{ height: H + 22 }}>
          {pts.map((p, i) => {
            const segs = SERIES.map((s) => ({ ...s, v: (p as any)[s.key] as number })).filter((s) => s.v > 0);
            return (
              <div
                key={p.bucket}
                className="relative flex-1 h-full flex flex-col justify-end pb-[22px] cursor-default"
                onMouseEnter={() => setHover(i)}
              >
                {/* hover — butun ustun bo'yi (nishon belgisidan katta) */}
                {hover === i && <div className="absolute inset-x-[-1px] top-0 bottom-[22px] rounded-md bg-[var(--accent-soft)]" />}
                <div className="relative flex flex-col-reverse gap-[2px] mx-auto w-full max-w-[22px]">
                  {segs.map((s, j) => (
                    <div
                      key={s.key}
                      style={{
                        height: Math.max(2, (s.v / niceMax) * H - 2),
                        background: s.color,
                        borderRadius: j === segs.length - 1 ? '4px 4px 1px 1px' : 1,
                      }}
                    />
                  ))}
                </div>
                {i % labelEvery === 0 && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10.5px] text-[var(--muted)] whitespace-nowrap num">
                    {bucketLabel(p.bucket, series.unit)}
                  </span>
                )}
                {hover === i && <Tooltip point={p} unit={series.unit} alignRight={i > pts.length * 0.6} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--ink-2)]">
      {SERIES.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <i className="inline-block w-2.5 h-2.5 rounded-[3px]" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function Tooltip({ point, unit, alignRight }: { point: any; unit: string; alignRight: boolean }) {
  return (
    <div
      role="tooltip"
      className={`absolute z-10 top-0 ${alignRight ? 'right-1/2' : 'left-1/2'} panel px-3 py-2.5 shadow-[0_8px_24px_-8px_rgba(76,29,149,.3)] text-[12px] whitespace-nowrap pointer-events-none`}
    >
      <p className="font-medium mb-1.5 num">{unit === 'hour' ? `Bugun, ${bucketLabel(point.bucket, unit)}` : bucketLabel(point.bucket, unit)}</p>
      {SERIES.map((s) => (
        <p key={s.key} className="flex items-center gap-2 num">
          <i className="inline-block w-2 h-2 rounded-[2px]" style={{ background: s.color }} />
          <span className="text-[var(--ink-2)] w-12">{s.label}</span>
          <span className="font-medium ml-auto">{fmt(point[s.key])}</span>
        </p>
      ))}
    </div>
  );
}

/* --------------------------- obunachilar --------------------------- */

function Followers({ f }: { f: { current: number | null; delta: number | null; series: { day: string; value: number }[]; since: string } }) {
  const [hover, setHover] = useState<number | null>(null);
  const s = f.series.filter((p) => p.value != null);
  return (
    <div>
      <p className="text-[28px] font-semibold tracking-[-0.03em] num leading-none">{fmt(f.current)}</p>
      <p className="text-[12px] mt-2 num flex items-center gap-1">
        {f.delta == null ? (
          <span className="text-[var(--muted)]">O&apos;zgarish hali hisoblanmagan</span>
        ) : (
          <>
            <span className="inline-flex items-center gap-0.5 font-medium" style={{ color: f.delta >= 0 ? 'var(--good)' : 'var(--crit)' }}>
              {f.delta >= 0 ? <ArrowUpRight size={13} strokeWidth={2.25} /> : <ArrowDownRight size={13} strokeWidth={2.25} />}
              {f.delta > 0 ? '+' : ''}{fmt(f.delta)}
            </span>
            <span className="text-[var(--muted)]">{f.since.slice(8, 10)}.{f.since.slice(5, 7)} dan beri</span>
          </>
        )}
      </p>
      {s.length >= 2 ? (
        <Sparkline points={s} hover={hover} setHover={setHover} />
      ) : (
        <p className="text-[12px] text-[var(--muted)] mt-6 leading-relaxed">
          Grafik uchun kunlik ma&apos;lumot yig&apos;ilmoqda — har kuni bitta nuqta qo&apos;shiladi.
        </p>
      )}
    </div>
  );
}

function Sparkline({ points, hover, setHover }: { points: { day: string; value: number }[]; hover: number | null; setHover: (i: number | null) => void }) {
  const W = 300, H = 90, P = 6;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const xy = points.map((p, i) => [P + (i / (points.length - 1)) * (W - 2 * P), P + (1 - (p.value - min) / span) * (H - 2 * P)]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <div className="relative mt-5" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[90px] overflow-visible" preserveAspectRatio="none" aria-label="Obunachilar soni grafigi">
        <path d={d} fill="none" stroke="var(--series-reply)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {hover != null && <line x1={xy[hover][0]} x2={xy[hover][0]} y1={0} y2={H} stroke="var(--line-strong)" vectorEffect="non-scaling-stroke" />}
      </svg>
      {/* nuqtalar ustidagi ko'rinmas hover maydonlari */}
      <div className="absolute inset-0 flex">
        {points.map((p, i) => (
          <div key={p.day} className="flex-1" onMouseEnter={() => setHover(i)} />
        ))}
      </div>
      {hover != null && (
        <div className="absolute -top-9 panel px-2.5 py-1.5 text-[12px] num pointer-events-none whitespace-nowrap" style={{ left: `${(xy[hover][0] / W) * 100}%`, transform: 'translateX(-50%)' }}>
          {points[hover].day.slice(8, 10)}.{points[hover].day.slice(5, 7)} · <b>{fmt(points[hover].value)}</b>
        </div>
      )}
    </div>
  );
}

/* --------------------------- issiqlik xaritasi --------------------------- */

function Heatmap({ cells }: { cells: { dow: number; hour: number; n: number }[] }) {
  const [hover, setHover] = useState<{ d: number; h: number; n: number } | null>(null);
  const grid = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
    for (const c of cells) g[c.dow - 1][c.hour] = c.n;
    return g;
  }, [cells]);
  const max = Math.max(0, ...cells.map((c) => c.n));
  if (max === 0) return <Empty text="Bu davrda komment bo'lmadi" />;
  const level = (n: number) => (n === 0 ? 0 : Math.min(5, Math.ceil((n / max) * 5)));
  const color = (l: number) => (l === 0 ? 'var(--sunken)' : `var(--heat-${l})`);

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          {grid.map((row, d) => (
            <div key={d} className="flex items-center gap-[3px] mb-[3px]">
              <span className="w-7 text-[10.5px] text-[var(--muted)] shrink-0">{DOW[d]}</span>
              {row.map((n, h) => (
                <div
                  key={h}
                  className="flex-1 aspect-square rounded-[3px] cursor-default"
                  style={{ background: color(level(n)), outline: hover?.d === d && hover?.h === h ? '2px solid var(--ink)' : undefined, outlineOffset: 1 }}
                  onMouseEnter={() => setHover({ d, h, n })}
                  onMouseLeave={() => setHover(null)}
                  aria-label={`${DOW_FULL[d]} ${h}:00 — ${n} ta komment`}
                />
              ))}
            </div>
          ))}
          <div className="flex gap-[3px] pl-7">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="flex-1 text-center text-[10px] text-[var(--muted)] num">{h % 6 === 0 ? h : ''}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-[12px]">
        <span className="text-[var(--ink-2)] num min-h-[18px]">
          {hover ? <>{DOW_FULL[hover.d]}, {String(hover.h).padStart(2, '0')}:00 — <b>{hover.n}</b> ta komment</> : <span className="text-[var(--muted)]">Katak ustiga olib boring</span>}
        </span>
        <span className="inline-flex items-center gap-1 text-[var(--muted)]">
          Kam
          {[1, 2, 3, 4, 5].map((l) => <i key={l} className="inline-block w-3 h-3 rounded-[3px]" style={{ background: color(l) }} />)}
          Ko&apos;p
        </span>
      </div>
    </div>
  );
}

/* ------------------------------ voronka ------------------------------ */

function Funnel({ f }: { f: { asked: number; converted: number; rate: number | null } }) {
  if (!f.asked) return <Empty text="Bu davrda obuna so'rovi yuborilmadi" />;
  const steps = [
    { label: "So'rov yuborildi", v: f.asked },
    { label: 'Obuna tasdiqlanib DM oldi', v: f.converted },
  ];
  return (
    <div>
      <p className="text-[28px] font-semibold tracking-[-0.03em] num leading-none">{f.rate}%</p>
      <p className="text-[12px] text-[var(--muted)] mt-2">konversiya</p>
      <div className="mt-5 space-y-3.5">
        {steps.map((s) => (
          <div key={s.label}>
            <div className="flex justify-between text-[12.5px] mb-1.5">
              <span className="text-[var(--ink-2)]">{s.label}</span>
              <span className="font-medium num">{fmt(s.v)}</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--sunken)] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(s.v / f.asked) * 100}%`, background: 'var(--series-reply)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------ qoidalar / postlar ------------------------ */

function ByAutomation({ rows }: { rows: { id: number; name: string; isActive: boolean; replies: number; dms: number; errors: number }[] }) {
  if (!rows.length) return <Empty text="Bu davrda qoidalar ishlamadi" />;
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-[13px] num">
        <thead>
          <tr className="text-[11.5px] text-[var(--muted)] text-left">
            <th className="font-normal px-1 pb-2">Qoida</th>
            <th className="font-normal px-1 pb-2 text-right">Javob</th>
            <th className="font-normal px-1 pb-2 text-right">DM</th>
            <th className="font-normal px-1 pb-2 text-right">Xato</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[var(--line)]">
              <td className="px-1 py-2.5 max-w-[240px]">
                <span className="truncate block">{r.name}</span>
                {!r.isActive && <span className="text-[11px] text-[var(--muted)]">o&apos;chiq</span>}
              </td>
              <td className="px-1 py-2.5 text-right">{fmt(r.replies)}</td>
              <td className="px-1 py-2.5 text-right">{fmt(r.dms)}</td>
              <td className="px-1 py-2.5 text-right" style={r.errors ? { color: 'var(--crit)' } : undefined}>{fmt(r.errors)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ByPost({ rows }: { rows: { mediaId: string; comments: number; handled: number; caption?: string | null; thumbnail?: string | null; permalink?: string | null }[] }) {
  if (!rows.length) return <Empty text="Bu davrda postlarga komment kelmadi" />;
  return (
    <div className="rows -my-1">
      {rows.map((p) => (
        <div key={p.mediaId} className="flex items-center gap-3 py-2.5">
          {p.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.thumbnail} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" />
          ) : (
            <span className="grid place-items-center w-11 h-11 rounded-lg bg-[var(--accent-soft)] shrink-0">
              <Instagram size={15} strokeWidth={1.75} className="text-[var(--accent-ink)]" />
            </span>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] truncate">{p.caption || 'Post'}</p>
            <p className="text-[12px] text-[var(--muted)] num">{fmt(p.comments)} komment · {fmt(p.handled)} javob</p>
          </div>
          {p.permalink && (
            <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="icon-btn" aria-label="Postni Instagram'da ochish" title="Instagram'da ochish">
              <ExternalLink size={14} strokeWidth={1.75} />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------------- foydalanuvchilar / xatolar ---------------------- */

function TopUsers({ rows }: { rows: { user: string; comments: number; handled: number }[] }) {
  if (!rows.length) return <Empty text="Bu davrda faol foydalanuvchi yo'q" />;
  const max = Math.max(...rows.map((r) => r.comments), 1);
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={r.user} className="flex items-center gap-3">
          <span className="w-4 text-[12px] text-[var(--muted)] num">{i + 1}</span>
          <span className="w-24 sm:w-44 truncate text-[13px]">@{r.user}</span>
          <div className="flex-1 min-w-[48px] h-2 rounded-full bg-[var(--sunken)] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(r.comments / max) * 100}%`, background: 'var(--series-reply)' }} />
          </div>
          <span className="w-[76px] sm:w-24 text-right text-[12.5px] num whitespace-nowrap">
            <b className="font-medium">{fmt(r.comments)}</b> <span className="text-[var(--muted)]">komment</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function Errors({ e }: { e: { total: number; reasons: { reason: string; count: number }[] } }) {
  if (!e.total) {
    return (
      <div className="py-4">
        <p className="text-[28px] font-semibold tracking-[-0.03em] num leading-none">0</p>
        <p className="text-[12px] mt-2 flex items-center gap-1.5" style={{ color: 'var(--good)' }}>
          <span className="dot" style={{ background: 'var(--good)' }} /> Bu davrda xato bo&apos;lmadi
        </p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-[28px] font-semibold tracking-[-0.03em] num leading-none flex items-center gap-2">
        {fmt(e.total)}
        <AlertTriangle size={18} strokeWidth={2} style={{ color: 'var(--crit)' }} aria-label="xato" />
      </p>
      <div className="mt-5 space-y-3">
        {e.reasons.map((r) => (
          <div key={r.reason}>
            <div className="flex justify-between gap-3 text-[12.5px] mb-1.5">
              <span className="text-[var(--ink-2)] truncate">{r.reason}</span>
              <span className="font-medium num">{fmt(r.count)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--sunken)] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(r.count / e.total) * 100}%`, background: 'var(--series-error)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------- so'nggi faoliyat ---------------------------- */

function Recent({ rows }: { rows: { id: number; type: string; action: string; user: string | null; userMessage: string | null; message: string | null; createdAt: string }[] }) {
  if (!rows.length) return <Empty text="Hali faoliyat yo'q" />;
  return (
    <div className="rows -my-1">
      {rows.map((r) => {
        const ok = r.type === 'success';
        return (
          <div key={r.id} className="py-3 flex gap-3">
            <span className="dot mt-[7px]" style={{ background: ok ? 'var(--good)' : 'var(--crit)' }} aria-label={ok ? 'muvaffaqiyatli' : 'xato'} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="font-medium">{r.action}</span>
                {r.user && <span className="text-[var(--muted)] truncate">@{r.user}</span>}
                <span className="ml-auto text-[12px] text-[var(--muted)] whitespace-nowrap num">
                  {fmtTime(r.createdAt)}
                </span>
              </div>
              {r.userMessage && <p className="text-[12.5px] text-[var(--muted)] mt-0.5 truncate">“{r.userMessage}”</p>}
              {r.message && <p className={`text-[12.5px] mt-0.5 truncate ${ok ? 'text-[var(--ink-2)]' : 'text-[var(--crit)]'}`}>{ok ? '↳ ' : ''}{r.message}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Instagram, ExternalLink, Eye, Heart, MessageCircle, Share2, Bookmark, X, Play, Images as ImagesIcon, Sparkles,
} from 'lucide-react';
import { getMedia, getStories, getIgOverview, startMediaAnalysis, type MediaItem, type MediaKind } from '@/lib/api';
import { useAiEnabled, useAnalysis, AnalysisProgress, AnalysisError, MediaReport } from '@/components/AiReports';

/**
 * Postlarim — tanlangan Instagram akkauntning kontenti va uning statistikasi.
 *
 * Ma'lumot: /api/instagram/{overview,media,stories} (backend: instagram-media.service.ts).
 * Statistika har post uchun Instagram'dan alohida olinadi va backendda 10 daqiqa
 * keshlanadi. Istoriyalar — faqat faol (oxirgi 24 soat): Instagram API arxivni bermaydi.
 */

type Tab = 'all' | 'REELS' | 'FEED' | 'STORY';
type Sort = 'new' | 'views' | 'likes';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'Barchasi' },
  { id: 'REELS', label: 'Reels' },
  { id: 'FEED', label: 'Postlar' },
  { id: 'STORY', label: 'Istoriyalar' },
];
const SORTS: { id: Sort; label: string }[] = [
  { id: 'new', label: 'Yangi' },
  { id: 'views', label: "Ko'p ko'rilgan" },
  { id: 'likes', label: "Ko'p layk" },
];
const PERIODS = [7, 30];

const fmt = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('uz-UZ'));
const compact = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('uz-UZ', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const views = (m: MediaItem) => m.insights?.views ?? null;
const likes = (m: MediaItem) => m.insights?.likes ?? m.likeCount ?? null;
const comments = (m: MediaItem) => m.insights?.comments ?? m.commentsCount ?? null;

function fmtDate(iso: string, withTime = false) {
  return new Date(iso).toLocaleString('uz-UZ', {
    timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

/** ms → "13,8 s" yoki "1 daq 05 s" */
function duration(ms: number | null | undefined) {
  if (ms == null) return '—';
  const s = ms / 1000;
  if (s < 60) return `${s.toLocaleString('uz-UZ', { maximumFractionDigits: 1 })} s`;
  const m = Math.floor(s / 60);
  return `${m} daq ${String(Math.round(s % 60)).padStart(2, '0')} s`;
}

/** ms → umumiy tomosha vaqti soatda */
function hours(ms: number | null | undefined) {
  if (ms == null) return '—';
  return `${(ms / 3_600_000).toLocaleString('uz-UZ', { maximumFractionDigits: 1 })} soat`;
}

const KIND_LABEL: Record<MediaKind, string> = { REELS: 'Reels', FEED: 'Post', STORY: 'Istoriya' };

export default function PostsPage() {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<any>(null);
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [stories, setStories] = useState<MediaItem[] | null>(null);
  const [connected, setConnected] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [sort, setSort] = useState<Sort>('new');
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<MediaItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const aiEnabled = useAiEnabled();

  // Akkaunt statistikasi — davr o'zgarganda qayta
  useEffect(() => {
    let alive = true;
    setOverview(null);
    getIgOverview(days)
      .then((d) => {
        if (!alive) return;
        if (!d.connected) setConnected(false);
        setOverview(d);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [days]);

  // Postlar va istoriyalar — bir marta
  useEffect(() => {
    getMedia()
      .then((r) => {
        if (!r.connected) setConnected(false);
        setItems(r.items);
        setAfter(r.after);
      })
      .catch((e) => setError(e.message));
    getStories()
      .then((r) => setStories(r.items))
      .catch(() => setStories([]));
  }, []);

  const loadMore = async () => {
    if (!after || more) return;
    setMore(true);
    try {
      const r = await getMedia(after);
      setItems((prev) => [...(prev ?? []), ...r.items]);
      setAfter(r.after);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setMore(false);
    }
  };

  const all = useMemo(() => [...(items ?? []), ...(stories ?? [])], [items, stories]);
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: all.length, REELS: 0, FEED: 0, STORY: 0 };
    for (const m of all) c[m.kind]++;
    return c;
  }, [all]);

  const shown = useMemo(() => {
    const list = tab === 'all' ? all : all.filter((m) => m.kind === tab);
    const by = sort === 'views' ? views : sort === 'likes' ? likes : null;
    return [...list].sort((a, b) =>
      by ? (by(b) ?? -1) - (by(a) ?? -1) : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [all, tab, sort]);

  const profile = overview?.profile;
  const t = overview?.totals;

  // Esc bilan yopish
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Instagram{profile?.username ? ` · @${profile.username}` : ''}</p>
          <h1 className="title mt-2">Postlarim</h1>
          <p className="subtitle mt-1.5 num">
            {profile
              ? `${fmt(profile.media_count)} ta media · ${fmt(profile.followers_count)} obunachi`
              : 'Kontent va uning statistikasi.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {aiEnabled && connected && (
            <Link href="/instagram/posts/scan" className="btn btn-primary">
              <Sparkles size={14} strokeWidth={2} /> Profilni skanerlash
            </Link>
          )}
        <div className="seg w-[200px]" role="tablist" aria-label="Davr">
          {PERIODS.map((d) => (
            <button key={d} type="button" role="tab" aria-selected={days === d} data-on={days === d} onClick={() => setDays(d)}>
              {d} kun
            </button>
          ))}
        </div>
        </div>
      </div>

      {error && <p role="alert" className="mt-6 text-[13px] text-[var(--crit)]">{error}</p>}

      {!connected ? (
        <Link href="/instagram/settings" className="panel mt-8 p-5 flex items-center gap-4 group hover:border-[var(--accent-line)] transition-colors">
          <span className="grid place-items-center w-10 h-10 rounded-full bg-[var(--accent-soft)]">
            <Instagram size={18} strokeWidth={1.75} className="text-[var(--accent-ink)]" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[14px] font-medium">Instagram akkauntingizni ulang</span>
            <span className="block subtitle mt-0.5">Postlar va statistika ulangan akkauntdan olinadi.</span>
          </span>
          <ArrowRight size={16} strokeWidth={1.75} className="text-[var(--muted)] group-hover:text-[var(--accent-ink)]" />
        </Link>
      ) : (
        <>
          {/* 1. Akkaunt bo'yicha davr statistikasi */}
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat label="Ko'rishlar" value={t?.views} loading={!overview} />
              <Stat label="Qamrov" value={t?.reach} note="noyob akkauntlar" loading={!overview} />
              <Stat label="Faol akkauntlar" value={t?.accounts_engaged} note="layk, komment, ulashish…" loading={!overview} />
              <Stat label="Interaksiyalar" value={t?.total_interactions} loading={!overview} />
            </div>

            <section className="panel p-5 lg:col-span-2 min-w-0">
              <h2 className="text-[14px] font-medium">Kunlik qamrov</h2>
              <p className="text-[12px] text-[var(--muted)] mt-0.5">Oxirgi {days} kun, nechta akkaunt ko&apos;rdi</p>
              {!overview ? <div className="skeleton h-[160px] mt-4" /> : <ReachChart points={overview.daily ?? []} />}
            </section>

            <section className="panel p-5 min-w-0">
              <h2 className="text-[14px] font-medium">Faollik tarkibi</h2>
              <p className="text-[12px] text-[var(--muted)] mt-0.5">Oxirgi {days} kun</p>
              <div className="mt-4 rows">
                {[
                  ['Layklar', t?.likes, Heart],
                  ['Kommentlar', t?.comments, MessageCircle],
                  ['Ulashishlar', t?.shares, Share2],
                  ['Saqlashlar', t?.saves, Bookmark],
                ].map(([label, v, Icon]: any) => (
                  <div key={label} className="flex items-center gap-3 py-2.5">
                    <Icon size={15} strokeWidth={1.75} className="text-[var(--muted)]" />
                    <span className="text-[13.5px] text-[var(--ink-2)] flex-1">{label}</span>
                    <span className="text-[14px] font-medium num">{overview ? fmt(v) : '…'}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* 2. Kontent */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
            <div className="seg" role="tablist" aria-label="Turi">
              {TABS.map((x) => (
                <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} data-on={tab === x.id} onClick={() => setTab(x.id)} className="!px-3">
                  {x.label}
                  <span className="num text-[var(--muted)] text-[12px]">{counts[x.id]}</span>
                </button>
              ))}
            </div>
            <div className="seg" role="tablist" aria-label="Saralash">
              {SORTS.map((x) => (
                <button key={x.id} type="button" role="tab" aria-selected={sort === x.id} data-on={sort === x.id} onClick={() => setSort(x.id)} className="!px-3">
                  {x.label}
                </button>
              ))}
            </div>
          </div>

          {!items ? (
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <div key={i} className="skeleton aspect-[4/5]" />)}
            </div>
          ) : shown.length === 0 ? (
            <div className="panel mt-5 px-6 py-14 text-center">
              {tab === 'STORY' ? (
                <>
                  <p className="text-[15px] font-medium">Faol istoriya yo&apos;q</p>
                  <p className="subtitle mt-1.5 max-w-md mx-auto">
                    Instagram faqat hozir faol (oxirgi 24 soatdagi) istoriyalarni ko&apos;rsatishga ruxsat beradi —
                    arxivdagi eski istoriyalar API orqali mavjud emas.
                  </p>
                </>
              ) : (
                <p className="text-[15px] font-medium">Bu turda kontent yo&apos;q</p>
              )}
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {shown.map((m) => (
                <MediaCard key={m.id} m={m} onOpen={() => setOpen(m)} />
              ))}
            </div>
          )}

          {after && tab !== 'STORY' && (
            <div className="mt-6 text-center">
              <button onClick={loadMore} disabled={more} className="btn btn-outline">
                {more ? 'Yuklanmoqda…' : "Ko'proq yuklash"}
              </button>
              <p className="text-[12px] text-[var(--muted)] mt-2">Saralash va filtr faqat yuklanganlar orasida ishlaydi.</p>
            </div>
          )}
        </>
      )}

      {open && <MediaDetail m={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ------------------------------ qismlar ------------------------------ */

function Stat({ label, value, note, loading }: { label: string; value?: number; note?: string; loading: boolean }) {
  return (
    <div className="panel p-5">
      <p className="text-[12.5px] text-[var(--muted)]">{label}</p>
      {loading ? (
        <div className="skeleton h-7 w-24 mt-2" />
      ) : (
        <p className="text-[28px] font-semibold tracking-[-0.03em] mt-2 num leading-none">{fmt(value)}</p>
      )}
      <p className="text-[12px] text-[var(--muted)] mt-2.5 min-h-[18px]">{note ?? ''}</p>
    </div>
  );
}

/** Bitta seriya — afsona shart emas, sarlavha nomlaydi. Har ustunda hover yorlig'i */
function ReachChart({ points }: { points: { day: string; reach: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return <p className="text-[13px] text-[var(--muted)] py-10 text-center">Ma&apos;lumot yo&apos;q</p>;
  const max = Math.max(1, ...points.map((p) => p.reach));
  const total = points.reduce((s, p) => s + p.reach, 0);
  const label = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
  return (
    <div className="mt-4">
      <p className="text-[12px] text-[var(--muted)] num mb-3">
        O&apos;rtacha kuniga <b className="text-[var(--ink)] font-medium">{fmt(Math.round(total / points.length))}</b> · eng ko&apos;p{' '}
        <b className="text-[var(--ink)] font-medium">{fmt(max)}</b>
      </p>
      <div className="relative h-[140px] flex items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
        {points.map((p, i) => (
          <div key={p.day} className="flex-1 h-full flex items-end cursor-default" onMouseEnter={() => setHover(i)}>
            <div
              className="w-full rounded-t-[4px] rounded-b-[1px] transition-opacity"
              style={{
                height: `${Math.max((p.reach / max) * 100, p.reach ? 2 : 1)}%`,
                background: p.reach ? 'var(--series-reply)' : 'var(--line)',
                opacity: hover == null || hover === i ? 1 : 0.45,
              }}
            />
          </div>
        ))}
        {hover != null && (
          <div
            role="tooltip"
            className="absolute -top-2 panel px-2.5 py-1.5 text-[12px] num pointer-events-none whitespace-nowrap -translate-y-full"
            style={{ left: `${((hover + 0.5) / points.length) * 100}%`, transform: 'translate(-50%, -100%)' }}
          >
            {label(points[hover].day)} · <b>{fmt(points[hover].reach)}</b> akkaunt
          </div>
        )}
      </div>
      <div className="flex justify-between text-[11px] text-[var(--muted)] num mt-2">
        <span>{label(points[0].day)}</span>
        <span>{label(points[points.length - 1].day)}</span>
      </div>
    </div>
  );
}

function Thumb({ m, className = '' }: { m: MediaItem; className?: string }) {
  return m.thumbnail ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={m.thumbnail} alt={m.caption?.slice(0, 80) ?? ''} loading="lazy" className={`w-full h-full object-cover ${className}`} />
  ) : (
    <span className="w-full h-full grid place-items-center bg-[var(--sunken)]">
      <ImagesIcon size={20} strokeWidth={1.5} className="text-[var(--muted)]" />
    </span>
  );
}

function MediaCard({ m, onOpen }: { m: MediaItem; onOpen: () => void }) {
  const v = views(m);
  return (
    <button type="button" onClick={onOpen} className="panel overflow-hidden text-left group hover:border-[var(--accent-line)] transition-colors">
      <div className="relative aspect-[4/5] bg-[var(--sunken)] overflow-hidden">
        <Thumb m={m} className="group-hover:scale-[1.02] transition-transform duration-300" />
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 h-6 px-2 rounded-full bg-black/55 text-white text-[11px] font-medium backdrop-blur-sm">
          {m.kind === 'REELS' && <Play size={10} strokeWidth={2.5} fill="currentColor" />}
          {m.mediaType === 'CAROUSEL_ALBUM' && <ImagesIcon size={11} strokeWidth={2} />}
          {KIND_LABEL[m.kind]}
        </span>
        {v != null && (
          <span className="absolute bottom-0 inset-x-0 px-3 pt-8 pb-2.5 bg-gradient-to-t from-black/70 to-transparent text-white text-[13px] font-medium num inline-flex items-center gap-1.5">
            <Eye size={14} strokeWidth={2} /> {compact(v)}
          </span>
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="text-[11.5px] text-[var(--muted)] num">{fmtDate(m.timestamp)}</p>
        <div className="flex items-center gap-3 mt-1.5 text-[12.5px] text-[var(--ink-2)] num">
          <span className="inline-flex items-center gap-1" title="Layklar"><Heart size={13} strokeWidth={1.75} /> {compact(likes(m))}</span>
          <span className="inline-flex items-center gap-1" title="Kommentlar"><MessageCircle size={13} strokeWidth={1.75} /> {compact(comments(m))}</span>
          {m.insights?.shares != null && (
            <span className="inline-flex items-center gap-1" title="Ulashishlar"><Share2 size={13} strokeWidth={1.75} /> {compact(m.insights.shares)}</span>
          )}
        </div>
      </div>
    </button>
  );
}

function MediaDetail({ m, onClose }: { m: MediaItem; onClose: () => void }) {
  const i = m.insights ?? {};
  const engagement = i.reach ? Math.round(((i.total_interactions ?? 0) / i.reach) * 1000) / 10 : null;
  const rows: [string, string, string?][] = [
    ["Ko'rishlar", fmt(views(m))],
    ['Qamrov', fmt(i.reach), 'noyob akkauntlar'],
    ['Layklar', fmt(likes(m))],
    ['Kommentlar', fmt(comments(m))],
    ['Ulashishlar', fmt(i.shares)],
    ['Saqlashlar', fmt(i.saved)],
    ['Interaksiyalar', fmt(i.total_interactions)],
    ['Jalb etish', engagement == null ? '—' : `${engagement.toLocaleString('uz-UZ')}%`, 'interaksiya / qamrov'],
  ];
  if (m.kind === 'REELS') {
    rows.push(["O'rtacha tomosha", duration(i.ig_reels_avg_watch_time)]);
    rows.push(['Umumiy tomosha vaqti', hours(i.ig_reels_video_view_total_time)]);
  }
  if (m.kind === 'STORY') {
    rows.push(['Javoblar', fmt(i.replies)]);
    rows.push(['Profilga o\'tish', fmt(i.profile_visits)]);
  }
  if (i.follows != null) rows.push(['Obuna bo\'lganlar', fmt(i.follows)]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Post statistikasi">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative panel w-full max-w-[920px] max-h-[92vh] overflow-auto">
      <div className="grid sm:grid-cols-[280px_1fr]">
        <div className="relative bg-[var(--sunken)] aspect-[4/5] sm:aspect-auto sm:min-h-full">
          <Thumb m={m} />
        </div>
        <div className="p-5 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{KIND_LABEL[m.kind]}</p>
              <p className="text-[13px] text-[var(--muted)] num mt-1">{fmtDate(m.timestamp, true)}</p>
            </div>
            <button onClick={onClose} className="icon-btn -mr-1.5 -mt-1" aria-label="Yopish"><X size={16} strokeWidth={1.75} /></button>
          </div>
          {m.caption && <p className="text-[13.5px] text-[var(--ink-2)] mt-3 line-clamp-4 whitespace-pre-line break-words">{m.caption}</p>}

          {m.insights ? (
            <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4">
              {rows.map(([k, v, note]) => (
                <div key={k}>
                  <dt className="text-[12px] text-[var(--muted)]">{k}</dt>
                  <dd className="text-[17px] font-semibold tracking-[-0.02em] num mt-0.5">{v}</dd>
                  {note && <dd className="text-[11px] text-[var(--muted)]">{note}</dd>}
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-5 text-[13px] text-[var(--muted)]">Bu media uchun statistika olinmadi.</p>
          )}

          {m.permalink && (
            <a href={m.permalink} target="_blank" rel="noopener noreferrer" className="btn btn-outline mt-6">
              Instagram&apos;da ochish <ExternalLink size={13} strokeWidth={1.75} />
            </a>
          )}
        </div>
      </div>
      <MediaAi m={m} />
      </div>
    </div>
  );
}

/** Claude tahlili — faqat AI yoqilgan akkauntda ko'rinadi */
function MediaAi({ m }: { m: MediaItem }) {
  const enabled = useAiEnabled();
  const { analysis: a, run, error, busy } = useAnalysis('media', m.id, () => startMediaAnalysis(m.id), enabled);
  if (!enabled) return null;
  return (
    <div className="border-t border-[var(--line)] p-5 sm:p-6">
      {a === undefined ? (
        <div className="skeleton h-12" />
      ) : busy && a ? (
        <AnalysisProgress a={a} kind="media" />
      ) : a?.status === 'error' ? (
        <AnalysisError a={a} onRetry={run} />
      ) : a?.status === 'done' ? (
        <>
          <MediaReport a={a} />
          <button onClick={run} className="btn btn-ghost mt-5 -ml-3">
            <Sparkles size={14} strokeWidth={1.75} /> Qayta tahlil qilish
          </button>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[220px]">
            <p className="text-[14px] font-medium flex items-center gap-2"><Sparkles size={15} strokeWidth={1.75} className="text-[var(--accent-ink)]" /> Claude bilan tahlil</p>
            <p className="text-[12.5px] text-[var(--muted)] mt-1">
              Video yuklab olinadi, kadrlar va nutq o&apos;rganiladi, statistika va kommentlar akkauntdagi boshqa postlar bilan solishtiriladi.
            </p>
          </div>
          <button onClick={run} className="btn btn-primary">Tahlil qilish</button>
        </div>
      )}
      {error && <p role="alert" className="text-[13px] text-[var(--crit)] mt-3">{error}</p>}
    </div>
  );
}

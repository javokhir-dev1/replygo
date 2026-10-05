'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, RotateCw, ArrowUpRight, Check, X, AlertTriangle, ExternalLink } from 'lucide-react';
import { getAiStatus, getAnalysis, listAnalyses, type AiAnalysis } from '@/lib/api';

/**
 * Claude (lokal CLI) tahlillari: holatni kuzatish va hisobotlarni chizish.
 * Backend: /api/ai/* (ai.service.ts). Hisobot shakli — ai.schemas.ts.
 */

/** AI shu foydalanuvchi uchun yoqilganmi (bir marta so'raladi) */
let statusPromise: Promise<boolean> | null = null;
export function useAiEnabled() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    statusPromise ??= getAiStatus().then((s) => s.enabled).catch(() => false);
    statusPromise.then(setEnabled);
  }, []);
  return enabled;
}

/**
 * Oxirgi tahlilni yuklaydi va tugaguncha har 3 soniyada yangilab turadi.
 * `start` — yangi tahlilni boshlash funksiyasi (media yoki profil).
 */
export function useAnalysis(kind: 'media' | 'profile', mediaId: string | undefined, start: () => Promise<AiAnalysis>, enabled: boolean) {
  const [a, setA] = useState<AiAnalysis | null | undefined>(undefined); // undefined — yuklanmoqda
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback((id: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const next = await getAnalysis(id);
        setA(next);
        if (next.status === 'queued' || next.status === 'running') poll(id);
      } catch {
        poll(id); // tarmoq uzilishi — qayta urinamiz
      }
    }, 3000);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    listAnalyses(kind, mediaId)
      .then((list) => {
        if (!alive) return;
        const last = list[0] ?? null;
        setA(last);
        if (last && (last.status === 'queued' || last.status === 'running')) poll(last.id);
      })
      .catch(() => alive && setA(null));
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [kind, mediaId, enabled, poll]);

  const run = async () => {
    setErr(null);
    try {
      const created = await start();
      setA(created);
      poll(created.id);
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return { analysis: a, run, error: err, busy: a?.status === 'queued' || a?.status === 'running' };
}

/* --------------------------------- holat --------------------------------- */

const STEPS_MEDIA = ["Ma'lumot yig'ilmoqda", 'Video yuklanmoqda', 'Kadrlar ajratilmoqda', 'Nutq matnga aylantirilmoqda', 'Claude tahlil qilmoqda'];

export function AnalysisProgress({ a, kind }: { a: AiAnalysis; kind: 'media' | 'profile' }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const sec = Math.max(0, Math.round((now - new Date(a.createdAt).getTime()) / 1000));
  const idx = kind === 'media' ? STEPS_MEDIA.indexOf(a.stage ?? '') : -1;
  return (
    <div className="panel p-5" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <Loader2 size={16} strokeWidth={2} className="animate-spin text-[var(--accent-ink)]" />
        <p className="text-[14px] font-medium flex-1">{a.status === 'queued' ? 'Navbatda turibdi' : a.stage ?? 'Ishlanmoqda'}</p>
        <span className="text-[12px] text-[var(--muted)] num">
          {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, '0')}
        </span>
      </div>
      {kind === 'media' && (
        <ol className="mt-4 grid gap-1.5">
          {STEPS_MEDIA.map((s, i) => (
            <li key={s} className={`flex items-center gap-2 text-[12.5px] ${i < idx ? 'text-[var(--ink-2)]' : i === idx ? 'text-[var(--ink)] font-medium' : 'text-[var(--muted)]'}`}>
              {i < idx ? <Check size={13} strokeWidth={2.25} className="text-[var(--good)]" /> : <span className="w-[13px] text-center">{i === idx ? '›' : '·'}</span>}
              {s}
            </li>
          ))}
        </ol>
      )}
      <p className="text-[12px] text-[var(--muted)] mt-4">
        {kind === 'media'
          ? "Odatda 3–6 daqiqa. Oynani yopsangiz ham tahlil davom etadi — natija shu yerda saqlanadi, Telegram'ga ham xabar keladi."
          : "Profil skaneri 10–20 daqiqa olishi mumkin: eng yaxshi va eng kam ko'rilgan videolar alohida o'rganiladi. Sahifani yopsangiz ham davom etadi."}
      </p>
    </div>
  );
}

export function AnalysisError({ a, onRetry }: { a: AiAnalysis; onRetry: () => void }) {
  return (
    <div className="panel p-5">
      <p className="text-[14px] font-medium flex items-center gap-2">
        <AlertTriangle size={15} strokeWidth={2} className="text-[var(--crit)]" /> Tahlil bajarilmadi
      </p>
      <p className="text-[12.5px] text-[var(--muted)] mt-1.5 break-words">{a.error}</p>
      <button onClick={onRetry} className="btn btn-outline mt-4">
        <RotateCw size={14} strokeWidth={1.75} /> Qayta urinish
      </button>
    </div>
  );
}

/* ------------------------------ qismlar ------------------------------ */

const PRIORITY: Record<string, { label: string; color: string }> = {
  high: { label: 'Muhim', color: 'var(--crit)' },
  medium: { label: "O'rta", color: 'var(--series-dm)' },
  low: { label: 'Ixtiyoriy', color: 'var(--muted)' },
};

function Score({ value, label }: { value: number; label?: string }) {
  return (
    <div className="flex items-baseline gap-1 num">
      <span className="text-[32px] font-semibold tracking-[-0.03em] leading-none">{value}</span>
      <span className="text-[13px] text-[var(--muted)]">/10</span>
      {label && <span className="text-[12px] text-[var(--muted)] ml-2">{label}</span>}
    </div>
  );
}

function Block({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h4 className="eyebrow mb-2.5">{title}</h4>
      {children}
    </section>
  );
}

function Bullets({ items, icon }: { items: string[]; icon?: 'good' | 'bad' }) {
  if (!items?.length) return <p className="text-[13px] text-[var(--muted)]">—</p>;
  return (
    <ul className="grid gap-2">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2 text-[13.5px] text-[var(--ink-2)] leading-relaxed">
          {icon === 'good' ? (
            <Check size={14} strokeWidth={2.25} className="text-[var(--good)] shrink-0 mt-[3px]" aria-label="kuchli" />
          ) : icon === 'bad' ? (
            <X size={14} strokeWidth={2.25} className="text-[var(--crit)] shrink-0 mt-[3px]" aria-label="zaif" />
          ) : (
            <span className="text-[var(--muted)] shrink-0">•</span>
          )}
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Recommendations({ items }: { items: { title: string; detail: string; priority: string }[] }) {
  return (
    <ol className="grid gap-3">
      {items.map((r, i) => {
        const p = PRIORITY[r.priority] ?? PRIORITY.low;
        return (
          <li key={i} className="panel p-4">
            <div className="flex items-start gap-3">
              <span className="num text-[12px] text-[var(--muted)] mt-[2px] w-4 shrink-0">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">{r.title}</p>
                <p className="text-[13px] text-[var(--ink-2)] mt-1 leading-relaxed">{r.detail}</p>
              </div>
              <span className="text-[11px] font-medium shrink-0 inline-flex items-center gap-1.5" style={{ color: p.color }}>
                <i className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: p.color }} />
                {p.label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Footer({ a }: { a: AiAnalysis }) {
  return (
    <p className="text-[11.5px] text-[var(--muted)] num">
      {a.model ?? 'Claude'} · {a.finishedAt ? new Date(a.finishedAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
      {a.durationMs ? ` · ${Math.round(a.durationMs / 60000) || '<1'} daq` : ''}
      {a.meta?.frames != null ? ` · ${a.meta.frames} kadr` : ''}
      {a.meta?.transcriptChars ? ' · nutq matni' : ''}
      {a.meta?.comments != null ? ` · ${a.meta.comments} komment` : ''}
      {a.meta?.posts != null ? ` · ${a.meta.posts} post` : ''}
      {a.meta?.samples != null ? ` · ${a.meta.samples} video o'rganildi` : ''}
    </p>
  );
}

const SENTIMENT: Record<string, string> = { positive: 'Ijobiy', mixed: 'Aralash', negative: 'Salbiy', none: "Komment yo'q" };

/* --------------------------- bitta post hisoboti --------------------------- */

export function MediaReport({ a }: { a: AiAnalysis }) {
  const r = a.result;
  if (!r) return null;
  return (
    <div className="grid gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-1.5"><Sparkles size={12} strokeWidth={2} /> Claude tahlili</p>
          <p className="text-[18px] font-semibold tracking-[-0.02em] mt-1.5">{r.verdict}</p>
        </div>
        <Score value={r.score} />
      </div>

      <p className="text-[14px] leading-relaxed text-[var(--ink-2)]">{r.summary}</p>

      <div className="grid gap-6 sm:grid-cols-2">
        <Block title="Natija">
          <p className="text-[13.5px] text-[var(--ink-2)] leading-relaxed">{r.performance?.vs_account}</p>
          {r.performance?.highlights?.length > 0 && <div className="mt-3"><Bullets items={r.performance.highlights} /></div>}
        </Block>
        <Block title={`Hook · ${r.hook?.score}/10`}>
          <p className="text-[13.5px] text-[var(--ink-2)] leading-relaxed">{r.hook?.analysis}</p>
          <p className="text-[13.5px] mt-2.5 leading-relaxed"><span className="font-medium">Tavsiya:</span> {r.hook?.suggestion}</p>
        </Block>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Block title="Kuchli tomonlar"><Bullets items={r.strengths} icon="good" /></Block>
        <Block title="Zaif tomonlar"><Bullets items={r.weaknesses} icon="bad" /></Block>
      </div>

      <Block title="Kontent">
        <dl className="grid gap-3 sm:grid-cols-2">
          {[
            ['Mavzu', r.content?.topic],
            ['Tuzilish', r.content?.structure],
            ['Vizual', r.content?.visuals],
            ['Nutq', r.content?.speech],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[12px] text-[var(--muted)]">{k}</dt>
              <dd className="text-[13.5px] text-[var(--ink-2)] mt-0.5 leading-relaxed">{v}</dd>
            </div>
          ))}
        </dl>
      </Block>

      <Block title={`Auditoriya · ${SENTIMENT[r.audience?.sentiment] ?? '—'}`}>
        <Bullets items={r.audience?.themes ?? []} />
        {r.audience?.questions?.length > 0 && (
          <>
            <p className="text-[12px] text-[var(--muted)] mt-4 mb-2">Kommentlardagi savollar</p>
            <Bullets items={r.audience.questions} />
          </>
        )}
      </Block>

      <Block title="Tavsiyalar"><Recommendations items={r.recommendations ?? []} /></Block>

      {r.caption_suggestion && (
        <Block title="Caption taklifi">
          <p className="panel p-4 text-[13.5px] text-[var(--ink-2)] whitespace-pre-line leading-relaxed">{r.caption_suggestion}</p>
        </Block>
      )}

      <Footer a={a} />
    </div>
  );
}

/* ----------------------------- profil hisoboti ----------------------------- */

export function ProfileReport({ a }: { a: AiAnalysis }) {
  const r = a.result;
  if (!r) return null;
  const idx = a.meta?.postIndex ?? {};
  const PostRefs = ({ items }: { items: { media_id: string; why: string }[] }) => (
    <div className="grid gap-3">
      {items.map((p) => {
        const m = idx[p.media_id];
        return (
          <div key={p.media_id} className="flex gap-3">
            <a
              href={m?.permalink ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="w-14 aspect-[4/5] rounded-lg overflow-hidden bg-[var(--sunken)] shrink-0 relative group"
              title="Instagram'da ochish"
            >
              {m?.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.thumbnail} alt="" className="w-full h-full object-cover" />
              )}
              <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center">
                <ExternalLink size={13} className="text-white" />
              </span>
            </a>
            <div className="min-w-0">
              <p className="text-[12px] text-[var(--muted)] num">{m?.views != null ? `${Number(m.views).toLocaleString('uz-UZ')} ko'rish` : p.media_id}</p>
              <p className="text-[13px] text-[var(--ink-2)] mt-0.5 leading-relaxed">{p.why}</p>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="panel p-6 lg:col-span-2">
        <p className="eyebrow flex items-center gap-1.5"><Sparkles size={12} strokeWidth={2} /> Umumiy xulosa</p>
        <p className="text-[15px] leading-relaxed text-[var(--ink-2)] mt-3">{r.summary}</p>
        <p className="text-[13.5px] leading-relaxed text-[var(--ink-2)] mt-4"><span className="font-medium text-[var(--ink)]">Pozitsiya:</span> {r.positioning}</p>
      </section>
      <section className="panel p-6">
        <p className="eyebrow">Profil bahosi</p>
        <div className="mt-3"><Score value={r.score} /></div>
        <div className="mt-6 grid gap-3">
          {(r.kpi_targets ?? []).map((k: any) => (
            <div key={k.metric} className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-[var(--ink-2)]">{k.metric}</span>
              <span className="num whitespace-nowrap"><span className="text-[var(--muted)]">{k.current}</span> <ArrowUpRight size={11} className="inline -mt-0.5 text-[var(--muted)]" /> <b className="font-medium">{k.target}</b></span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-6"><Block title="Nima ishlaydi"><Bullets items={r.what_works} icon="good" /></Block></section>
      <section className="panel p-6"><Block title="Nima ishlamaydi"><Bullets items={r.what_doesnt} icon="bad" /></Block></section>
      <section className="panel p-6">
        <Block title="Kontent ustunlari">
          <div className="grid gap-3">
            {(r.content_pillars ?? []).map((p: any) => (
              <div key={p.name}>
                <p className="text-[13.5px] font-medium">{p.name}</p>
                <p className="text-[12.5px] text-[var(--ink-2)] mt-0.5 leading-relaxed">{p.performance}</p>
              </div>
            ))}
          </div>
        </Block>
      </section>

      <section className="panel p-6 lg:col-span-3 grid gap-6 md:grid-cols-2">
        <Block title="Format va uzunlik"><p className="text-[13.5px] text-[var(--ink-2)] leading-relaxed">{r.formats}</p></Block>
        <Block title="Hook'lar"><p className="text-[13.5px] text-[var(--ink-2)] leading-relaxed">{r.hooks}</p></Block>
        <Block title="Joylash vaqti va chastotasi">
          <p className="text-[13.5px] text-[var(--ink-2)] leading-relaxed">{r.posting?.timing}</p>
          <p className="text-[13.5px] text-[var(--ink-2)] leading-relaxed mt-2">{r.posting?.frequency}</p>
        </Block>
        <Block title="Caption va auditoriya">
          <p className="text-[13.5px] text-[var(--ink-2)] leading-relaxed">{r.captions}</p>
          <p className="text-[13.5px] text-[var(--ink-2)] leading-relaxed mt-2">{r.audience}</p>
        </Block>
      </section>

      <section className="panel p-6"><Block title="Eng yaxshi postlar — nega"><PostRefs items={r.top_posts ?? []} /></Block></section>
      <section className="panel p-6 lg:col-span-2"><Block title="Kuchsiz postlar — nega"><PostRefs items={r.weak_posts ?? []} /></Block></section>

      <section className="lg:col-span-3 mt-4">
        <h3 className="text-[16px] font-semibold tracking-[-0.02em] mb-4">Tavsiyalar</h3>
        <Recommendations items={r.recommendations ?? []} />
      </section>

      <section className="lg:col-span-3 mt-4">
        <h3 className="text-[16px] font-semibold tracking-[-0.02em] mb-4">30 kunlik reja</h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(r.plan_30_days ?? []).map((w: any) => (
            <div key={w.week} className="panel p-5">
              <p className="eyebrow">{w.week}-hafta</p>
              <p className="text-[14px] font-medium mt-1.5">{w.focus}</p>
              <div className="mt-3"><Bullets items={w.actions} /></div>
            </div>
          ))}
        </div>
      </section>

      <div className="lg:col-span-3"><Footer a={a} /></div>
    </div>
  );
}

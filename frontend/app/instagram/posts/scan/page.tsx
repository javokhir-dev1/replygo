'use client';

import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { startProfileAnalysis } from '@/lib/api';
import { useAiEnabled, useAnalysis, AnalysisProgress, AnalysisError, ProfileReport } from '@/components/AiReports';

/**
 * Profil skaneri — Claude butun profilni (barcha postlar, 30 kunlik statistika,
 * eng yaxshi va eng kam ko'rilgan videolar) o'rganib, strategiya yozadi.
 */
export default function ProfileScanPage() {
  const enabled = useAiEnabled();
  const { analysis: a, run, error, busy } = useAnalysis('profile', undefined, startProfileAnalysis, enabled);

  return (
    <div>
      <Link href="/instagram/posts" className="btn btn-ghost -ml-3">
        <ArrowLeft size={15} strokeWidth={1.75} /> Postlarim
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-1.5"><Sparkles size={12} strokeWidth={2} /> Claude</p>
          <h1 className="title mt-2">Profil skaneri</h1>
          <p className="subtitle mt-1.5 max-w-xl">
            Barcha postlar, 30 kunlik statistika va eng ko&apos;p hamda eng kam ko&apos;rilgan videolar (hook va nutqi bilan) asosida
            to&apos;liq tahlil va 30 kunlik reja.
          </p>
        </div>
        {enabled && a?.status === 'done' && !busy && (
          <button onClick={run} className="btn btn-outline">
            <Sparkles size={14} strokeWidth={1.75} /> Qayta skanerlash
          </button>
        )}
      </div>

      <div className="mt-8">
        {!enabled ? (
          <p className="subtitle">AI tahlil bu akkaunt uchun yoqilmagan.</p>
        ) : a === undefined ? (
          <div className="skeleton h-40" />
        ) : busy && a ? (
          <div className="max-w-xl"><AnalysisProgress a={a} kind="profile" /></div>
        ) : a?.status === 'error' ? (
          <div className="max-w-xl"><AnalysisError a={a} onRetry={run} /></div>
        ) : a?.status === 'done' ? (
          <ProfileReport a={a} />
        ) : (
          <div className="panel p-8 max-w-xl">
            <p className="text-[15px] font-medium">Hali skaner qilinmagan</p>
            <p className="subtitle mt-1.5">10–20 daqiqa davom etadi. Sahifani yopsangiz ham ishlayveradi, tugagach Telegram&apos;ga xabar keladi.</p>
            <button onClick={run} className="btn btn-primary mt-5">
              <Sparkles size={14} strokeWidth={2} /> Skanerlashni boshlash
            </button>
          </div>
        )}
        {error && <p role="alert" className="text-[13px] text-[var(--crit)] mt-3">{error}</p>}
      </div>
    </div>
  );
}

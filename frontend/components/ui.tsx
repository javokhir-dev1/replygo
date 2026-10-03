'use client';

/** Bo'lim: chap tomonda sarlavha va izoh, o'ngda boshqaruvlar (kengda) */
export function Section({ title, desc, children }: { title: string; desc?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 lg:grid-cols-[190px_1fr] lg:gap-10 py-9 hairline first:border-t-0 first:pt-2">
      <div>
        <h3 className="text-[14px] font-medium">{title}</h3>
        {desc && <p className="subtitle mt-1.5 leading-relaxed">{desc}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** Kalitchali qator — butun qator bosiladi */
export function SwitchRow({ on, onToggle, title, desc }: { on: boolean; onToggle: () => void; title: string; desc?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onToggle} className="w-full flex items-center gap-4 text-left">
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-medium">{title}</span>
        {desc && <span className="block subtitle mt-0.5">{desc}</span>}
      </span>
      <span className="switch" data-on={on} />
    </button>
  );
}


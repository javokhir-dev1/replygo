'use client';

import { Plus, Trash2, Check, ArrowLeft, X, Image as ImageIcon } from 'lucide-react';
import type { FormState } from './types';
import { Section, SwitchRow } from './ui';

interface Props {
  form: FormState;
  kwInput: string;
  setKwInput: (v: string) => void;
  up: (patch: Partial<FormState>) => void;
  addKw: () => void;
  togglePost: (post: any) => void;
  posts: any[];
  postsLoading: boolean;
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
  onBack: () => void;
  editing: boolean;
}

/** Shablonlar ro'yxati (javob / DM) — bir xil xulq */
function Templates({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      {items.map((tmpl, i) => (
        <div key={i} className="flex gap-2">
          <textarea
            value={tmpl}
            onChange={(e) => {
              const arr = [...items];
              arr[i] = e.target.value;
              onChange(arr);
            }}
            rows={2}
            placeholder={`${placeholder} ${i + 1}`}
            className="field"
          />
          {items.length > 1 && (
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="icon-btn danger self-start mt-1" aria-label="Shablonni o'chirish">
              <Trash2 size={14} strokeWidth={1.75} />
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ''])} className="link pt-1">
        <Plus size={13} strokeWidth={2} /> Variant qo&apos;shish
      </button>
    </div>
  );
}

export function AutomationForm({
  form, kwInput, setKwInput, up, addKw, togglePost,
  posts, postsLoading, saving, saveError, onSave, onBack, editing,
}: Props) {
  const canSave = form.name.trim() && (form.replyEnabled || form.dmEnabled);

  return (
    <div>
      {/* Yuqori panel */}
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={onBack} className="btn btn-ghost -ml-3">
          <ArrowLeft size={15} strokeWidth={1.75} /> Orqaga
        </button>
        <button type="button" onClick={onSave} disabled={!canSave || saving} className="btn btn-primary">
          {saving ? 'Saqlanmoqda…' : 'Saqlash'}
        </button>
      </div>

      <div className="mt-8">
        <p className="eyebrow">{editing ? 'Tahrirlash' : 'Yangi qoida'}</p>
        <input
          autoFocus
          value={form.name}
          onChange={(e) => up({ name: e.target.value })}
          placeholder="Qoida nomi"
          aria-label="Qoida nomi"
          className="mt-2 w-full bg-transparent outline-none title placeholder:text-[var(--line-strong)]"
        />
      </div>

      {(saveError || !canSave) && (
        <p className={`mt-3 text-[13px] ${saveError ? 'text-[var(--crit)]' : 'text-[var(--muted)]'}`}>
          {saveError || 'Nom kiriting va kamida bitta amal — javob yoki DM — yoqing.'}
        </p>
      )}

      <div className="mt-8 hairline">
        {/* Shart */}
        <Section title="Shart" desc="Qaysi izohlarga javob berilsin.">
          <div className="seg">
            <button type="button" data-on={form.triggerType === 'any'} onClick={() => up({ triggerType: 'any' })}>Har qanday izoh</button>
            <button type="button" data-on={form.triggerType === 'keyword'} onClick={() => up({ triggerType: 'keyword' })}>Kalit so&apos;z</button>
          </div>

          {form.triggerType === 'keyword' && (
            <div className="mt-4">
              <div className="flex gap-2">
                <input
                  value={kwInput}
                  onChange={(e) => setKwInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKw())}
                  placeholder="So'z kiriting va Enter bosing"
                  className="field"
                />
                <button type="button" onClick={addKw} className="btn btn-outline h-10">Qo&apos;shish</button>
              </div>
              {form.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {form.keywords.map((kw) => (
                    <span key={kw} className="tag">
                      {kw}
                      <button
                        type="button"
                        onClick={() => up({ keywords: form.keywords.filter((k) => k !== kw) })}
                        className="grid place-items-center w-5 h-5 rounded-full text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--line)]"
                        aria-label={`${kw} ni olib tashlash`}
                      >
                        <X size={11} strokeWidth={2.25} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Ochiq javob */}
        <Section
          title="Ochiq javob"
          desc={<>Izoh ostiga yoziladi. <span className="text-[var(--ink-2)]">{'{name}'}</span> — foydalanuvchi, <span className="text-[var(--ink-2)]">{'{comment}'}</span> — izoh matni.</>}
        >
          <SwitchRow on={form.replyEnabled} onToggle={() => up({ replyEnabled: !form.replyEnabled })} title="Izohga javob berish" desc="Bir nechta variant bo'lsa, tasodifiy tanlanadi" />
          {form.replyEnabled && (
            <div className="mt-5">
              <Templates items={form.replyTemplates} onChange={(v) => up({ replyTemplates: v })} placeholder="Javob varianti" />
            </div>
          )}
        </Section>

        {/* DM */}
        <Section title="Shaxsiy xabar" desc="Izoh egasiga Direct orqali yuboriladi.">
          <SwitchRow on={form.dmEnabled} onToggle={() => up({ dmEnabled: !form.dmEnabled })} title="DM yuborish" desc="Har bir izohga bitta xabar" />

          {form.dmEnabled && (
            <div className="mt-5 space-y-7">
              <Templates items={form.dmTemplates} onChange={(v) => up({ dmTemplates: v })} placeholder="DM varianti" />

              {/* URL tugmalar */}
              <div>
                <p className="label">Havola tugmalari <span className="text-[var(--muted)] font-normal">· ixtiyoriy, 3 tagacha</span></p>
                <div className="space-y-2">
                  {(form.dmButtons || []).map((btn, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={btn.title}
                        onChange={(e) => {
                          const arr = [...form.dmButtons];
                          arr[i] = { ...arr[i], title: e.target.value };
                          up({ dmButtons: arr });
                        }}
                        placeholder="Nomi"
                        className="field !w-36 shrink-0"
                      />
                      <input
                        value={btn.url}
                        onChange={(e) => {
                          const arr = [...form.dmButtons];
                          arr[i] = { ...arr[i], url: e.target.value };
                          up({ dmButtons: arr });
                        }}
                        placeholder="https://"
                        className="field"
                      />
                      <button type="button" onClick={() => up({ dmButtons: form.dmButtons.filter((_, j) => j !== i) })} className="icon-btn danger mt-1" aria-label="Tugmani o'chirish">
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                  ))}
                </div>
                {form.dmButtons.length < 3 && (
                  <button type="button" onClick={() => up({ dmButtons: [...form.dmButtons, { title: '', url: '' }] })} className="link mt-2">
                    <Plus size={13} strokeWidth={2} /> Tugma qo&apos;shish
                  </button>
                )}
              </div>

              {/* Majburiy obuna */}
              <div className="panel p-5">
                <SwitchRow
                  on={form.followCheckEnabled}
                  onToggle={() => up({ followCheckEnabled: !form.followCheckEnabled })}
                  title="Avval obunani tekshirish"
                  desc="Tugma bosilgach obuna tekshiriladi, keyin asosiy DM ketadi"
                />

                {form.followCheckEnabled && (
                  <div className="mt-5 pt-5 hairline grid gap-4 sm:grid-cols-[1fr_180px]">
                    <div>
                      <label className="label">So&apos;rov xabari</label>
                      <textarea value={form.followAskMessage} onChange={(e) => up({ followAskMessage: e.target.value })} rows={2} placeholder="Ma'lumotni olish uchun tugmani bosing" className="field" />
                    </div>
                    <div>
                      <label className="label">Tugma</label>
                      <input value={form.followAskButton} onChange={(e) => up({ followAskButton: e.target.value })} maxLength={20} placeholder="Ma'lumotni olish" className="field" />
                    </div>
                    <div>
                      <label className="label">Obuna bo&apos;lmaganda</label>
                      <textarea value={form.followFailMessage} onChange={(e) => up({ followFailMessage: e.target.value })} rows={2} placeholder="Siz hali obuna bo'lmagansiz" className="field" />
                    </div>
                    <div>
                      <label className="label">Qayta tekshirish</label>
                      <input value={form.followFailButton} onChange={(e) => up({ followFailButton: e.target.value })} maxLength={20} placeholder="Obuna bo'ldim" className="field" />
                    </div>
                    <p className="subtitle sm:col-span-2 !text-[12px]">Tugma matni Instagram talabiga ko&apos;ra 20 belgigacha.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </Section>

        {/* Postlar */}
        <Section title="Postlar" desc="Qaysi postlar ostidagi izohlar hisobga olinsin.">
          <div className="seg">
            <button type="button" data-on={form.postScope === 'all'} onClick={() => up({ postScope: 'all', postIds: [], postData: [] })}>Barcha postlar</button>
            <button type="button" data-on={form.postScope === 'specific'} onClick={() => up({ postScope: 'specific', postIds: [], postData: [] })}>
              Tanlanganlar
              {form.postScope === 'specific' && form.postIds.length > 0 && <span className="num text-[var(--muted)]">{form.postIds.length}</span>}
            </button>
          </div>

          {form.postScope === 'specific' && (
            <div className="mt-4">
              {postsLoading ? (
                <div className="grid grid-cols-4 gap-1.5">
                  {[...Array(8)].map((_, i) => <div key={i} className="skeleton aspect-square !rounded-lg" />)}
                </div>
              ) : posts.length === 0 ? (
                <p className="subtitle py-6 text-center">Post topilmadi</p>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {posts.map((post: any) => {
                    const selected = form.postIds.includes(post.id);
                    const thumb = post.thumbnail_url || post.media_url;
                    return (
                      <button
                        type="button"
                        key={post.id}
                        onClick={() => togglePost(post)}
                        aria-pressed={selected}
                        className={`relative rounded-lg overflow-hidden aspect-square transition-opacity ${selected ? '' : 'opacity-60 hover:opacity-100'}`}
                        style={selected ? { boxShadow: '0 0 0 2px var(--bg), 0 0 0 4px var(--accent)' } : undefined}
                      >
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="w-full h-full bg-[var(--sunken)] grid place-items-center"><ImageIcon size={15} strokeWidth={1.5} className="text-[var(--muted)]" /></span>
                        )}
                        {selected && (
                          <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[var(--accent)] grid place-items-center">
                            <Check size={12} strokeWidth={2.5} className="text-[var(--on-accent)]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

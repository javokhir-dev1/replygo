'use client';

import {
  Plus, MessageSquare, Send, Trash2, Globe, Hash,
  CheckCircle, ArrowLeft, Save, UserCheck,
} from 'lucide-react';
import type { FormState } from './types';

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

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      style={{
        width: 36, height: 20, borderRadius: 10, padding: 2,
        display: 'inline-flex', alignItems: 'center', flexShrink: 0,
        backgroundColor: on ? '#7C3AED' : '#E5E7EB',
        transition: 'background-color .25s',
      }}
    >
      <span
        style={{
          display: 'block', width: 16, height: 16, borderRadius: '50%',
          backgroundColor: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)',
          transform: on ? 'translateX(16px)' : 'translateX(0)',
          transition: 'transform .25s',
        }}
      />
    </span>
  );
}

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-[var(--border)] p-4">
      <div className="mb-3">
        <h3 className="font-semibold text-sm">{title}</h3>
        {desc && <p className="text-xs text-[var(--muted)] mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

const inputCls =
  'w-full px-3 py-2.5 rounded-xl bg-[var(--bg)] text-sm outline-none focus:ring-2 ring-[var(--primary)]/40 border border-transparent focus:border-[var(--primary)]/30';

export function AutomationForm({
  form, kwInput, setKwInput, up, addKw, togglePost,
  posts, postsLoading, saving, saveError, onSave, onBack, editing,
}: Props) {
  const canSave = form.name.trim() && (form.replyEnabled || form.dmEnabled);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)]">
          <ArrowLeft size={18} /> Orqaga
        </button>
        <span className="font-semibold">{editing ? 'Tahrirlash' : 'Yangi avtomatizatsiya'}</span>
        <button
          onClick={onSave}
          disabled={!canSave || saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#7C3AED,#8B5CF6)' }}
        >
          <Save size={14} /> {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </div>

      {/* Nom */}
      <Card title="Nom">
        <input
          autoFocus
          value={form.name}
          onChange={(e) => up({ name: e.target.value })}
          placeholder="Masalan: Chegirma so'rovlariga javob"
          className={inputCls}
        />
      </Card>

      {/* Trigger */}
      <Card title="Ishga tushirish sharti" desc="Qaysi izohlarga javob berilsin?">
        <div className="space-y-2">
          {[
            { val: 'any', label: 'Har qanday izoh', desc: 'Postdagi barcha izohlarga javob beradi' },
            { val: 'keyword', label: 'Kalit so’z bo’yicha', desc: 'Faqat belgilangan so’zlar bo’lsa javob beradi' },
          ].map((opt) => (
            <button
              key={opt.val}
              onClick={() => up({ triggerType: opt.val as any })}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                form.triggerType === opt.val ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)] hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-sm">{opt.label}</div>
              <div className="text-xs text-[var(--muted)] mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>

        {form.triggerType === 'keyword' && (
          <div className="mt-3">
            <div className="flex gap-2 mb-2">
              <input
                value={kwInput}
                onChange={(e) => setKwInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKw())}
                placeholder="Kalit so'z kiriting..."
                className={inputCls}
              />
              <button onClick={addKw} className="px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-medium whitespace-nowrap">
                Qo'shish
              </button>
            </div>
            {form.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.keywords.map((kw) => (
                  <span key={kw} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs">
                    {kw}
                    <button onClick={() => up({ keywords: form.keywords.filter((k) => k !== kw) })} className="hover:text-red-500 leading-none">
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Amallar */}
      <Card title="Amallar" desc="{name} — foydalanuvchi nomi, {comment} — izoh matni">
        <div className="space-y-3">
          {/* Reply */}
          <div className={`rounded-xl border ${form.replyEnabled ? 'border-[var(--primary)]/50' : 'border-[var(--border)]'}`}>
            <button onClick={() => up({ replyEnabled: !form.replyEnabled })} className="w-full flex items-center justify-between px-4 py-3">
              <span className="flex items-center gap-2.5">
                <MessageSquare size={16} className={form.replyEnabled ? 'text-[var(--primary)]' : 'text-[var(--muted)]'} />
                <span className="font-medium text-sm">Izohga ochiq javob</span>
              </span>
              <Toggle on={form.replyEnabled} />
            </button>
            {form.replyEnabled && (
              <div className="px-4 pb-4 border-t border-[var(--border)] pt-3">
                {form.replyTemplates.map((tmpl, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <textarea
                      value={tmpl}
                      onChange={(e) => {
                        const arr = [...form.replyTemplates];
                        arr[i] = e.target.value;
                        up({ replyTemplates: arr });
                      }}
                      rows={2}
                      placeholder={`Javob shabloni ${i + 1}...`}
                      className={`${inputCls} resize-none`}
                    />
                    {form.replyTemplates.length > 1 && (
                      <button onClick={() => up({ replyTemplates: form.replyTemplates.filter((_, j) => j !== i) })} className="text-[var(--muted)] hover:text-red-500 self-start p-1 mt-1">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={() => up({ replyTemplates: [...form.replyTemplates, ''] })} className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline">
                  <Plus size={12} /> Shablon qo'shish
                </button>
                <p className="text-xs text-[var(--muted)] mt-2">Bir nechta shablon bo'lsa, tasodifiy bittasi tanlanadi.</p>
              </div>
            )}
          </div>

          {/* DM */}
          <div className={`rounded-xl border ${form.dmEnabled ? 'border-[var(--primary)]/50' : 'border-[var(--border)]'}`}>
            <button onClick={() => up({ dmEnabled: !form.dmEnabled })} className="w-full flex items-center justify-between px-4 py-3">
              <span className="flex items-center gap-2.5">
                <Send size={16} className={form.dmEnabled ? 'text-[var(--primary)]' : 'text-[var(--muted)]'} />
                <span className="font-medium text-sm">Shaxsiy xabar (DM)</span>
              </span>
              <Toggle on={form.dmEnabled} />
            </button>
            {form.dmEnabled && (
              <div className="px-4 pb-4 border-t border-[var(--border)] pt-3 space-y-3">
                <div>
                  {form.dmTemplates.map((tmpl, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <textarea
                        value={tmpl}
                        onChange={(e) => {
                          const arr = [...form.dmTemplates];
                          arr[i] = e.target.value;
                          up({ dmTemplates: arr });
                        }}
                        rows={2}
                        placeholder={`DM shabloni ${i + 1}...`}
                        className={`${inputCls} resize-none`}
                      />
                      {form.dmTemplates.length > 1 && (
                        <button onClick={() => up({ dmTemplates: form.dmTemplates.filter((_, j) => j !== i) })} className="text-[var(--muted)] hover:text-red-500 self-start p-1 mt-1">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => up({ dmTemplates: [...form.dmTemplates, ''] })} className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline">
                    <Plus size={12} /> Shablon qo'shish
                  </button>
                </div>

                {/* URL tugmalar */}
                <div className="pt-2 border-t border-[var(--border)]">
                  <p className="text-xs font-medium mb-1">&#128279; URL tugmalar <span className="text-[var(--muted)] font-normal">(ixtiyoriy, maks. 3 ta)</span></p>
                  {(form.dmButtons || []).map((btn, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input
                        value={btn.title}
                        onChange={(e) => {
                          const arr = [...form.dmButtons];
                          arr[i] = { ...arr[i], title: e.target.value };
                          up({ dmButtons: arr });
                        }}
                        placeholder="Tugma nomi"
                        className={`${inputCls} w-32`}
                      />
                      <input
                        value={btn.url}
                        onChange={(e) => {
                          const arr = [...form.dmButtons];
                          arr[i] = { ...arr[i], url: e.target.value };
                          up({ dmButtons: arr });
                        }}
                        placeholder="https://..."
                        className={inputCls}
                      />
                      <button onClick={() => up({ dmButtons: form.dmButtons.filter((_, j) => j !== i) })} className="text-[var(--muted)] hover:text-red-500 p-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {form.dmButtons.length < 3 && (
                    <button onClick={() => up({ dmButtons: [...form.dmButtons, { title: '', url: '' }] })} className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline">
                      <Plus size={12} /> Tugma qo'shish
                    </button>
                  )}
                </div>

                {/* Majburiy obunani tekshirish */}
                <div className="pt-2 border-t border-[var(--border)]">
                  <button
                    onClick={() => up({ followCheckEnabled: !form.followCheckEnabled })}
                    className="w-full flex items-center justify-between py-1"
                  >
                    <span className="flex items-center gap-2.5">
                      <UserCheck size={16} className={form.followCheckEnabled ? 'text-[var(--primary)]' : 'text-[var(--muted)]'} />
                      <span className="font-medium text-sm">Majburiy obunani tekshirish</span>
                    </span>
                    <Toggle on={form.followCheckEnabled} />
                  </button>

                  {form.followCheckEnabled && (
                    <div className="mt-3 space-y-3">
                      <p className="text-xs text-[var(--muted)]">
                        Asosiy DM yuborishdan oldin foydalanuvchiga obuna so'rovi yuboriladi.
                        Tugmani bosgach obunasi tekshiriladi — obuna bo'lsa yuqoridagi asosiy DM yuboriladi.
                      </p>

                      <div>
                        <label className="text-xs font-medium">So'rov xabari</label>
                        <textarea
                          value={form.followAskMessage}
                          onChange={(e) => up({ followAskMessage: e.target.value })}
                          rows={2}
                          placeholder="Ma'lumotni olish uchun tugmani bosing..."
                          className={`${inputCls} resize-none mt-1`}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium">So'rov tugmasi nomi</label>
                        <input
                          value={form.followAskButton}
                          onChange={(e) => up({ followAskButton: e.target.value })}
                          maxLength={20}
                          placeholder="Ma'lumotni olish"
                          className={`${inputCls} mt-1`}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium">Obuna bo'lmagan holatdagi xabar</label>
                        <textarea
                          value={form.followFailMessage}
                          onChange={(e) => up({ followFailMessage: e.target.value })}
                          rows={2}
                          placeholder="Siz hali obuna bo'lmagansiz..."
                          className={`${inputCls} resize-none mt-1`}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium">Qayta tekshirish tugmasi nomi</label>
                        <input
                          value={form.followFailButton}
                          onChange={(e) => up({ followFailButton: e.target.value })}
                          maxLength={20}
                          placeholder="Obuna bo'ldim"
                          className={`${inputCls} mt-1`}
                        />
                      </div>
                      <p className="text-[11px] text-[var(--muted)]">
                        Eslatma: tugma matni Instagram tomonidan 20 belgigacha cheklangan.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Postlar */}
      <Card title="Postlar" desc="Qaysi postlardagi izohlar hisobga olinsin?">
        <div className="space-y-2 mb-3">
          {[
            { val: 'all', label: 'Barcha postlar', desc: 'Har qanday post ostidagi izohlar', Icon: Globe },
            { val: 'specific', label: 'Tanlangan postlar', desc: 'Faqat siz tanlagan postlar', Icon: Hash },
          ].map((opt) => (
            <button
              key={opt.val}
              onClick={() => up({ postScope: opt.val as any, postIds: [], postData: [] })}
              className={`w-full text-left px-4 py-3 rounded-xl border flex items-center gap-3 ${
                form.postScope === opt.val ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)] hover:border-gray-300'
              }`}
            >
              <opt.Icon size={16} className={form.postScope === opt.val ? 'text-[var(--primary)]' : 'text-[var(--muted)]'} />
              <span className="flex-1">
                <span className="block font-medium text-sm">{opt.label}</span>
                <span className="block text-xs text-[var(--muted)] mt-0.5">{opt.desc}</span>
              </span>
              {opt.val === 'specific' && form.postScope === 'specific' && form.postIds.length > 0 && (
                <span className="text-xs text-[var(--primary)] font-medium bg-[var(--primary)]/10 px-2 py-0.5 rounded-full">{form.postIds.length} ta</span>
              )}
            </button>
          ))}
        </div>

        {form.postScope === 'specific' && (
          <div>
            {postsLoading ? (
              <div className="grid grid-cols-4 gap-2">
                {[...Array(8)].map((_, i) => <div key={i} className="aspect-square rounded-lg bg-[var(--bg)] animate-pulse" />)}
              </div>
            ) : posts.length === 0 ? (
              <p className="text-center py-6 text-[var(--muted)] text-sm">Post topilmadi</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {posts.map((post: any) => {
                  const selected = form.postIds.includes(post.id);
                  const thumb = post.thumbnail_url || post.media_url;
                  return (
                    <button
                      key={post.id}
                      onClick={() => togglePost(post)}
                      className={`relative rounded-xl overflow-hidden aspect-square border-2 ${selected ? 'border-[var(--primary)]' : 'border-transparent opacity-70 hover:opacity-100'}`}
                    >
                      {thumb ? (
                        <img src={thumb} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="w-full h-full bg-[var(--bg)] grid place-items-center"><MessageSquare size={14} className="text-[var(--muted)]" /></span>
                      )}
                      {selected && (
                        <span className="absolute inset-0 bg-[var(--primary)]/25 grid place-items-center">
                          <span className="w-6 h-6 rounded-full bg-[var(--primary)] grid place-items-center"><CheckCircle size={14} className="text-white" /></span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Card>

      {saveError && <p className="text-xs text-red-500 text-center">{saveError}</p>}
      {!canSave && <p className="text-xs text-[var(--muted)] text-center">Nom kiriting va kamida bitta amal (javob yoki DM) yoqing.</p>}
    </div>
  );
}

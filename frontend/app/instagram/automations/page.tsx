'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2, PenLine, Instagram, ArrowRight } from 'lucide-react';
import {
  getAutomations, createAutomation, updateAutomation,
  toggleAutomation, deleteAutomation, getInstagramPosts, getAccount,
  type Automation,
} from '@/lib/api';
import { AutomationForm } from '@/components/AutomationForm';
import { EMPTY_FORM, type FormState } from '@/components/types';

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className="switch"
      data-on={on}
    />
  );
}

export default function Page() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [kwInput, setKwInput] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [account, setAccount] = useState<any>(null);

  const load = async () => {
    try { setAutomations(await getAutomations()); }
    catch { setAutomations([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    getAccount().then(setAccount).catch(() => setAccount({ connected: false }));
  }, []);

  const loadPosts = async () => {
    setPostsLoading(true);
    try {
      const res = await getInstagramPosts();
      setPosts(res?.posts || []);
    } catch { setPosts([]); }
    finally { setPostsLoading(false); }
  };

  const up = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const addKw = () => {
    const v = kwInput.trim();
    if (v && !form.keywords.includes(v)) up({ keywords: [...form.keywords, v] });
    setKwInput('');
  };

  const togglePost = (post: any) => {
    const has = form.postIds.includes(post.id);
    if (has) {
      up({ postIds: form.postIds.filter((id) => id !== post.id), postData: form.postData.filter((p) => p.id !== post.id) });
    } else {
      up({
        postIds: [...form.postIds, post.id],
        postData: [...form.postData, { id: post.id, caption: post.caption, thumbnail: post.thumbnail_url || post.media_url }],
      });
    }
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setKwInput('');
    setSaveError(null);
    setView('form');
    loadPosts();
  };

  const openEdit = (a: Automation) => {
    setForm({
      name: a.name,
      triggerType: a.triggerType,
      keywords: a.keywords || [],
      replyEnabled: a.replyEnabled,
      replyTemplates: a.replyTemplates?.length ? a.replyTemplates : [''],
      dmEnabled: a.dmEnabled,
      dmTemplates: a.dmTemplates?.length ? a.dmTemplates : [''],
      dmButtons: a.dmButtons || [],
      followCheckEnabled: a.followCheckEnabled ?? false,
      followAskMessage: a.followAskMessage ?? EMPTY_FORM.followAskMessage,
      followAskButton: a.followAskButton ?? EMPTY_FORM.followAskButton,
      followFailMessage: a.followFailMessage ?? EMPTY_FORM.followFailMessage,
      followFailButton: a.followFailButton ?? EMPTY_FORM.followFailButton,
      postScope: a.postScope,
      postIds: a.postIds || [],
      postData: a.postData || [],
    });
    setEditingId(a.id);
    setKwInput('');
    setSaveError(null);
    setView('form');
    loadPosts();
  };

  const onSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        ...form,
        replyTemplates: form.replyTemplates.filter((t) => t.trim()),
        dmTemplates: form.dmTemplates.filter((t) => t.trim()),
        dmButtons: form.dmButtons.filter((b) => b.title.trim() && b.url.trim()),
      };
      if (editingId) await updateAutomation(editingId, payload);
      else await createAutomation(payload);
      await load();
      setView('list');
    } catch (e: any) {
      setSaveError(e.message || 'Saqlashda xato');
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (id: number) => {
    setAutomations((arr) => arr.map((a) => (a.id === id ? { ...a, isActive: !a.isActive } : a)));
    try { await toggleAutomation(id); } catch { load(); }
  };

  const onDelete = async (id: number) => {
    if (!confirm("Ushbu avtomatizatsiya o'chirilsinmi?")) return;
    setAutomations((arr) => arr.filter((a) => a.id !== id));
    try { await deleteAutomation(id); } catch { load(); }
  };

  if (view === 'form') {
    return (
      <AutomationForm
        form={form} kwInput={kwInput} setKwInput={setKwInput} up={up} addKw={addKw}
        togglePost={togglePost} posts={posts} postsLoading={postsLoading}
        saving={saving} saveError={saveError} onSave={onSave}
        onBack={() => setView('list')} editing={!!editingId}
      />
    );
  }

  const activeCount = automations.filter((a) => a.isActive).length;

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Instagram</p>
          <h1 className="title mt-2">Avtomatizatsiyalar</h1>
          <p className="subtitle mt-1.5 num">
            {loading
              ? 'Yuklanmoqda…'
              : automations.length
                ? `${automations.length} ta qoida · ${activeCount} tasi faol`
                : 'Hali qoida yo\'q'}
          </p>
        </div>
        <button onClick={openCreate} className="btn btn-primary">
          <Plus size={15} strokeWidth={2} /> Yangi qoida
        </button>
      </div>

      {account && !account.connected && (
        <Link href="/instagram/settings" className="panel mt-6 p-5 flex items-center gap-4 group hover:border-[var(--line-strong)] transition-colors">
          <span className="grid place-items-center w-10 h-10 rounded-full bg-[var(--accent-soft)]">
            <Instagram size={18} strokeWidth={1.75} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[14px] font-medium">Instagram akkauntingizni ulang</span>
            <span className="block subtitle mt-0.5">Usiz qoidalar ishlamaydi — bot javob beradigan akkaunt kerak.</span>
          </span>
          <ArrowRight size={16} strokeWidth={1.75} className="text-[var(--muted)] group-hover:text-[var(--ink)] group-hover:translate-x-0.5 transition-all" />
        </Link>
      )}

      <div className="mt-8">
        {loading ? (
          <div className="panel rows">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-5"><div className="skeleton h-4 w-40" /><div className="skeleton h-3 w-64 mt-3" /></div>
            ))}
          </div>
        ) : automations.length === 0 ? (
          <div className="panel px-6 py-16 text-center">
            <p className="text-[15px] font-medium">Birinchi qoidani yarating</p>
            <p className="subtitle mt-1.5 max-w-xs mx-auto">
              Kommentlarga avtomatik javob va DM shu yerdan boshqariladi.
            </p>
            <button onClick={openCreate} className="btn btn-outline mt-6">
              <Plus size={15} strokeWidth={2} /> Yangi qoida
            </button>
          </div>
        ) : (
          <div className="panel rows">
            {automations.map((a) => {
              const meta = [
                a.triggerType === 'keyword' ? `${a.keywords.length} kalit so'z` : 'Har qanday izoh',
                a.postScope === 'specific' ? `${a.postIds.length} ta post` : 'Barcha postlar',
              ];
              const actions = [a.replyEnabled && 'Javob', a.dmEnabled && 'DM', a.dmEnabled && a.followCheckEnabled && 'Obuna'].filter(Boolean) as string[];
              return (
                <div key={a.id} className="group flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className={`text-[14.5px] font-medium truncate ${a.isActive ? '' : 'text-[var(--muted)]'}`}>{a.name}</span>
                      {!a.isActive && <span className="eyebrow !text-[10px]">o&apos;chiq</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {actions.map((t) => <span key={t} className="chip">{t}</span>)}
                      <span className="text-[12px] text-[var(--muted)] ml-1 num">{meta.join(' · ')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(a)} className="icon-btn" aria-label="Tahrirlash" title="Tahrirlash">
                      <PenLine size={15} strokeWidth={1.75} />
                    </button>
                    <button onClick={() => onDelete(a.id)} className="icon-btn danger" aria-label="O'chirish" title="O'chirish">
                      <Trash2 size={15} strokeWidth={1.75} />
                    </button>
                    <span className="w-px h-5 bg-[var(--line)] mx-2" />
                    <Toggle on={a.isActive} onClick={() => onToggle(a.id)} label={`${a.name} — yoqish/o'chirish`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

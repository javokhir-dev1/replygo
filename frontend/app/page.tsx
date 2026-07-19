'use client';

import { useEffect, useState } from 'react';
import { Plus, Zap, MessageSquare, Send, Globe, Hash, Trash2, Pencil } from 'lucide-react';
import {
  getAutomations, createAutomation, updateAutomation,
  toggleAutomation, deleteAutomation, getInstagramPosts, getAccount,
  type Automation,
} from '@/lib/api';
import { AutomationForm } from '@/components/AutomationForm';
import { EMPTY_FORM, type FormState } from '@/components/types';

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 40, height: 22, borderRadius: 11, padding: 2,
        display: 'inline-flex', alignItems: 'center',
        backgroundColor: on ? '#7C3AED' : '#E5E7EB', transition: 'background-color .25s',
      }}
    >
      <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', transform: on ? 'translateX(18px)' : 'translateX(0)', transition: 'transform .25s' }} />
    </button>
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

  return (
    <div className="space-y-4">
      {/* Account status */}
      {account && (
        <div className={`rounded-xl px-4 py-2.5 text-sm flex items-center gap-2 ${account.connected ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
          <span className={`w-2 h-2 rounded-full ${account.connected ? 'bg-green-500' : 'bg-amber-500'}`} />
          {account.connected ? <>Ulangan: <b>@{account.username}</b></> : "Instagram akkaunt ulanmagan — .env dagi token/ID ni tekshiring"}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Avtomatizatsiyalar</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg,#7C3AED,#8B5CF6)' }}>
          <Plus size={16} /> Yangi
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-white border border-[var(--border)] animate-pulse" />)}
        </div>
      ) : automations.length === 0 ? (
        <div className="text-center py-16 text-[var(--muted)]">
          <Zap size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Hali avtomatizatsiya yo'q.</p>
          <button onClick={openCreate} className="mt-3 text-sm text-[var(--primary)] font-medium hover:underline">Birinchisini yarating</button>
        </div>
      ) : (
        <div className="space-y-2">
          {automations.map((a) => (
            <div key={a.id} className="rounded-xl bg-white border border-[var(--border)] p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">{a.name}</span>
                  {!a.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">o'chiq</span>}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-[var(--muted)]">
                  <span className="flex items-center gap-1">{a.triggerType === 'keyword' ? <Hash size={12} /> : <Globe size={12} />}{a.triggerType === 'keyword' ? `${a.keywords.length} kalit so'z` : 'Har qanday izoh'}</span>
                  {a.replyEnabled && <span className="flex items-center gap-1"><MessageSquare size={12} /> Javob</span>}
                  {a.dmEnabled && <span className="flex items-center gap-1"><Send size={12} /> DM</span>}
                  <span className="flex items-center gap-1">{a.postScope === 'specific' ? <><Hash size={12} /> {a.postIds.length} post</> : <><Globe size={12} /> Barcha</>}</span>
                </div>
              </div>
              <Toggle on={a.isActive} onClick={() => onToggle(a.id)} />
              <button onClick={() => openEdit(a)} className="p-2 text-[var(--muted)] hover:text-[var(--primary)]"><Pencil size={15} /></button>
              <button onClick={() => onDelete(a.id)} className="p-2 text-[var(--muted)] hover:text-red-500"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

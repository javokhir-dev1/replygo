'use client';

import { useEffect, useState } from 'react';
import { Trash2, RotateCw } from 'lucide-react';
import { getLogs, clearLogs } from '@/lib/api';

interface LogItem {
  id: number;
  type: string;
  action: string;
  message: string;
  user: string;
  userMessage: string;
  createdAt: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setLogs(await getLogs(200)); }
    catch { setLogs([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const onClear = async () => {
    if (!confirm("Barcha loglar o'chirilsinmi?")) return;
    setLogs([]);
    try { await clearLogs(); } catch { load(); }
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const okCount = logs.filter((l) => l.type === 'success').length;

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Tarix</p>
          <h1 className="title mt-2">Loglar</h1>
          <p className="subtitle mt-1.5 num">
            {loading
              ? 'Yuklanmoqda…'
              : logs.length
                ? `${logs.length} ta yozuv · ${okCount} muvaffaqiyatli · ${logs.length - okCount} xato`
                : 'Yozuv yo\'q'}
          </p>
        </div>
        <div className="flex gap-1">
          <button onClick={load} className="btn btn-ghost" aria-label="Yangilash">
            <RotateCw size={14} strokeWidth={1.75} /> Yangilash
          </button>
          {logs.length > 0 && (
            <button onClick={onClear} className="btn btn-danger">
              <Trash2 size={14} strokeWidth={1.75} /> Tozalash
            </button>
          )}
        </div>
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="panel rows">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-5"><div className="skeleton h-3.5 w-48" /><div className="skeleton h-3 w-72 mt-3" /></div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="panel px-6 py-16 text-center">
            <p className="text-[15px] font-medium">Hozircha bo&apos;sh</p>
            <p className="subtitle mt-1.5">Bot javob bergan yoki xato qilgan har bir holat shu yerda ko&apos;rinadi.</p>
          </div>
        ) : (
          <div className="panel rows">
            {logs.map((log) => {
              const ok = log.type === 'success';
              return (
                <div key={log.id} className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="dot" style={{ background: ok ? 'var(--good)' : 'var(--crit)' }} />
                    <span className="text-[13.5px] font-medium">{log.action}</span>
                    <span className="sr-only">{ok ? 'muvaffaqiyatli' : 'xato'}</span>
                    {log.user && <span className="text-[13px] text-[var(--muted)] truncate">@{log.user}</span>}
                    <span className="ml-auto text-[12px] text-[var(--muted)] whitespace-nowrap num">{fmt(log.createdAt)}</span>
                  </div>
                  {(log.userMessage || log.message) && (
                    <div className="pl-[18px] mt-2 space-y-1.5">
                      {log.userMessage && (
                        <p className="text-[13px] text-[var(--muted)] break-words">“{log.userMessage}”</p>
                      )}
                      {log.message && (
                        <p className={`text-[13.5px] break-words ${ok ? 'text-[var(--ink-2)]' : 'text-[var(--crit)] font-mono text-[12px]'}`}>
                          {ok ? '↳ ' : ''}{log.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

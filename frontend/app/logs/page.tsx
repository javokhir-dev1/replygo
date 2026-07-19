'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Trash2, RefreshCw } from 'lucide-react';
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

  const fmt = (d: string) => new Date(d).toLocaleString('uz-UZ');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Loglar</h1>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-white border border-[var(--border)] hover:bg-[var(--bg)]">
            <RefreshCw size={14} /> Yangilash
          </button>
          {logs.length > 0 && (
            <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-red-600 bg-white border border-[var(--border)] hover:bg-red-50">
              <Trash2 size={14} /> Tozalash
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-white border border-[var(--border)] animate-pulse" />)}</div>
      ) : logs.length === 0 ? (
        <p className="text-center py-16 text-[var(--muted)] text-sm">Hozircha log yo'q.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="rounded-xl bg-white border border-[var(--border)] p-3.5 flex gap-3">
              {log.type === 'success'
                ? <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" />
                : <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{log.action}</span>
                  <span className="text-xs text-[var(--muted)] whitespace-nowrap">{fmt(log.createdAt)}</span>
                </div>
                {log.user && <p className="text-xs text-[var(--muted)] mt-0.5">@{log.user}</p>}
                {log.userMessage && <p className="text-xs text-[var(--muted)] mt-1 italic">Izoh: “{log.userMessage}”</p>}
                {log.message && <p className="text-sm mt-1 break-words">{log.message}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

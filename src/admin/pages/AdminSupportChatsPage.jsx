import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import {
  fetchAdminSupportChat,
  fetchAdminSupportChats,
  replyAdminSupportChat,
  updateAdminSupportChat,
} from '../../api.js';

const STATUS_FILTERS = [
  { id: '', label: 'All' },
  { id: 'waiting_admin', label: 'Waiting' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'open', label: 'Open' },
  { id: 'resolved', label: 'Resolved' },
];

function formatWhen(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminSupportChatsPage() {
  const [statusFilter, setStatusFilter] = useState('waiting_admin');
  const [threads, setThreads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminSupportChats(statusFilter || undefined);
      setThreads(data.threads ?? []);
    } catch (err) {
      setThreads([]);
      setError(err.message || 'Could not load support chats.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [thread?.messages?.length]);

  const openThread = async (id) => {
    setSelectedId(id);
    setDetailLoading(true);
    setError(null);
    try {
      const data = await fetchAdminSupportChat(id);
      setThread(data.thread ?? null);
      await loadList();
    } catch (err) {
      setError(err.message || 'Could not open chat.');
    } finally {
      setDetailLoading(false);
    }
  };

  const sendReply = async (event) => {
    event.preventDefault();
    if (!selectedId || !draft.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await replyAdminSupportChat(selectedId, draft.trim());
      setThread(data.thread ?? null);
      setDraft('');
      await loadList();
    } catch (err) {
      setError(err.message || 'Could not send reply.');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status) => {
    if (!selectedId || busy) return;
    setBusy(true);
    try {
      const data = await updateAdminSupportChat(selectedId, { status });
      setThread(data.thread ?? null);
      await loadList();
    } catch (err) {
      setError(err.message || 'Could not update status.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="text-heading mb-1 text-xl font-extrabold">Support chat</h1>
      <p className="text-muted mb-4 text-sm">
        Messages from Settings → Support chat. Read the thread, fix the issue, then reply here.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((opt) => (
          <button
            key={opt.id || 'all'}
            type="button"
            onClick={() => setStatusFilter(opt.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
              statusFilter === opt.id
                ? 'bg-slate-800 text-white'
                : 'bg-white ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-slate-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-zinc-950">
          {loading ? (
            <p className="text-muted p-4 text-sm">Loading…</p>
          ) : threads.length === 0 ? (
            <p className="text-muted p-4 text-sm">No chats for this filter.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {threads.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openThread(item.id)}
                    className={`block w-full px-3 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-zinc-900 ${
                      selectedId === item.id ? 'bg-sky-50 dark:bg-sky-950/30' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{item.userEmail || 'Unknown user'}</p>
                      {item.unreadForAdmin > 0 ? (
                        <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {item.unreadForAdmin}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-muted mt-0.5 line-clamp-2 text-xs">
                      {item.preview || 'No messages yet'}
                    </p>
                    <p className="text-muted mt-1 text-[10px] font-semibold uppercase tracking-wide">
                      {item.status.replace('_', ' ')} · {formatWhen(item.lastMessageAt)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="min-h-[28rem] rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-zinc-950">
          {!selectedId ? (
            <p className="text-muted text-sm">Select a chat to read the transcript and reply.</p>
          ) : detailLoading ? (
            <p className="text-muted flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading chat…
            </p>
          ) : !thread ? (
            <p className="text-muted text-sm">Chat not found.</p>
          ) : (
            <div className="flex h-full min-h-[26rem] flex-col">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div>
                  <p className="text-heading text-sm font-bold">{thread.userEmail}</p>
                  <p className="text-muted text-xs">
                    Status: {thread.status.replace('_', ' ')} · Household:{' '}
                    {thread.householdId || '—'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setStatus('in_progress')}
                    className="rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    In progress
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setStatus('resolved')}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    Resolve
                  </button>
                </div>
              </div>

              <div className="mb-3 flex-1 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3 dark:bg-zinc-900/50">
                {(thread.messages ?? []).map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-xl px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-sky-100 text-sky-950 dark:bg-sky-950/50 dark:text-sky-100'
                        : 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100'
                    }`}
                  >
                    <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide opacity-70">
                      {msg.role === 'user' ? 'User' : 'You'} · {formatWhen(msg.createdAt)}
                    </p>
                    <p className="whitespace-pre-wrap">{msg.body}</p>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={sendReply} className="flex gap-2">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Reply to the user…"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-zinc-900"
                  disabled={busy}
                />
                <button
                  type="submit"
                  disabled={busy || !draft.trim()}
                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

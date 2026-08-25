import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import {
  closeAdminSupportChat,
  fetchAdminSupportChat,
  fetchAdminSupportChats,
  replyAdminSupportChat,
  updateAdminSupportChat,
} from '../../api.js';
import { supportThreadFingerprint, usePolling } from '../../hooks/usePolling.js';
import {
  isSupportLivePollingActive,
  msUntilSupportLiveIdle,
} from '../../support/supportChatLive.js';

const LIST_POLL_MS = 4000;
const THREAD_POLL_MS = 2500;

const STATUS_FILTERS = [
  { id: 'waiting_admin', label: 'Waiting' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'open', label: 'Open' },
  { id: '', label: 'Active' },
  { id: 'closed', label: 'Closed' },
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

function listFingerprint(threads) {
  return (threads ?? [])
    .map(
      (item) =>
        `${item.id}|${item.lastMessageAt ?? ''}|${item.unreadForAdmin ?? 0}|${item.status ?? ''}|${item.preview ?? ''}`,
    )
    .join(';');
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
  const [threadLiveActive, setThreadLiveActive] = useState(true);
  const bottomRef = useRef(null);
  const listFingerprintRef = useRef('');
  const threadFingerprintRef = useRef('');
  const busyRef = useRef(false);
  const selectedIdRef = useRef(null);
  const openedAtRef = useRef(Date.now());

  selectedIdRef.current = selectedId;
  busyRef.current = busy;

  const loadList = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      // Empty filter = all non-closed active-ish threads (open + waiting + in_progress + resolved)
      let data;
      if (statusFilter === '') {
        const [waiting, inProgress, open, resolved] = await Promise.all([
          fetchAdminSupportChats('waiting_admin'),
          fetchAdminSupportChats('in_progress'),
          fetchAdminSupportChats('open'),
          fetchAdminSupportChats('resolved'),
        ]);
        const byId = new Map();
        for (const list of [waiting.threads, inProgress.threads, open.threads, resolved.threads]) {
          for (const item of list ?? []) byId.set(item.id, item);
        }
        data = {
          threads: [...byId.values()].sort((a, b) =>
            String(b.lastMessageAt ?? '').localeCompare(String(a.lastMessageAt ?? '')),
          ),
        };
      } else {
        data = await fetchAdminSupportChats(statusFilter || undefined);
      }
      const next = data.threads ?? [];
      const fingerprint = listFingerprint(next);
      if (fingerprint !== listFingerprintRef.current) {
        listFingerprintRef.current = fingerprint;
        setThreads(next);
      }
    } catch (err) {
      if (!silent) {
        setThreads([]);
        setError(err.message || 'Could not load support chats.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [statusFilter]);

  const loadThread = useCallback(async (id, { silent = false } = {}) => {
    if (!id) return;
    if (!silent) {
      setDetailLoading(true);
      setError(null);
    }
    try {
      const data = await fetchAdminSupportChat(id);
      const next = data.thread ?? null;
      const fingerprint = supportThreadFingerprint(next);
      if (fingerprint !== threadFingerprintRef.current) {
        threadFingerprintRef.current = fingerprint;
        setThread(next);
      }
    } catch (err) {
      if (!silent) {
        setError(err.message || 'Could not open chat.');
      }
    } finally {
      if (!silent) setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    listFingerprintRef.current = '';
    void loadList({ silent: false });
  }, [loadList]);

  useEffect(() => {
    const updateLive = () => {
      setThreadLiveActive(isSupportLivePollingActive(thread, openedAtRef.current));
    };
    updateLive();
    const wait = msUntilSupportLiveIdle(thread, openedAtRef.current);
    if (wait <= 0) return undefined;
    const timer = window.setTimeout(updateLive, wait + 50);
    return () => window.clearTimeout(timer);
  }, [thread]);

  usePolling(
    () => {
      if (busyRef.current) return;
      return loadList({ silent: true });
    },
    { enabled: !loading, intervalMs: LIST_POLL_MS },
  );

  usePolling(
    () => {
      if (busyRef.current || !selectedIdRef.current) return;
      return loadThread(selectedIdRef.current, { silent: true });
    },
    {
      enabled:
        Boolean(selectedId) &&
        !detailLoading &&
        threadLiveActive &&
        thread?.status !== 'closed',
      intervalMs: THREAD_POLL_MS,
    },
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [thread?.messages?.length]);

  const openThread = async (id) => {
    setSelectedId(id);
    threadFingerprintRef.current = '';
    openedAtRef.current = Date.now();
    setThreadLiveActive(true);
    await loadThread(id, { silent: false });
    await loadList({ silent: true });
  };

  const sendReply = async (event) => {
    event.preventDefault();
    if (!selectedId || !draft.trim() || busy || thread?.status === 'closed') return;
    setBusy(true);
    busyRef.current = true;
    setError(null);
    try {
      const data = await replyAdminSupportChat(selectedId, draft.trim());
      const next = data.thread ?? null;
      threadFingerprintRef.current = supportThreadFingerprint(next);
      setThread(next);
      setDraft('');
      setThreadLiveActive(true);
      await loadList({ silent: true });
    } catch (err) {
      setError(err.message || 'Could not send reply.');
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };

  const setStatus = async (status) => {
    if (!selectedId || busy) return;
    setBusy(true);
    busyRef.current = true;
    try {
      const data = await updateAdminSupportChat(selectedId, { status });
      const next = data.thread ?? null;
      threadFingerprintRef.current = supportThreadFingerprint(next);
      setThread(next);
      await loadList({ silent: true });
    } catch (err) {
      setError(err.message || 'Could not update status.');
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };

  const closeConversation = async () => {
    if (!selectedId || busy || thread?.status === 'closed') return;
    if (
      !window.confirm(
        'Close this conversation?\n\nThe user will get a fresh support chat next time they message. You can still find this thread under Closed.',
      )
    ) {
      return;
    }
    setBusy(true);
    busyRef.current = true;
    setError(null);
    try {
      const data = await closeAdminSupportChat(selectedId);
      const next = data.thread ?? null;
      threadFingerprintRef.current = supportThreadFingerprint(next);
      setThread(next);
      setDraft('');
      await loadList({ silent: true });
    } catch (err) {
      setError(err.message || 'Could not close conversation.');
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };

  const isClosed = thread?.status === 'closed';

  return (
    <div>
      <h1 className="text-heading mb-1 text-xl font-extrabold">Support chat</h1>
      <p className="text-muted mb-4 text-sm">
        Live updates pause after 10 minutes without a user message. Close a conversation when the
        issue is done so the user starts fresh next time.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((opt) => (
          <button
            key={opt.id || 'active'}
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
                  {!threadLiveActive && !isClosed ? (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      Live thread updates paused (10 min idle). List still refreshes.
                    </p>
                  ) : null}
                  {isClosed ? (
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      Closed — user will start a new chat next time.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {!isClosed ? (
                    <>
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
                        onClick={closeConversation}
                        className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Close conversation
                      </button>
                    </>
                  ) : null}
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

              {!isClosed ? (
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
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

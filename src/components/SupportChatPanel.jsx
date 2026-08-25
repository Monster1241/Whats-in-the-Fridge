import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Loader2, MessageSquare, Send, User } from 'lucide-react';
import { fetchSupportChat, sendSupportChatMessage } from '../api.js';
import { supportThreadFingerprint, usePolling } from '../hooks/usePolling.js';
import {
  isSupportLivePollingActive,
  msUntilSupportLiveIdle,
} from '../support/supportChatLive.js';

const POLL_MS = 2500;

function formatWhen(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDay(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function roleLabel(role) {
  if (role === 'admin') return 'Support team';
  return 'You';
}

function statusLabel(status) {
  switch (status) {
    case 'waiting_admin':
      return 'Awaiting reply';
    case 'in_progress':
      return 'In progress';
    case 'resolved':
      return 'Resolved';
    case 'closed':
      return 'Closed';
    default:
      return 'Open';
  }
}

function previewText(text) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!value) return 'No messages yet';
  return value.length > 80 ? `${value.slice(0, 77)}…` : value;
}

export function SupportChatPanel() {
  const [thread, setThread] = useState(null);
  const [threads, setThreads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  const [liveActive, setLiveActive] = useState(true);
  const bottomRef = useRef(null);
  const fingerprintRef = useRef('');
  const sendingRef = useRef(false);
  const openedAtRef = useRef(Date.now());
  const selectedIdRef = useRef(null);

  selectedIdRef.current = selectedId;

  const applyThread = useCallback((next) => {
    const fingerprint = supportThreadFingerprint(next);
    if (fingerprint === fingerprintRef.current) return false;
    fingerprintRef.current = fingerprint;
    setThread(next);
    if (next?.id) setSelectedId(next.id);
    return true;
  }, []);

  const refresh = useCallback(async ({ silent = true, threadId } = {}) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const id = threadId !== undefined ? threadId : selectedIdRef.current;
      const data = await fetchSupportChat(id || undefined);
      const nextThreads = data.threads ?? [];
      setThreads(nextThreads);
      applyThread(data.thread ?? null);
    } catch (err) {
      if (!silent) {
        setError(err.message || 'Could not load support chat.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [applyThread]);

  useEffect(() => {
    openedAtRef.current = Date.now();
    void refresh({ silent: false, threadId: null });
  }, [refresh]);

  useEffect(() => {
    const updateLive = () => {
      setLiveActive(isSupportLivePollingActive(thread, openedAtRef.current));
    };
    updateLive();
    const wait = msUntilSupportLiveIdle(thread, openedAtRef.current);
    if (wait <= 0) return undefined;
    const timer = window.setTimeout(updateLive, wait + 50);
    return () => window.clearTimeout(timer);
  }, [thread]);

  usePolling(
    () => {
      if (sendingRef.current) return;
      return refresh({ silent: true });
    },
    { enabled: !loading && liveActive && thread?.status !== 'closed', intervalMs: POLL_MS },
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [thread?.messages?.length, sending]);

  const openThread = (id) => {
    if (!id || id === selectedId) return;
    fingerprintRef.current = '';
    setSelectedId(id);
    openedAtRef.current = Date.now();
    setLiveActive(true);
    void refresh({ silent: false, threadId: id });
  };

  const send = async (event) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    sendingRef.current = true;
    setError(null);
    setDraft('');
    try {
      const data = await sendSupportChatMessage(message);
      openedAtRef.current = Date.now();
      setLiveActive(true);
      const list = await fetchSupportChat(data.thread?.id);
      setThreads(list.threads ?? []);
      applyThread(list.thread ?? data.thread ?? null);
    } catch (err) {
      setDraft(message);
      setError(err.message || 'Could not send message.');
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  };

  if (loading && !thread && !threads.length) {
    return (
      <p className="text-muted flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Opening support chat…
      </p>
    );
  }

  const messages = thread?.messages ?? [];
  const closed = thread?.status === 'closed';
  const showHistory = threads.length > 1 || (threads.length === 1 && closed);

  return (
    <div className="flex min-h-[24rem] flex-col">
      <p className="text-muted mb-3 text-sm leading-relaxed">
        Conversations are saved to your account. Reopen an older chat anytime, or send a message to
        continue with the team.
      </p>

      {showHistory ? (
        <div className="mb-3 space-y-1.5">
          <p className="text-heading text-xs font-semibold uppercase tracking-wide">
            Saved conversations
          </p>
          <ul className="space-y-1.5">
            {threads.map((item) => {
              const selected = item.id === thread?.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openThread(item.id)}
                    className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition active:scale-[0.99] ${
                      selected
                        ? 'border-violet-400 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/40'
                        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-zinc-900'
                    }`}
                  >
                    <MessageSquare
                      className={`h-4 w-4 shrink-0 ${
                        selected ? 'text-violet-700 dark:text-violet-300' : 'text-slate-400'
                      }`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-heading text-xs font-semibold">
                          {formatDay(item.lastMessageAt || item.createdAt)}
                        </span>
                        <span className="text-muted shrink-0 text-[10px] font-medium uppercase tracking-wide">
                          {statusLabel(item.status)}
                        </span>
                      </span>
                      <span className="text-muted mt-0.5 block truncate text-xs">
                        {previewText(item.preview)}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {!liveActive && !closed ? (
        <p className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-zinc-900 dark:text-slate-300">
          Live updates paused after 10 minutes of inactivity. Send a message to resume, or pull to
          refresh by leaving and reopening this screen.
        </p>
      ) : null}

      {closed ? (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          This conversation is closed, but it stays in your history. Send a message below to start a
          new chat with support.
        </p>
      ) : null}

      {error ? (
        <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="mb-3 flex-1 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-zinc-900/60">
        {!messages.length ? (
          <p className="text-muted px-1 py-6 text-center text-sm">
            No messages yet. Describe the problem below and we&apos;ll keep the conversation here.
          </p>
        ) : null}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                  isUser
                    ? 'bg-sky-600 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-white/80">
                  <User className="h-3 w-3" aria-hidden />
                  {roleLabel(msg.role)}
                  <span className="font-medium normal-case tracking-normal opacity-80">
                    · {formatWhen(msg.createdAt)}
                  </span>
                </p>
                <p className="whitespace-pre-wrap">{msg.body}</p>
              </div>
            </div>
          );
        })}
        {sending ? (
          <p className="text-muted flex items-center gap-2 px-1 text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Sending…
          </p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={closed ? 'Start a new conversation…' : 'Describe the problem…'}
          maxLength={4000}
          disabled={sending}
          className="input-field min-w-0 flex-1"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-lg active:scale-95 disabled:opacity-45"
          aria-label="Send message"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </form>
    </div>
  );
}

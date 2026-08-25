import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ChevronRight,
  Headphones,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  User,
} from 'lucide-react';
import { fetchSupportChat, sendSupportChatMessage, startSupportChat } from '../api.js';
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

function isActiveStatus(status) {
  return Boolean(status && status !== 'closed');
}

/**
 * Support inbox: conversation list screen + full-screen chat.
 * @param {{ onBack?: () => void }} props
 */
export function SupportChatPanel({ onBack }) {
  const [screen, setScreen] = useState('list');
  const [thread, setThread] = useState(null);
  const [threads, setThreads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
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

  const refreshList = useCallback(async ({ silent = true } = {}) => {
    if (!silent) {
      setListLoading(true);
      setError(null);
    }
    try {
      const data = await fetchSupportChat();
      setThreads(data.threads ?? []);
    } catch (err) {
      if (!silent) {
        setError(err.message || 'Could not load support chats.');
      }
    } finally {
      if (!silent) setListLoading(false);
    }
  }, []);

  const refreshChat = useCallback(async ({ silent = true, threadId } = {}) => {
    const id = threadId !== undefined ? threadId : selectedIdRef.current;
    if (!id) return;
    if (!silent) {
      setChatLoading(true);
      setError(null);
    }
    try {
      const data = await fetchSupportChat(id);
      setThreads(data.threads ?? []);
      applyThread(data.thread ?? null);
    } catch (err) {
      if (!silent) {
        setError(err.message || 'Could not load this conversation.');
      }
    } finally {
      if (!silent) setChatLoading(false);
    }
  }, [applyThread]);

  useEffect(() => {
    void refreshList({ silent: false });
  }, [refreshList]);

  useEffect(() => {
    if (screen !== 'chat') return undefined;
    const updateLive = () => {
      setLiveActive(isSupportLivePollingActive(thread, openedAtRef.current));
    };
    updateLive();
    const wait = msUntilSupportLiveIdle(thread, openedAtRef.current);
    if (wait <= 0) return undefined;
    const timer = window.setTimeout(updateLive, wait + 50);
    return () => window.clearTimeout(timer);
  }, [screen, thread]);

  usePolling(
    () => {
      if (sendingRef.current) return;
      return refreshChat({ silent: true });
    },
    {
      enabled:
        screen === 'chat' && !chatLoading && liveActive && thread?.status !== 'closed',
      intervalMs: POLL_MS,
    },
  );

  useEffect(() => {
    if (screen !== 'chat') return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [screen, thread?.messages?.length, sending]);

  const openThread = async (id) => {
    if (!id) return;
    fingerprintRef.current = '';
    setSelectedId(id);
    setDraft('');
    setError(null);
    setScreen('chat');
    openedAtRef.current = Date.now();
    setLiveActive(true);
    await refreshChat({ silent: false, threadId: id });
  };

  const beginNewChat = async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const data = await startSupportChat();
      fingerprintRef.current = '';
      setDraft('');
      setThreads(data.threads ?? []);
      applyThread(data.thread ?? null);
      openedAtRef.current = Date.now();
      setLiveActive(true);
      setScreen('chat');
    } catch (err) {
      setError(err.message || 'Could not start a new chat.');
    } finally {
      setStarting(false);
    }
  };

  const backToList = () => {
    setScreen('list');
    setDraft('');
    setError(null);
    void refreshList({ silent: true });
  };

  const send = async (event) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending || thread?.status === 'closed') return;
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

  const messages = thread?.messages ?? [];
  const closed = thread?.status === 'closed';
  const activeThread = threads.find((item) => isActiveStatus(item.status));
  const newChatLabel = activeThread ? 'Open current chat' : 'Start a new chat';

  const listScreen = (
    <div className="pb-8">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="text-muted mb-5 inline-flex items-center gap-2 rounded-lg py-1.5 pr-2 text-sm font-semibold transition hover:text-emerald-700 active:scale-[0.98] dark:hover:text-emerald-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </button>
      ) : null}

      <header className="mb-5">
        <h1 className="text-heading flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <Headphones className="h-5 w-5 text-violet-600" aria-hidden />
          Support chat
        </h1>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          Conversations stay saved on your account. Open a past chat to read it, or start a new one.
        </p>
      </header>

      <div className="surface-card space-y-4 p-4">
        <button
          type="button"
          onClick={beginNewChat}
          disabled={starting || listLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white shadow-sm active:scale-[0.98] disabled:opacity-60"
        >
          {starting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" aria-hidden />
          )}
          {starting ? 'Opening…' : newChatLabel}
        </button>

        {error && screen === 'list' ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </p>
        ) : null}

        {listLoading ? (
          <p className="text-muted flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading conversations…
          </p>
        ) : threads.length === 0 ? (
          <p className="text-muted text-sm leading-relaxed">
            No saved chats yet. Tap Start a new chat to message the team.
          </p>
        ) : (
          <div className="space-y-1.5">
            <p className="text-heading text-xs font-semibold uppercase tracking-wide">
              Saved conversations
            </p>
            <ul className="space-y-1.5">
              {threads.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openThread(item.id)}
                    className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition active:scale-[0.99] dark:border-slate-700 dark:bg-zinc-900"
                  >
                    <MessageSquare className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden />
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
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );

  const chatScreen =
    typeof document !== 'undefined' && screen === 'chat'
      ? createPortal(
          <div
            className="fixed inset-0 z-[180] flex flex-col bg-slate-50 dark:bg-zinc-950"
            style={{
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Support conversation"
          >
            <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-zinc-900">
              <button
                type="button"
                onClick={backToList}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold text-slate-700 active:scale-[0.98] dark:text-slate-200"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden />
                Chats
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-heading truncate text-sm font-bold">Support team</p>
                <p className="text-muted truncate text-[11px] uppercase tracking-wide">
                  {statusLabel(thread?.status)}
                  {thread?.lastMessageAt ? ` · ${formatDay(thread.lastMessageAt)}` : ''}
                </p>
              </div>
            </header>

            {!liveActive && !closed ? (
              <p className="shrink-0 border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-zinc-900 dark:text-slate-300">
                Live updates paused after 10 minutes of inactivity. Send a message to resume.
              </p>
            ) : null}

            {closed ? (
              <div className="shrink-0 space-y-2 border-b border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40">
                <p className="text-xs text-amber-900 dark:text-amber-100">
                  This conversation is closed. You can still read it here.
                </p>
                <button
                  type="button"
                  onClick={beginNewChat}
                  disabled={starting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-60"
                >
                  {starting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Plus className="h-4 w-4" aria-hidden />
                  )}
                  {starting ? 'Opening…' : activeThread && activeThread.id !== thread?.id ? 'Open current chat' : 'Start a new chat'}
                </button>
              </div>
            ) : null}

            {error && screen === 'chat' ? (
              <p className="shrink-0 bg-rose-50 px-4 py-2 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
                {error}
              </p>
            ) : null}

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4">
              {chatLoading && !messages.length ? (
                <p className="text-muted flex items-center justify-center gap-2 py-16 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading conversation…
                </p>
              ) : null}
              {!chatLoading && !messages.length ? (
                <p className="text-muted px-2 py-16 text-center text-sm">
                  No messages yet. Describe the problem below and we&apos;ll keep the conversation
                  here.
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
                      className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                        isUser ? 'bg-sky-600 text-white' : 'bg-emerald-600 text-white'
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

            <form
              onSubmit={send}
              className="flex shrink-0 gap-2 border-t border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-zinc-900"
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={closed ? 'This chat is closed' : 'Describe the problem…'}
                maxLength={4000}
                disabled={sending || closed || chatLoading}
                className="input-field min-w-0 flex-1 disabled:cursor-not-allowed disabled:opacity-60"
                aria-disabled={closed}
              />
              <button
                type="submit"
                disabled={sending || closed || chatLoading || !draft.trim()}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-lg active:scale-95 disabled:opacity-45"
                aria-label="Send message"
              >
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </form>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {listScreen}
      {chatScreen}
    </>
  );
}

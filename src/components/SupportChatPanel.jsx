import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send, User } from 'lucide-react';
import { fetchSupportChat, sendSupportChatMessage } from '../api.js';

function formatWhen(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function roleLabel(role) {
  if (role === 'admin') return 'Support team';
  return 'You';
}

export function SupportChatPanel() {
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSupportChat();
      setThread(data.thread ?? null);
    } catch (err) {
      setError(err.message || 'Could not load support chat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [thread?.messages?.length, sending]);

  const send = async (event) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    setDraft('');
    try {
      const data = await sendSupportChatMessage(message);
      setThread(data.thread ?? null);
    } catch (err) {
      setDraft(message);
      setError(err.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <p className="text-muted flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Opening support chat…
      </p>
    );
  }

  const messages = thread?.messages ?? [];

  return (
    <div className="flex min-h-[24rem] flex-col">
      <p className="text-muted mb-3 text-sm leading-relaxed">
        We&apos;re here to help. Send a message below — the team will reply in this chat when
        available.
      </p>

      {error ? (
        <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="mb-3 flex-1 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-zinc-900/60">
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
          placeholder="Describe the problem…"
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

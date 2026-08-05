import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import { fetchPantryChefChat } from '../api.js';

const CHAT_CACHE_KEY = 'fridge.pantryChefChat';

const WELCOME_MESSAGE =
  "Hi! I'm Pantry Chef. Ask what to cook, how to substitute an ingredient, or how to use what's expiring soon.";

function toUserFacingChatError(message) {
  const text = String(message ?? '').trim();
  if (!text) return 'Could not reach Pantry Chef right now.';
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      const nested = parsed?.error?.message ?? parsed?.message;
      if (nested) return String(nested).split('\n')[0].trim();
    } catch {
      // fall through
    }
  }
  return text.split('\n')[0].trim();
}

function loadCachedMessages() {
  try {
    const raw = sessionStorage.getItem(CHAT_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (message) =>
        (message?.role === 'user' || message?.role === 'assistant') &&
        String(message.content ?? '').trim(),
    );
  } catch {
    return [];
  }
}

export function PantryChefChat() {
  const [messages, setMessages] = useState(loadCachedMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_CACHE_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage = { role: 'user', content: text };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput('');
    setIsLoading(true);
    setError('');

    try {
      const data = await fetchPantryChefChat(history);
      const reply = String(data?.reply ?? '').trim();
      if (reply) {
        setMessages((current) => [...current, { role: 'assistant', content: reply }]);
      }
    } catch (err) {
      setMessages((current) => current.slice(0, -1));
      setInput(text);
      const message = toUserFacingChatError(err?.message);
      if (/not authenticated|unauthorized/i.test(message)) {
        setError('Please sign in to chat with Pantry Chef.');
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, messages]);

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  const showWelcome = messages.length === 0;

  return (
    <div className="mt-4 rounded-xl border border-violet-200/80 bg-white/80 dark:border-violet-800/60 dark:bg-dm-surface/50">
      <div className="flex items-center gap-2 border-b border-violet-100 px-3 py-2.5 dark:border-violet-900/50">
        <MessageCircle className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
        <span className="text-xs font-bold uppercase tracking-wide text-violet-800 dark:text-violet-200">
          Ask Pantry Chef
        </span>
      </div>

      <div
        className="max-h-56 space-y-3 overflow-y-auto px-3 py-3"
        role="log"
        aria-live="polite"
        aria-label="Pantry Chef chat"
      >
        {showWelcome && (
          <div className="flex justify-start">
            <p className="max-w-[90%] rounded-2xl rounded-bl-md bg-violet-100 px-3 py-2 text-sm leading-relaxed text-violet-950 dark:bg-violet-950/50 dark:text-violet-100">
              {WELCOME_MESSAGE}
            </p>
          </div>
        )}

        {messages.map((message, index) => {
          const isUser = message.role === 'user';
          return (
            <div key={`${message.role}-${index}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <p
                className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  isUser
                    ? 'rounded-br-md bg-violet-600 text-white'
                    : 'rounded-bl-md bg-violet-100 text-violet-950 dark:bg-violet-950/50 dark:text-violet-100'
                }`}
              >
                {message.content}
              </p>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start">
            <p className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-violet-100 px-3 py-2 text-sm text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Thinking…
            </p>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {error && (
        <p
          className="mx-3 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="flex gap-2 border-t border-violet-100 p-3 dark:border-violet-900/50">
        <label className="sr-only" htmlFor="pantry-chef-chat-input">
          Message Pantry Chef
        </label>
        <input
          ref={inputRef}
          id="pantry-chef-chat-input"
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about meals, substitutions, or expiring items…"
          disabled={isLoading}
          className="min-w-0 flex-1 rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:opacity-60 dark:border-violet-800 dark:bg-dm-raised dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-violet-900"
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
          className="flex shrink-0 items-center justify-center rounded-xl bg-violet-600 px-3 py-2.5 text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}

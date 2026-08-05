import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send, Sparkles } from 'lucide-react';
import { fetchFridgeScoutChat } from '../api.js';
import {
  FRIDGE_SCOUT_CHAT_CACHE_KEY,
  FRIDGE_SCOUT_NAME,
  FRIDGE_SCOUT_PERSONA,
  FRIDGE_SCOUT_QUICK_PROMPTS,
  FRIDGE_SCOUT_WELCOME,
} from '../recipes/kitchenAiBranding.js';

function toUserFacingChatError(message) {
  const text = String(message ?? '').trim();
  if (!text) return `Could not reach ${FRIDGE_SCOUT_NAME} right now.`;
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
    const keys = [FRIDGE_SCOUT_CHAT_CACHE_KEY, 'fridge.pantryChefChat'];
    for (const key of keys) {
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      const messages = parsed.filter(
        (message) =>
          (message?.role === 'user' || message?.role === 'assistant') &&
          String(message.content ?? '').trim(),
      );
      if (messages.length) return messages;
    }
    return [];
  } catch {
    return [];
  }
}

function ScoutAvatar({ compact = false }) {
  return (
    <span
      className={`fridge-scout-avatar ${compact ? 'fridge-scout-avatar--sm' : ''}`}
      aria-hidden
    >
      <Sparkles className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={2.25} />
    </span>
  );
}

export function FridgeScoutChat() {
  const [messages, setMessages] = useState(loadCachedMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(FRIDGE_SCOUT_CHAT_CACHE_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = useCallback(
    async (textOverride) => {
      const text = String(textOverride ?? input).trim();
      if (!text || isLoading) return;

      const userMessage = { role: 'user', content: text };
      const history = [...messages, userMessage];
      setMessages(history);
      setInput('');
      setIsLoading(true);
      setError('');

      try {
        const data = await fetchFridgeScoutChat(history);
        const reply = String(data?.reply ?? '').trim();
        if (reply) {
          setMessages((current) => [...current, { role: 'assistant', content: reply }]);
        }
      } catch (err) {
        setMessages((current) => current.slice(0, -1));
        if (!textOverride) setInput(text);
        const message = toUserFacingChatError(err?.message);
        if (/not authenticated|unauthorized/i.test(message)) {
          setError(`Please sign in to chat with ${FRIDGE_SCOUT_NAME}.`);
        } else {
          setError(message);
        }
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [input, isLoading, messages],
  );

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  const showWelcome = messages.length === 0;

  return (
    <div className="fridge-scout-chat">
      <div className="fridge-scout-chat__header">
        <div className="flex min-w-0 items-center gap-2.5">
          <ScoutAvatar />
          <div className="min-w-0">
            <p className="fridge-scout-chat__title">Chat with {FRIDGE_SCOUT_PERSONA}</p>
            <p className="fridge-scout-chat__subtitle">Ask about meals, swaps &amp; expiring food</p>
          </div>
        </div>
        <span className="fridge-scout-chat__live" title="AI assistant online">
          <span className="fridge-scout-chat__live-dot" aria-hidden />
          Live
        </span>
      </div>

      <div
        className="fridge-scout-chat__thread"
        role="log"
        aria-live="polite"
        aria-label={`${FRIDGE_SCOUT_NAME} chat`}
      >
        {showWelcome && (
          <div className="fridge-scout-chat__row fridge-scout-chat__row--assistant">
            <ScoutAvatar compact />
            <p className="fridge-scout-chat__bubble fridge-scout-chat__bubble--assistant">
              {FRIDGE_SCOUT_WELCOME}
            </p>
          </div>
        )}

        {messages.map((message, index) => {
          const isUser = message.role === 'user';
          return (
            <div
              key={`${message.role}-${index}`}
              className={`fridge-scout-chat__row ${
                isUser ? 'fridge-scout-chat__row--user' : 'fridge-scout-chat__row--assistant'
              }`}
            >
              {!isUser && <ScoutAvatar compact />}
              <p
                className={`fridge-scout-chat__bubble whitespace-pre-wrap ${
                  isUser
                    ? 'fridge-scout-chat__bubble--user'
                    : 'fridge-scout-chat__bubble--assistant'
                }`}
              >
                {message.content}
              </p>
            </div>
          );
        })}

        {isLoading && (
          <div className="fridge-scout-chat__row fridge-scout-chat__row--assistant">
            <ScoutAvatar compact />
            <p className="fridge-scout-chat__bubble fridge-scout-chat__bubble--assistant fridge-scout-chat__bubble--typing">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {FRIDGE_SCOUT_PERSONA} is thinking…
            </p>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {showWelcome && (
        <div className="fridge-scout-chat__prompts" aria-label="Suggested questions">
          {FRIDGE_SCOUT_QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => sendMessage(prompt)}
              disabled={isLoading}
              className="fridge-scout-chat__prompt-chip"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="fridge-scout-chat__error" role="alert">
          {error}
        </p>
      )}

      <div className="fridge-scout-chat__composer">
        <label className="sr-only" htmlFor="fridge-scout-chat-input">
          Message {FRIDGE_SCOUT_NAME}
        </label>
        <input
          ref={inputRef}
          id="fridge-scout-chat-input"
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Scout anything about your fridge…"
          disabled={isLoading}
          className="fridge-scout-chat__input"
        />
        <button
          type="button"
          onClick={() => sendMessage()}
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
          className="fridge-scout-chat__send"
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

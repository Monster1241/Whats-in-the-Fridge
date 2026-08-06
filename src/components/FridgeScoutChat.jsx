import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Loader2,
  MoreVertical,
  RotateCcw,
  Send,
  Sparkles,
  ThumbsUp,
  User,
} from 'lucide-react';
import { fetchFridgeScoutChat } from '../api.js';
import {
  FRIDGE_SCOUT_CHAT_CACHE_KEY,
  FRIDGE_SCOUT_NAME,
  FRIDGE_SCOUT_PERSONA,
  FRIDGE_SCOUT_QUICK_PROMPTS,
  FRIDGE_SCOUT_TAGLINE,
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

function toApiMessages(messages) {
  return messages.map(({ role, content }) => ({ role, content }));
}

function ScoutAvatar({ size = 'md' }) {
  return (
    <span className={`fridge-scout-messenger__avatar fridge-scout-messenger__avatar--${size}`} aria-hidden>
      <Sparkles className={size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5'} strokeWidth={2.25} />
    </span>
  );
}

function TypingIndicator() {
  return (
    <div className="fridge-scout-messenger__typing" aria-label={`${FRIDGE_SCOUT_PERSONA} is typing`}>
      <span />
      <span />
      <span />
    </div>
  );
}

export const FridgeScoutChat = forwardRef(function FridgeScoutChat(
  { expanded = false, fullscreen = false },
  ref,
) {
  const [messages, setMessages] = useState(loadCachedMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(-1);
  const [likedIndices, setLikedIndices] = useState(() => new Set());
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const messagesRef = useRef(messages);
  const menuRef = useRef(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        FRIDGE_SCOUT_CHAT_CACHE_KEY,
        JSON.stringify(messages.map(({ role, content, summary }) => ({ role, content, summary }))),
      );
    } catch {
      // ignore
    }
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [menuOpen]);

  const sendMessage = useCallback(
    async (textOverride, { summary, keepInputOnError = false, replaceFromIndex = null } = {}) => {
      const text = String(textOverride ?? input).trim();
      if (!text || isLoading) return false;

      const baseHistory =
        replaceFromIndex === null
          ? messagesRef.current
          : messagesRef.current.slice(0, replaceFromIndex);

      const userMessage = { role: 'user', content: text, summary: summary?.trim() || '' };
      const history = [...baseHistory, userMessage];
      setMessages(history);
      if (!textOverride) setInput('');
      setIsLoading(true);
      setError('');

      try {
        const data = await fetchFridgeScoutChat(toApiMessages(history));
        const reply = String(data?.reply ?? '').trim();
        if (reply) {
          setMessages((current) => [...current, { role: 'assistant', content: reply }]);
        }
        return true;
      } catch (err) {
        setMessages((current) => current.slice(0, -1));
        if (!textOverride || keepInputOnError) setInput(text);
        const message = toUserFacingChatError(err?.message);
        if (/not authenticated|unauthorized/i.test(message)) {
          setError(`Please sign in to chat with ${FRIDGE_SCOUT_NAME}.`);
        } else {
          setError(message);
        }
        return false;
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [input, isLoading],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setInput('');
    setError('');
    setMenuOpen(false);
    setCopiedIndex(-1);
    setLikedIndices(new Set());
    try {
      sessionStorage.removeItem(FRIDGE_SCOUT_CHAT_CACHE_KEY);
    } catch {
      // ignore
    }
    inputRef.current?.focus();
  }, []);

  const regenerateReply = useCallback(
    async (assistantIndex) => {
      const prior = messagesRef.current[assistantIndex - 1];
      if (!prior || prior.role !== 'user') return;
      setMessages((current) => current.slice(0, assistantIndex));
      await sendMessage(prior.content, {
        summary: prior.summary,
        replaceFromIndex: assistantIndex - 1,
      });
    },
    [sendMessage],
  );

  async function copyMessage(text, index) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(-1), 1600);
    } catch {
      // ignore
    }
  }

  function toggleLike(index) {
    setLikedIndices((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  useImperativeHandle(
    ref,
    () => ({
      sendMessage: (text, options) => sendMessage(text, options),
      focus: () => inputRef.current?.focus(),
    }),
    [sendMessage],
  );

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  const showWelcome = messages.length === 0;

  return (
    <div
      className={`fridge-scout-messenger ${expanded ? 'fridge-scout-messenger--expanded' : ''} ${
        fullscreen ? 'fridge-scout-messenger--fullscreen' : ''
      }`}
    >
      <header className="fridge-scout-messenger__topbar">
        <div className="fridge-scout-messenger__brand">
          <ScoutAvatar size="lg" />
          <div className="min-w-0">
            <p className="fridge-scout-messenger__title">{FRIDGE_SCOUT_NAME}</p>
            <p className="fridge-scout-messenger__subtitle">{FRIDGE_SCOUT_TAGLINE}</p>
          </div>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="fridge-scout-messenger__menu-btn"
            aria-label="Chat options"
            aria-expanded={menuOpen}
          >
            <MoreVertical className="h-4 w-4" aria-hidden />
          </button>
          {menuOpen && (
            <div className="fridge-scout-messenger__menu">
              <button type="button" onClick={clearChat} className="fridge-scout-messenger__menu-item">
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Clear chat
              </button>
            </div>
          )}
        </div>
      </header>

      <div
        className="fridge-scout-messenger__thread"
        role="log"
        aria-live="polite"
        aria-label={`${FRIDGE_SCOUT_NAME} chat`}
      >
        {showWelcome && (
          <div className="fridge-scout-messenger__msg fridge-scout-messenger__msg--assistant">
            <ScoutAvatar />
            <div className="fridge-scout-messenger__card">
              <p className="fridge-scout-messenger__card-text">{FRIDGE_SCOUT_WELCOME}</p>
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          const isUser = message.role === 'user';
          const displayText =
            isUser && message.summary ? message.summary : message.content;

          if (isUser) {
            return (
              <div
                key={`${message.role}-${index}`}
                className="fridge-scout-messenger__msg fridge-scout-messenger__msg--user"
              >
                <div className="fridge-scout-messenger__user-bubble">{displayText}</div>
                <span className="fridge-scout-messenger__user-avatar" aria-hidden>
                  <User className="h-3.5 w-3.5" />
                </span>
              </div>
            );
          }

          return (
            <div
              key={`${message.role}-${index}`}
              className="fridge-scout-messenger__msg fridge-scout-messenger__msg--assistant"
            >
              <ScoutAvatar />
              <div className="fridge-scout-messenger__card">
                <p className="fridge-scout-messenger__card-text whitespace-pre-wrap">
                  {message.content}
                </p>
                <div className="fridge-scout-messenger__actions">
                  <button
                    type="button"
                    className="fridge-scout-messenger__action"
                    onClick={() => copyMessage(message.content, index)}
                    aria-label="Copy reply"
                  >
                    {copiedIndex === index ? (
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                  <button
                    type="button"
                    className={`fridge-scout-messenger__action ${
                      likedIndices.has(index) ? 'fridge-scout-messenger__action--active' : ''
                    }`}
                    onClick={() => toggleLike(index)}
                    aria-label="Like reply"
                    aria-pressed={likedIndices.has(index)}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="fridge-scout-messenger__action fridge-scout-messenger__action--regen"
                    onClick={() => regenerateReply(index)}
                    disabled={isLoading}
                    aria-label="Regenerate reply"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="fridge-scout-messenger__msg fridge-scout-messenger__msg--assistant">
            <ScoutAvatar />
            <div className="fridge-scout-messenger__card fridge-scout-messenger__card--typing">
              <TypingIndicator />
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {showWelcome && (
        <div className="fridge-scout-messenger__prompts shrink-0" aria-label="Suggested questions">
          {FRIDGE_SCOUT_QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => sendMessage(prompt)}
              disabled={isLoading}
              className="fridge-scout-messenger__prompt-chip"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="fridge-scout-messenger__error" role="alert">
          {error}
        </p>
      )}

      <footer className="fridge-scout-messenger__footer shrink-0">
        <div className="fridge-scout-messenger__composer-pill">
          <label className="sr-only" htmlFor="fridge-scout-chat-input">
            Message {FRIDGE_SCOUT_NAME}
          </label>
          <textarea
            ref={inputRef}
            id="fridge-scout-chat-input"
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send message…"
            disabled={isLoading}
            className="fridge-scout-messenger__input"
          />
          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
            className="fridge-scout-messenger__send"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </footer>
    </div>
  );
});

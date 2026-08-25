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
import {
  getDietaryPreferenceModeLabel,
  isDietaryPreferenceActive,
  normalizeDietaryPreference,
} from '../recipes/dietaryPreferences.js';

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

/**
 * Lightweight, dependency-free Markdown-ish renderer for Fridge Scout replies.
 * - Treats `***` / `---` lines as dividers
 * - Renders `**bold**` and inline backtick `code`
 * - Renders bullet lists (`- `, `* `, `• `) and ordered lists (`1. `)
 * - Splits paragraphs by blank lines for better spacing
 *
 * This is intentionally conservative (no HTML) to keep the chat safe.
 * @param {string} input
 */
function renderScoutMarkdown(input) {
  const text = String(input ?? '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');

  /** @type {Array<{ type: 'hr'|'heading'|'ul'|'ol'|'p', [key: string]: unknown }>} */
  const blocks = [];

  /** @type {string[]} */
  let paragraph = [];

  const flushParagraph = () => {
    const p = paragraph.join('\n').trim();
    if (p) blocks.push({ type: 'p', text: p });
    paragraph = [];
  };

  const isHr = (line) => {
    const t = line.trim();
    return t === '***' || t === '---' || t === '___';
  };

  const parseInline = (raw) => {
    const s = String(raw ?? '');
    const nodes = [];
    const tokenRe = /(\*\*([^*]+)\*\*)|(`([^`]+)`)/g;
    let last = 0;
    let m;
    // eslint-disable-next-line no-cond-assign
    while ((m = tokenRe.exec(s))) {
      const start = m.index;
      if (start > last) {
        nodes.push({ type: 'text', text: s.slice(last, start) });
      }

      if (m[2]) {
        nodes.push({ type: 'strong', text: m[2] });
      } else if (m[4]) {
        nodes.push({ type: 'code', text: m[4] });
      }
      last = start + m[0].length;
    }
    if (last < s.length) nodes.push({ type: 'text', text: s.slice(last) });

    return nodes.map((n, idx) => {
      if (n.type === 'strong') {
        return (
          <strong key={idx} className="font-extrabold">
            {n.text}
          </strong>
        );
      }
      if (n.type === 'code') {
        return (
          <code
            key={idx}
            className="rounded-md bg-black/[0.06] px-1 py-0.5 font-mono text-[11px] dark:bg-white/10"
          >
            {n.text}
          </code>
        );
      }
      return (
        <span key={idx}>
          {n.text}
        </span>
      );
    });
  };

  const renderParagraphText = (pText) => {
    const parts = String(pText ?? '').split('\n');
    return parts.map((line, idx) => (
      <span key={idx}>
        {parseInline(line)}
        {idx < parts.length - 1 ? <br /> : null}
      </span>
    ));
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (isHr(line)) {
      flushParagraph();
      blocks.push({ type: 'hr' });
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      blocks.push({ type: 'heading', level, text: headingMatch[2] });
      continue;
    }

    const ulMatch = trimmed.match(/^([-*•])\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      const items = [ulMatch[2]];
      while (i + 1 < lines.length && /^([-*•])\s+/.test(String(lines[i + 1]).trim())) {
        const next = String(lines[i + 1]).trim();
        const m2 = next.match(/^([-*•])\s+(.+)$/);
        if (m2?.[2]) items.push(m2[2]);
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      const items = [olMatch[2]];
      while (i + 1 < lines.length && /^\d+\.\s+/.test(String(lines[i + 1]).trim())) {
        const next = String(lines[i + 1]).trim();
        const m2 = next.match(/^(\d+)\.\s+(.+)$/);
        if (m2?.[2]) items.push(m2[2]);
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Default: accumulate paragraph text (preserve original line breaks inside paragraphs).
    paragraph.push(line);
  }
  flushParagraph();

  return (
    <div className="space-y-3">
      {blocks.map((block, idx) => {
        if (block.type === 'hr') {
          return (
            <hr
              // eslint-disable-next-line react/no-array-index-key
              key={idx}
              className="my-1 border-black/[0.08] dark:border-white/10"
            />
          );
        }
        if (block.type === 'heading') {
          const level = Number(block.level ?? 3);
          const text = String(block.text ?? '');
          const cls =
            level === 1
              ? 'text-base font-extrabold'
              : level === 2
                ? 'text-sm font-extrabold'
                : 'text-sm font-bold';
          return (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={idx}
              className={cls}
            >
              {parseInline(text)}
            </div>
          );
        }
        if (block.type === 'ul') {
          const items = Array.isArray(block.items) ? block.items : [];
          return (
            <ul
              // eslint-disable-next-line react/no-array-index-key
              key={idx}
              className="list-disc space-y-1 pl-5"
            >
              {items.map((it, j) => (
                <li key={`${idx}-${j}`} className="leading-relaxed">
                  {parseInline(String(it))}
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === 'ol') {
          const items = Array.isArray(block.items) ? block.items : [];
          return (
            <ol
              // eslint-disable-next-line react/no-array-index-key
              key={idx}
              className="list-decimal space-y-1 pl-5"
            >
              {items.map((it, j) => (
                <li key={`${idx}-${j}`} className="leading-relaxed">
                  {parseInline(String(it))}
                </li>
              ))}
            </ol>
          );
        }

        // Paragraph (default)
        const pText = String(block.text ?? '');
        return (
          <p
            // eslint-disable-next-line react/no-array-index-key
            key={idx}
            className="text-sm leading-relaxed"
          >
            {renderParagraphText(pText)}
          </p>
        );
      })}
    </div>
  );
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
  { expanded = false, fullscreen = false, dietaryPreference = 'none' },
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
  const activeDietaryPreference = normalizeDietaryPreference(dietaryPreference);
  const dietaryModeLabel = getDietaryPreferenceModeLabel(activeDietaryPreference);
  const showDietaryBadge = isDietaryPreferenceActive(activeDietaryPreference);

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
            {showDietaryBadge && (
              <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                <Sparkles className="h-2.5 w-2.5" aria-hidden />
                {dietaryModeLabel}
              </p>
            )}
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
                <div className="fridge-scout-messenger__card-text">
                  {renderScoutMarkdown(message.content)}
                </div>
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

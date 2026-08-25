/** Stop live polling after this much idle time with no user message. */
export const SUPPORT_LIVE_IDLE_MS = 10 * 60 * 1000;

/**
 * @param {{ messages?: Array<{ role?: string, createdAt?: string|null }> } | null | undefined} thread
 * @returns {number|null} epoch ms of last user message, or null
 */
export function getLastUserMessageTime(thread) {
  const messages = Array.isArray(thread?.messages) ? thread.messages : [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role !== 'user') continue;
    const ts = new Date(messages[i].createdAt ?? '').getTime();
    if (Number.isFinite(ts)) return ts;
  }
  return null;
}

/**
 * Live polling stays on until 10 minutes after the last user message
 * (or after `openedAtMs` if the user has not sent anything yet).
 *
 * @param {{ messages?: Array<{ role?: string, createdAt?: string|null }> } | null | undefined} thread
 * @param {number} openedAtMs
 * @param {number} [nowMs]
 */
export function isSupportLivePollingActive(thread, openedAtMs, nowMs = Date.now()) {
  const lastUserAt = getLastUserMessageTime(thread);
  const anchor = lastUserAt ?? openedAtMs;
  if (!Number.isFinite(anchor)) return false;
  return nowMs - anchor < SUPPORT_LIVE_IDLE_MS;
}

/**
 * @param {{ messages?: Array<{ role?: string, createdAt?: string|null }> } | null | undefined} thread
 * @param {number} openedAtMs
 * @param {number} [nowMs]
 */
export function msUntilSupportLiveIdle(thread, openedAtMs, nowMs = Date.now()) {
  const lastUserAt = getLastUserMessageTime(thread);
  const anchor = lastUserAt ?? openedAtMs;
  if (!Number.isFinite(anchor)) return 0;
  return Math.max(0, SUPPORT_LIVE_IDLE_MS - (nowMs - anchor));
}

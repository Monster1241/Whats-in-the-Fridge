/** Values replaced in logs — never write raw sensitive user data to server logs. */
export const REDACTED = '[redacted]';

const SENSITIVE_JSON_KEYS = new Set([
  'password',
  'idtoken',
  'id_token',
  'token',
  'authorization',
  'receipt',
  'inventory',
  'items',
  'messages',
  'email',
  'code',
  'gemini_api_key',
]);

/**
 * @param {string} email
 */
export function redactEmail(email) {
  const value = String(email ?? '').trim();
  if (!value.includes('@')) return REDACTED;
  const [local, domain] = value.split('@');
  if (!local || !domain) return REDACTED;
  if (local.length <= 1) return `*@${domain}`;
  return `${local[0]}***@${domain}`;
}

/**
 * Strip inventory, tokens, and long payloads from error text before logging.
 * @param {unknown} err
 */
export function safeErrorForLog(err) {
  if (!err) return REDACTED;

  const raw =
    typeof err === 'string'
      ? err
      : String(err.message ?? err.status ?? 'Error');

  return raw
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, REDACTED)
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b/g, REDACTED)
    .replace(/\{[\s\S]{120,}\}/g, '{…}')
    .slice(0, 280);
}

/**
 * @param {unknown} value
 * @param {number} [depth]
 */
export function redactForLog(value, depth = 0) {
  if (depth > 4) return REDACTED;
  if (value == null) return value;
  if (typeof value === 'string') {
    if (value.length > 160) return `${value.slice(0, 40)}…${REDACTED}`;
    if (value.includes('@')) return redactEmail(value);
    return value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    if (value.length > 8) return `[${value.length} items ${REDACTED}]`;
    return value.map((entry) => redactForLog(entry, depth + 1));
  }

  /** @type {Record<string, unknown>} */
  const next = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_JSON_KEYS.has(key.toLowerCase())) {
      next[key] = REDACTED;
      continue;
    }
    next[key] = redactForLog(entry, depth + 1);
  }
  return next;
}

export function isProductionEnvironment() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Dev-only helper — never logs verification codes in production.
 * @param {string} label
 * @param {string} email
 * @param {string} [devOnlyDetail]
 */
export function logDevOnlySensitive(label, email, devOnlyDetail) {
  if (isProductionEnvironment()) {
    console.warn(`${label} ${redactEmail(email)} (${REDACTED})`);
    return;
  }
  console.log(`${label} dev-only ${redactEmail(email)}${devOnlyDetail ? `: ${devOnlyDetail}` : ''}`);
}

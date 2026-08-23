import { ensureDb } from './ensureDb.js';
import { findUserById } from './db.js';
import { getBearerUser } from './auth.js';
import { toFriendlyError } from './errors.js';

/**
 * Comma-separated admin emails (case-insensitive).
 * Example: ADMIN_EMAILS=you@example.com,partner@example.com
 */
export function getAdminEmails() {
  return String(process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email) {
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!normalized) return false;
  const allowlist = getAdminEmails();
  if (allowlist.length === 0) return false;
  return allowlist.includes(normalized);
}

/**
 * CLI / cron bearer secret (optional fallback for scripts).
 */
export function verifyDealsAdminSecret(req) {
  const secret =
    process.env.DEALS_ADMIN_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';

  const header = String(req.headers.authorization ?? '');
  return header === `Bearer ${secret}`;
}

export function adminUnauthorized(res, message = 'Admin access required.') {
  res.status(403).json({ error: message });
}

async function requireAuthUser(req, res) {
  const session = getBearerUser(req);
  if (!session) {
    res.status(401).json({ error: 'Not authenticated.' });
    return null;
  }

  try {
    await ensureDb();
  } catch (err) {
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 503).json({ error: friendly.message });
    return null;
  }

  const user = await findUserById(session.userId);
  if (!user) {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
    return null;
  }

  if (!user.isVerified) {
    res.status(403).json({ error: 'Verify your email before using admin tools.' });
    return null;
  }

  return { session, user };
}

/**
 * Admin via JWT (allowlisted email) or legacy bearer secret for scripts.
 */
export async function requireAdmin(req, res) {
  if (verifyDealsAdminSecret(req)) {
    return { method: 'secret', user: null, session: null };
  }

  const auth = await requireAuthUser(req, res);
  if (!auth) return null;

  if (!isAdminEmail(auth.user.email)) {
    adminUnauthorized(res, 'Your account is not on the admin allowlist.');
    return null;
  }

  return { ...auth, method: 'session' };
}

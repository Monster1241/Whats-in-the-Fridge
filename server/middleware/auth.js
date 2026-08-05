import { getBearerUser } from '../auth.js';
import { ensureDb } from '../ensureDb.js';
import { findUserById } from '../db.js';
import { toFriendlyError } from '../errors.js';

/**
 * Express middleware: validates Bearer JWT, loads the user, and attaches `req.user`.
 * Requires a verified account with an active household session.
 */
export async function requireAuth(req, res, next) {
  const session = getBearerUser(req);
  if (!session) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  try {
    await ensureDb();
  } catch (err) {
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 503).json({ error: friendly.message });
    return;
  }

  const user = await findUserById(session.userId);
  if (!user) {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
    return;
  }

  if (!user.isVerified) {
    res.status(403).json({ error: 'Email not verified. Please verify your account first.' });
    return;
  }

  if (!user.household_id) {
    res.status(403).json({ error: 'Join or create a household to continue.' });
    return;
  }

  const jwtHouseholdId = session.householdId ?? null;
  if (jwtHouseholdId !== user.household_id) {
    res.status(403).json({ error: 'Household access denied. Please sign in again.' });
    return;
  }

  req.user = {
    id: user.id,
    email: user.email,
    household_id: user.household_id,
    isVerified: user.isVerified,
  };

  next();
}

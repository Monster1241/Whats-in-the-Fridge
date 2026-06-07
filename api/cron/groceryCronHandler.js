import { connectDb } from '../../server/db.js';
import { getMongoUri } from '../../server/env.js';
import {
  normalizeGroceryRefreshMode,
  refreshGroceryData,
} from '../../server/groceryDataRefresh.js';
import {
  getSydneyClock,
  getSydneyCronSkipReason,
  isSydneyGroceryCronDue,
  SYDNEY_TZ,
} from '../../server/sydneyCronGuard.js';

function unauthorized(res) {
  res.status(401).json({ error: 'Unauthorized cron request.' });
}

function verifyCronSecret(req) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';

  const header = String(req.headers.authorization ?? '');
  return header === `Bearer ${secret}`;
}

/**
 * @param {'sneakPeek'|'officialReset'} defaultMode
 */
export function createGroceryCronHandler(defaultMode) {
  return async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed.' });
      return;
    }

    if (!verifyCronSecret(req)) {
      unauthorized(res);
      return;
    }

    const mode = normalizeGroceryRefreshMode(
      req.query?.mode ?? req.body?.mode ?? defaultMode,
    );
    if (!mode) {
      res.status(400).json({ error: "mode must be 'sneakPeek' or 'officialReset'." });
      return;
    }

    const now = new Date();
    const sydney = getSydneyClock(now);
    const force = String(req.query?.force ?? '').toLowerCase() === 'true';

    if (!force && !isSydneyGroceryCronDue(mode, now)) {
      res.status(200).json({
        ok: true,
        skipped: true,
        mode,
        timezone: SYDNEY_TZ,
        sydney,
        reason: getSydneyCronSkipReason(mode, now),
      });
      return;
    }

    const resolved = getMongoUri();
    if (resolved.error) {
      res.status(503).json({ error: resolved.error });
      return;
    }

    try {
      await connectDb(resolved.uri);
      const result = await refreshGroceryData(mode, { now });
      res.status(200).json({
        ...result,
        timezone: SYDNEY_TZ,
        sydney,
        forced: force,
      });
    } catch (err) {
      console.error(`GET /api/cron/${mode}`, err);
      res.status(500).json({ error: err.message || 'Grocery refresh failed.' });
    }
  };
}

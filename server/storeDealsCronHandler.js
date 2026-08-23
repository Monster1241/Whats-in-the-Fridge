import { connectDb } from './db.js';
import { getMongoUri } from './env.js';
import { getStoresDueForDealRefresh } from './dealStoreSchedule.js';
import { refreshDueStoreDeals } from './groceryDataRefresh.js';
import { getSydneyClock, SYDNEY_TZ } from './sydneyCronGuard.js';

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
 * Vercel / manual cron — refreshes deals only for stores whose Sydney window is due.
 */
export async function handleStoreDealsCron(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  if (!verifyCronSecret(req)) {
    unauthorized(res);
    return;
  }

  const now = new Date();
  const sydney = getSydneyClock(now);
  const force = String(req.query?.force ?? '').toLowerCase() === 'true';
  const due = getStoresDueForDealRefresh(now);

  if (!force && due.length === 0) {
    res.status(200).json({
      ok: true,
      skipped: true,
      timezone: SYDNEY_TZ,
      sydney,
      reason: 'No per-store deal windows are due in the current Sydney minute.',
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
    const result = await refreshDueStoreDeals(now);
    res.status(200).json({
      ok: true,
      timezone: SYDNEY_TZ,
      sydney,
      forced: force,
      ...result,
    });
  } catch (err) {
    console.error('GET /api/cron/store-deals', err);
    res.status(500).json({ error: err.message || 'Store deal refresh failed.' });
  }
}

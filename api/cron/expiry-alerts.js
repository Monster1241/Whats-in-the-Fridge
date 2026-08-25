import { connectDb } from '../../server/db.js';
import { runExpiryAlerts } from '../../server/expiryAlerts.js';
import { runFeedbackNudges } from '../../server/feedbackNudge.js';
import { getMongoUri } from '../../server/env.js';

function unauthorized(res) {
  res.status(401).json({ error: 'Unauthorized cron request.' });
}

function verifyCronSecret(req) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';

  const header = String(req.headers.authorization ?? '');
  return header === `Bearer ${secret}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  if (!verifyCronSecret(req)) {
    unauthorized(res);
    return;
  }

  const resolved = getMongoUri();
  if (resolved.error) {
    res.status(503).json({ error: resolved.error });
    return;
  }

  try {
    const db = await connectDb(resolved.uri);
    const result = await runExpiryAlerts(db);
    const feedbackNudge = await runFeedbackNudges(db).catch((err) => {
      console.error('feedback nudge cron', err);
      return { error: err.message || 'Feedback nudge failed.' };
    });
    res.status(200).json({ ...result, feedbackNudge });
  } catch (err) {
    console.error('GET /api/cron/expiry-alerts', err);
    res.status(500).json({ error: err.message || 'Expiry alerts failed.' });
  }
}

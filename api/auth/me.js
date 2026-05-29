import { handleMe } from '../../server/handlers.js';
import { handleOptions, isRequestAllowed, sendError, setCors } from '../../server/http.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    handleOptions(req, res);
    return;
  }
  if (!isRequestAllowed(req)) {
    res.status(403).json({ error: 'Origin not allowed' });
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    await handleMe(req, res);
  } catch (err) {
    console.error('GET /api/auth/me', err);
    sendError(res, err, 'Session check failed');
  }
}

import { handleHealth } from '../server/handlers.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    await handleHealth(req, res);
  } catch (err) {
    console.error('GET /api/health', err);
    res.status(500).json({ error: err.message || 'Health check failed' });
  }
}

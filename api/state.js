import { handleGetState, handlePutState } from '../server/handlers.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      await handleGetState(req, res);
      return;
    }
    if (req.method === 'PUT') {
      await handlePutState(req, res);
      return;
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(`${req.method} /api/state`, err);
    res.status(500).json({
      error: err.message || 'Failed to access MongoDB.',
    });
  }
}

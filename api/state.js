import { handleGetState, handlePutState } from '../server/handlers.js';
import { isOriginAllowed } from '../server/env.js';

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Household-Code');
}

function isRequestAllowed(req) {
  const origin = req.headers.origin;
  return isOriginAllowed(origin);
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    if (!isRequestAllowed(req)) {
      res.status(403).json({ error: 'Origin not allowed' });
      return;
    }
    res.status(204).end();
    return;
  }

  if (!isRequestAllowed(req)) {
    res.status(403).json({ error: 'Origin not allowed' });
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

import { isOriginAllowed } from './env.js';

export function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function isRequestAllowed(req) {
  const origin = req.headers.origin;
  return isOriginAllowed(origin);
}

export function handleOptions(req, res) {
  if (!isRequestAllowed(req)) {
    res.status(403).json({ error: 'Origin not allowed' });
    return false;
  }
  res.status(204).end();
  return true;
}

export function sendError(res, err, fallback = 'Request failed') {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || fallback });
}

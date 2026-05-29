import { handleGetState, handlePutState } from '../server/handlers.js';
import { handleOptions, isRequestAllowed, sendError, setCors } from '../server/http.js';

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
    sendError(res, err, 'Failed to access MongoDB.');
  }
}

import { handleRemoveHouseholdMember } from '../../../server/handlers.js';
import { handleOptions, isRequestAllowed, sendError, setCors } from '../../../server/http.js';

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
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    await handleRemoveHouseholdMember(req, res);
  } catch (err) {
    console.error('POST /api/household/members/remove', err);
    sendError(res, err, 'Could not remove household member');
  }
}

/**
 * Restricts access to authorized accounts (beta / internal testing).
 * Must run after `requireAuth` so `req.user` is populated.
 */
export function whitelist(req, res, next) {
  console.log('=== WHITELIST DEBUG ===');
  console.log('Incoming req.user:', req.user);
  console.log('Incoming user email:', req.user?.email);
  console.log('Raw WHITELISTED_EMAILS env:', process.env.WHITELISTED_EMAILS);
  console.log('Raw WHITELISTED_EMAIL env:', process.env.WHITELISTED_EMAIL);

  const allowedStr = process.env.WHITELISTED_EMAILS || process.env.WHITELISTED_EMAIL || '';
  const allowedEmails = allowedStr
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const userEmail = req.user?.email?.trim().toLowerCase();

  console.log('Parsed allowedEmails:', allowedEmails);
  console.log('Normalized userEmail:', userEmail);

  if (userEmail && allowedEmails.includes(userEmail)) {
    return next();
  }

  const payload = {
    error: 'AI matching is not available for this account.',
  };

  if (process.env.NODE_ENV !== 'production') {
    payload.debugEmail = userEmail || 'No email found in req.user';
  }

  return res.status(403).json(payload);
}

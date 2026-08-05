/**
 * Restricts access to authorized accounts (beta / internal testing).
 * Must run after `requireAuth` so `req.user` is populated.
 */
function parseWhitelistedEmails(raw) {
  return String(raw ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function whitelist(req, res, next) {
  const allowedEmails = parseWhitelistedEmails(process.env.WHITELISTED_EMAILS);
  const email = req.user?.email?.trim().toLowerCase();

  if (email && allowedEmails.includes(email)) {
    next();
    return;
  }

  res.status(403).json({ error: 'AI matching is not available for this account.' });
}

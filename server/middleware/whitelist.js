/**
 * Restricts access to a single authorized account (beta / internal testing).
 * Must run after `requireAuth` so `req.user` is populated.
 */
export function whitelist(req, res, next) {
  const allowed = process.env.WHITELISTED_EMAIL?.trim().toLowerCase();
  const email = req.user?.email?.trim().toLowerCase();

  if (allowed && email && email === allowed) {
    next();
    return;
  }

  res.status(403).json({ error: 'Access restricted to authorized account.' });
}

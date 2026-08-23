/**
 * Protects deal curation endpoints (manual price verification).
 * Set DEALS_ADMIN_SECRET in Vercel / .env — falls back to CRON_SECRET.
 */
export function verifyDealsAdminSecret(req) {
  const secret =
    process.env.DEALS_ADMIN_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';

  const header = String(req.headers.authorization ?? '');
  return header === `Bearer ${secret}`;
}

export function dealsAdminUnauthorized(res) {
  res.status(401).json({
    error: 'Unauthorized. Set Authorization: Bearer <DEALS_ADMIN_SECRET>.',
  });
}

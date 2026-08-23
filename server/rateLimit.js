/**
 * In-memory sliding-window limiter. Counts IP or signed-in user id only —
 * never inventory contents — matching the privacy policy.
 *
 * @param {{ windowMs: number, max: number, message?: string, keyPrefix?: string }} options
 */
export function createRateLimiter({
  windowMs,
  max,
  message = 'Too many requests. Please try again later.',
  keyPrefix = 'rl',
}) {
  const hits = new Map();

  function prune(now) {
    if (hits.size < 500) return;
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }

  return function rateLimit(req, res, next) {
    const now = Date.now();
    prune(now);

    const forwarded = String(req.headers['x-forwarded-for'] ?? '')
      .split(',')[0]
      .trim();
    const ip = forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
    const userId = req.user?.id ? String(req.user.id) : '';
    const key = `${keyPrefix}:${userId || ip}`;

    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: message });
      return;
    }

    next();
  };
}

export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  keyPrefix: 'auth',
  message: 'Too many sign-in attempts. Please wait and try again.',
});

export const householdJoinRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: 'join',
  message: 'Too many household join attempts. Please wait and try again.',
});

export const geminiRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  keyPrefix: 'gemini',
  message: 'AI request limit reached. Please wait a minute and try again.',
});

export const supportRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 15,
  keyPrefix: 'support',
  message: 'Too many support submissions. Please try again later.',
});

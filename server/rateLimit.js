import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const RATE_LIMIT_MESSAGE = { error: 'Too many requests. Please try again later.' };

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

function isDevelopment() {
  return process.env.NODE_ENV !== 'production';
}

function isRateLimitDisabled() {
  const flag = String(process.env.DISABLE_RATE_LIMIT ?? '').trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

function isLocalDevRequest(req) {
  const ip = String(req.ip ?? req.socket?.remoteAddress ?? '');
  const hostname = String(req.hostname ?? '').toLowerCase();
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.includes('127.0.0.1') ||
    hostname === 'localhost'
  );
}

/**
 * Skip Express rate limits during local development and when explicitly disabled.
 * When skipped, counters are not incremented (in-memory store resets on server restart).
 */
export function shouldSkipRateLimit(req) {
  if (isRateLimitDisabled()) return true;
  if (isDevelopment()) return true;
  return isLocalDevRequest(req);
}

function createLimiter({ max, windowMs = FIFTEEN_MINUTES_MS, message = RATE_LIMIT_MESSAGE }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    handler: (_req, res) => {
      res.status(429).json(message);
    },
  });
}

/** General API routes: 100 requests / 15 minutes per IP. */
export const generalApiLimiter = createLimiter({ max: 100 });

/** External proxy routes (deals, recipes, product lookup): 30 / 15 minutes per IP. */
export const proxyApiLimiter = createLimiter({ max: 30 });

const AI_RECIPE_RATE_LIMIT_MESSAGE = {
  error: 'AI Chef is resting!',
  message: "You've reached your limit of 5 recipe generations. Try again in 15 minutes.",
};

/** Gemini AI recipe match: 5 / 15 minutes per authenticated user (falls back to IP). */
export const aiRecipeMatchLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipRateLimit,
  keyGenerator: (req) => {
    if (req.user?.id) return `user:${req.user.id}`;
    return ipKeyGenerator(req.ip ?? '');
  },
  handler: (_req, res) => {
    res.status(429).json(AI_RECIPE_RATE_LIMIT_MESSAGE);
  },
});

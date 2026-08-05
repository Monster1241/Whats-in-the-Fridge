import rateLimit from 'express-rate-limit';

const RATE_LIMIT_MESSAGE = { error: 'Too many requests. Please try again later.' };

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

function createLimiter({ max, windowMs = FIFTEEN_MINUTES_MS }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json(RATE_LIMIT_MESSAGE);
    },
  });
}

/** General API routes: 100 requests / 15 minutes per IP. */
export const generalApiLimiter = createLimiter({ max: 100 });

/** External proxy routes (deals, recipes, product lookup): 30 / 15 minutes per IP. */
export const proxyApiLimiter = createLimiter({ max: 30 });

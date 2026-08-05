import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const RATE_LIMIT_MESSAGE = { error: 'Too many requests. Please try again later.' };

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

function createLimiter({ max, windowMs = FIFTEEN_MINUTES_MS, message = RATE_LIMIT_MESSAGE }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
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
  error: 'AI Chef is resting! You can generate recipe matches up to 10 times every 15 minutes.',
};

/** Gemini AI recipe match: 10 / 15 minutes per authenticated user (falls back to IP). */
export const aiRecipeMatchLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user?.id) return `user:${req.user.id}`;
    return ipKeyGenerator(req.ip ?? '');
  },
  handler: (_req, res) => {
    res.status(429).json(AI_RECIPE_RATE_LIMIT_MESSAGE);
  },
});

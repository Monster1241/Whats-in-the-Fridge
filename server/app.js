import express from 'express';
import cors from 'cors';
import { isOriginAllowed } from './env.js';
import { handleHealth } from './handlers.js';
import { asyncRoute } from './routeUtils.js';
import { generalApiLimiter, proxyApiLimiter } from './rateLimit.js';
import { authRouter } from './routes/auth.js';
import { householdRouter } from './routes/household.js';
import { stateRouter } from './routes/state.js';
import { dealsRouter } from './routes/deals.js';
import { recipesRouter } from './routes/recipes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    cors({
      origin(origin, callback) {
        if (isOriginAllowed(origin)) return callback(null, true);
        return callback(new Error('CORS origin denied'));
      },
    }),
  );
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', asyncRoute(handleHealth, 'GET /api/health', 'Health check failed'));

  app.use('/api/deals', proxyApiLimiter, dealsRouter);
  app.use('/api/recipes', proxyApiLimiter, recipesRouter);
  app.use('/api/products', proxyApiLimiter);

  app.use('/api/auth', generalApiLimiter, authRouter);
  app.use('/api/household', generalApiLimiter, householdRouter);
  app.use('/api/state', generalApiLimiter, stateRouter);

  return app;
}

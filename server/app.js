import express from 'express';
import cors from 'cors';
import { isOriginAllowed } from './env.js';
import { handleHealth } from './handlers.js';
import { asyncRoute } from './routeUtils.js';
import { authRouter } from './routes/auth.js';
import { householdRouter } from './routes/household.js';
import { stateRouter } from './routes/state.js';
import { productsRouter } from './routes/products.js';

export function createApp() {
  const app = express();

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

  app.use('/api/auth', authRouter);
  app.use('/api/household', householdRouter);
  app.use('/api/state', stateRouter);
  app.use('/api/products', productsRouter);

  return app;
}

import { Router } from 'express';
import { handleGetState, handlePutState } from '../handlers.js';
import { asyncRoute } from '../routeUtils.js';

export const stateRouter = Router();

stateRouter.get(
  '/',
  asyncRoute(handleGetState, 'GET /api/state', 'Failed to load data from MongoDB.'),
);
stateRouter.put(
  '/',
  asyncRoute(handlePutState, 'PUT /api/state', 'Failed to save data to MongoDB.'),
);

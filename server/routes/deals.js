import { Router } from 'express';
import { handleGetWeeklyDeals } from '../handlers.js';
import { asyncRoute } from '../routeUtils.js';

export const dealsRouter = Router();

dealsRouter.get(
  '/weekly',
  asyncRoute(handleGetWeeklyDeals, 'GET /api/deals/weekly', 'Could not load weekly deals.'),
);

import { Router } from 'express';
import { handleGetStoreCatalogues, handleGetWeeklyDeals } from '../handlers.js';
import { asyncRoute } from '../routeUtils.js';

export const dealsRouter = Router();

dealsRouter.get(
  '/weekly',
  asyncRoute(handleGetWeeklyDeals, 'GET /api/deals/weekly', 'Could not load weekly deals.'),
);
dealsRouter.get(
  '/catalogues',
  asyncRoute(
    handleGetStoreCatalogues,
    'GET /api/deals/catalogues',
    'Could not load store catalogues.',
  ),
);

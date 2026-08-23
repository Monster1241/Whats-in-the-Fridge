import { Router } from 'express';
import {
  handleGetStoreCatalogues,
  handleGetWeeklyDeals,
  handleListUnverifiedDeals,
  handleVerifyWeeklyDeals,
} from '../handlers.js';
import { asyncRoute } from '../routeUtils.js';

export const dealsRouter = Router();

dealsRouter.get(
  '/admin/unverified',
  asyncRoute(
    handleListUnverifiedDeals,
    'GET /api/deals/admin/unverified',
    'Could not list unverified deals.',
  ),
);
dealsRouter.post(
  '/admin/verify',
  asyncRoute(
    handleVerifyWeeklyDeals,
    'POST /api/deals/admin/verify',
    'Could not verify deals.',
  ),
);

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

import { Router } from 'express';
import { handleProductAutocomplete } from '../handlers.js';
import { asyncRoute } from '../routeUtils.js';

export const productsRouter = Router();

productsRouter.get(
  '/autocomplete',
  asyncRoute(
    handleProductAutocomplete,
    'GET /api/products/autocomplete',
    'Could not load product suggestions.',
  ),
);

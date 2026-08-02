import { Router } from 'express';
import { asyncRoute } from '../routeUtils.js';

const THEMEALDB_BASE = 'https://www.themealdb.com/api/json/v1/1';

async function fetchTheMealDb(path) {
  const res = await fetch(`${THEMEALDB_BASE}${path}`);
  if (!res.ok) {
    const err = new Error('Recipe lookup service unavailable.');
    err.status = 502;
    throw err;
  }
  return res.json();
}

export const recipesRouter = Router();

recipesRouter.get(
  '/search',
  asyncRoute(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) {
      res.json({ meals: [] });
      return;
    }
    const data = await fetchTheMealDb(`/search.php?s=${encodeURIComponent(q)}`);
    res.json({ meals: data.meals ?? [] });
  }, 'GET /api/recipes/search', 'Recipe search failed'),
);

recipesRouter.get(
  '/by-ingredient',
  asyncRoute(async (req, res) => {
    const raw = String(req.query.i ?? '').trim();
    if (raw.length < 2) {
      res.json({ meals: [] });
      return;
    }
    const ingredient = raw.toLowerCase().replace(/\s+/g, '_');
    const data = await fetchTheMealDb(`/filter.php?i=${encodeURIComponent(ingredient)}`);
    res.json({ meals: data.meals ?? [] });
  }, 'GET /api/recipes/by-ingredient', 'Ingredient recipe search failed'),
);

recipesRouter.get(
  '/lookup/:mealId',
  asyncRoute(async (req, res) => {
    const mealId = String(req.params.mealId ?? '').trim();
    if (!mealId) {
      res.status(400).json({ error: 'mealId required' });
      return;
    }
    const data = await fetchTheMealDb(`/lookup.php?i=${encodeURIComponent(mealId)}`);
    res.json({ meal: data.meals?.[0] ?? null });
  }, 'GET /api/recipes/lookup/:mealId', 'Recipe lookup failed'),
);

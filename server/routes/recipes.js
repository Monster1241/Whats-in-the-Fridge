import { Router } from 'express';
import { asyncRoute } from '../routeUtils.js';
import { requireAuth } from '../middleware/auth.js';
import { generateAILiveMatches, remixRecipe } from '../controllers/aiRecipe.js';
import { isGeminiQuotaError } from '../errors.js';

const THEMEALDB_BASE = 'https://www.themealdb.com/api/json/v1/1';

export const GOOGLE_AI_QUOTA_ERROR =
  'Daily Google AI quota reached. Please try again tomorrow.';

function getErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  const raw = error;
  return String(raw.message ?? raw.error?.message ?? '');
}

function getErrorStatus(error) {
  const status = Number(error?.status ?? error?.statusCode ?? 0);
  if (Number.isFinite(status) && status >= 400 && status < 600) return status;
  const message = getErrorMessage(error);
  if (message.includes('429')) return 429;
  return 500;
}

function sendGeminiRouteError(res, error, fallback = 'Failed to generate AI recipe.') {
  console.error('Gemini API Error Detail:', error);
  if (isGeminiQuotaError(error)) {
    res.status(429).json({ error: GOOGLE_AI_QUOTA_ERROR });
    return;
  }
  const status = getErrorStatus(error);
  const message = getErrorMessage(error) || fallback;
  res.status(status).json({ error: message });
}

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

recipesRouter.post(
  '/ai-match',
  requireAuth,
  async (req, res) => {
    try {
      await generateAILiveMatches(req, res);
    } catch (error) {
      sendGeminiRouteError(res, error);
    }
  },
);

recipesRouter.post(
  '/remix',
  requireAuth,
  async (req, res) => {
    try {
      await remixRecipe(req, res);
    } catch (error) {
      sendGeminiRouteError(res, error, 'Failed to remix AI recipe.');
    }
  },
);

/**
 * Seed households.recipeLibrary with free recipes from TheMealDB.
 *
 * Usage:
 *   node server/scripts/seedRecipes.js --household-id <mongoObjectId>
 *   node server/scripts/seedRecipes.js --all
 *   node server/scripts/seedRecipes.js --household-id <id> --limit 40 --terms chicken,curry,pasta
 */
import 'dotenv/config';
import { connectDb, closeDb, upsertHouseholdRecipes } from '../db.js';
import { getMongoUri } from '../env.js';
import { sanitizeRecipeEntry } from '../recipeSchema.js';
import { mapMealToRecipe } from '../../src/recipes/themealdbMapper.js';

const THEMEALDB_BASE = 'https://www.themealdb.com/api/json/v1/1';

const DEFAULT_SEARCH_TERMS = [
  'chicken',
  'beef',
  'pasta',
  'curry',
  'salad',
  'soup',
  'fish',
  'rice',
  'pie',
  'cake',
  'lamb',
  'pork',
  'vegetarian',
  'stew',
  'grill',
];

function parseArgs(argv) {
  const args = {
    householdId: '',
    all: false,
    limit: 60,
    terms: DEFAULT_SEARCH_TERMS,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all') {
      args.all = true;
      continue;
    }
    if (arg === '--household-id') {
      args.householdId = String(argv[i + 1] ?? '').trim();
      i += 1;
      continue;
    }
    if (arg === '--limit') {
      const value = Number(argv[i + 1]);
      if (Number.isFinite(value) && value > 0) args.limit = Math.min(120, Math.round(value));
      i += 1;
      continue;
    }
    if (arg === '--terms') {
      const raw = String(argv[i + 1] ?? '').trim();
      if (raw) {
        args.terms = raw
          .split(',')
          .map((term) => term.trim())
          .filter(Boolean);
      }
      i += 1;
    }
  }

  return args;
}

async function fetchJson(path) {
  const res = await fetch(`${THEMEALDB_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`TheMealDB request failed (${res.status}) for ${path}`);
  }
  return res.json();
}

async function lookupMeal(mealId) {
  const data = await fetchJson(`/lookup.php?i=${encodeURIComponent(mealId)}`);
  return data.meals?.[0] ?? null;
}

/**
 * @param {string[]} terms
 * @param {number} limit
 */
async function collectMealsFromTheMealDb(terms, limit) {
  const summaryById = new Map();

  for (const term of terms) {
    const data = await fetchJson(`/search.php?s=${encodeURIComponent(term)}`);
    for (const meal of data.meals ?? []) {
      if (!meal?.idMeal) continue;
      summaryById.set(String(meal.idMeal), meal);
      if (summaryById.size >= limit) break;
    }
    if (summaryById.size >= limit) break;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  const recipes = [];
  for (const summary of summaryById.values()) {
    const full = (await lookupMeal(summary.idMeal)) ?? summary;
    const mapped = mapMealToRecipe(full);
    const sanitized = sanitizeRecipeEntry(mapped);
    if (sanitized?.instructions?.length && sanitized.ingredients?.length) {
      recipes.push(sanitized);
    }
    if (recipes.length >= limit) break;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }

  return recipes;
}

async function seedHousehold(householdId, recipes) {
  const merged = await upsertHouseholdRecipes(householdId, recipes);
  return merged.length;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.all && !args.householdId) {
    console.error(
      'Provide --household-id <mongoObjectId> or --all to seed households.recipeLibrary.',
    );
    process.exit(1);
  }

  const resolved = getMongoUri();
  if (resolved.error) {
    console.error(resolved.error);
    process.exit(1);
  }

  try {
    const db = await connectDb(resolved.uri);
    const recipes = await collectMealsFromTheMealDb(args.terms, args.limit);

    if (!recipes.length) {
      console.error('No recipes fetched from TheMealDB.');
      process.exit(1);
    }

    if (args.all) {
      const households = await db.collection('households').find({}).toArray();
      if (!households.length) {
        console.error('No households found.');
        process.exit(1);
      }

      for (const household of households) {
        const id = String(household._id);
        const librarySize = await seedHousehold(id, recipes);
        console.log(`Seeded household ${id} (${librarySize} recipes in library).`);
      }
    } else {
      const librarySize = await seedHousehold(args.householdId, recipes);
      console.log(
        JSON.stringify(
          {
            ok: true,
            householdId: args.householdId,
            seeded: recipes.length,
            librarySize,
            sampleTitles: recipes.slice(0, 5).map((recipe) => recipe.title),
          },
          null,
          2,
        ),
      );
    }
  } catch (err) {
    console.error('[seedRecipes]', err.message || err);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  ChefHat,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Search,
  ShoppingCart,
  X,
} from 'lucide-react';
import { fetchAiRecipeMatches, fetchRemixRecipe } from '../api.js';
import { PantryChefChat } from './PantryChefChat.jsx';
import { classifyItem } from '../inventory/classifyItem.js';
import { buildConsumptionFields } from '../inventory/consumption.js';
import { FOOD_CATEGORY, ITEM_TYPE, STATUS } from '../inventory/constants.js';
import { findFoodItemForIngredient } from '../recipes/ingredientMatching.js';
import { normalizeName } from '../inventory/itemUtils.js';
import { BUILTIN_RECIPES } from '../recipes/recipeCatalog.js';
import {
  analyzeRecipe,
  getRecipeById,
  MIN_MATCHED_RECIPES_TO_SHOW,
  recipeMatchesInventory,
  searchLocalRecipes,
} from '../recipes/recipeUtils.js';
import { fetchRecipesByIngredient, fetchRecipesBySearch } from '../recipes/themealdb.js';

const RECIPE_VIEW = {
  MATCHED: 'matched',
  SEARCH: 'search',
  SAVED: 'saved',
};

const AI_RECIPES_CACHE_KEY = 'fridge.aiRecipes';

const AI_EMPTY_MESSAGE =
  'No AI recommendations found. Try adding more inventory items or tweaking your craving search.';

const QUICK_FILTER_CHIPS = [
  { id: 'Under 15 Mins', label: '⏱️ Under 15 Mins' },
  { id: 'One-Pan', label: '🍳 One-Pan' },
  { id: 'High Protein', label: '💪 High Protein' },
];

function loadCachedAiRecipes() {
  try {
    const raw = sessionStorage.getItem(AI_RECIPES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCachedAiRecipes(recipes) {
  try {
    if (!recipes?.length) {
      sessionStorage.removeItem(AI_RECIPES_CACHE_KEY);
      return;
    }
    sessionStorage.setItem(AI_RECIPES_CACHE_KEY, JSON.stringify(recipes));
  } catch {
    // ignore quota / private mode
  }
}

function toUserFacingAiError(message) {
  const text = String(message ?? '').trim();
  if (!text) return 'Could not generate AI recommendations.';
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      const nested = parsed?.error?.message ?? parsed?.message;
      if (nested) return String(nested).split('\n')[0].trim();
    } catch {
      // fall through
    }
  }
  return text.split('\n')[0].trim();
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="surface-inset border-dashed px-6 py-10 text-center">
      {Icon && (
        <Icon
          className="mx-auto mb-3 h-11 w-11 text-slate-400 dark:text-slate-500"
          strokeWidth={1.5}
          aria-hidden
        />
      )}
      <p className="text-heading text-sm font-semibold">{title}</p>
      <p className="text-muted mx-auto mt-2 max-w-xs text-xs leading-relaxed">{description}</p>
    </div>
  );
}

function CollapsibleInstructions({ recipe }) {
  const [open, setOpen] = useState(false);
  const stepCount = recipe.instructions.length;

  return (
    <div className="surface-inset mb-4 p-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span className="text-muted text-xs font-semibold uppercase tracking-wide">
          Cooking instructions ({stepCount} steps)
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-500" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden />
        )}
      </button>
      {open && (
        <ol className="mt-3 list-decimal space-y-2 border-t border-slate-200 pt-3 pl-5 text-sm leading-relaxed text-slate-700 dark:border-slate-600 dark:text-slate-300">
          {recipe.instructions.map((step, index) => (
            <li key={`${recipe.id}-step-${index}`}>{step}</li>
          ))}
        </ol>
      )}
      {!open && (
        <p className="text-muted mt-2 text-xs">Tap to expand step-by-step directions.</p>
      )}
    </div>
  );
}

function AiRecipeMetaBadges({ recipe }) {
  const matchCount = Number(recipe.matchingInventoryCount) || 0;
  const expiring = recipe.expiringItemsUsed ?? [];
  const tags = recipe.tags ?? [];
  if (
    !recipe.isAiGenerated &&
    matchCount <= 0 &&
    expiring.length <= 0 &&
    tags.length <= 0
  ) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {recipe.isAiGenerated && (
        <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-900 ring-1 ring-violet-300 dark:bg-violet-950/70 dark:text-violet-200 dark:ring-violet-700">
          AI generated
        </span>
      )}
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-900 ring-1 ring-sky-300 dark:bg-sky-950/70 dark:text-sky-200 dark:ring-sky-700"
        >
          {tag}
        </span>
      ))}
      {matchCount > 0 && (
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 ring-1 ring-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:ring-emerald-700">
          {matchCount} in pantry
        </span>
      )}
      {expiring.length > 0 && (
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:ring-amber-700">
          {expiring.length} expiring
        </span>
      )}
    </div>
  );
}

function RecipeCard({
  recipe,
  analysis,
  isSaved,
  onToggleSave,
  onMarkCooked,
  onAddNeedToShoppingList,
  onRemix,
  remixingMode,
}) {
  const [showAddConfirm, setShowAddConfirm] = useState(false);

  return (
    <li className="surface-card p-4 shadow-lg">
      {recipe.imageUrl && (
        <img
          src={recipe.imageUrl}
          alt=""
          className="mb-3 h-36 w-full rounded-xl object-cover"
          loading="lazy"
        />
      )}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-heading text-lg font-bold">{recipe.title}</h2>
          <p className="text-muted text-xs font-medium">
            {recipe.cuisine ? `${recipe.cuisine} · ` : ''}
            {recipe.category ? `${recipe.category} · ` : ''}
            Prep: {recipe.prepTime}
            {recipe.cookTime ? ` · Cook: ${recipe.cookTime}` : ''}
            {recipe.calories ? ` · ~${recipe.calories} cal` : ''}
            {recipe.macros?.protein ? ` · Protein: ${recipe.macros.protein}` : ''}
          </p>
          <AiRecipeMetaBadges recipe={recipe} />
          {recipe.source === 'themealdb' && recipe.sourceUrl && (
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:underline dark:text-violet-300"
            >
              <ExternalLink className="h-3 w-3" aria-hidden />
              View on TheMealDB
            </a>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {analysis.canCook && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
              Ready!
            </span>
          )}
          <button
            type="button"
            onClick={() => onToggleSave(recipe)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition active:scale-95 ${
              isSaved
                ? 'border-violet-300 bg-violet-100 text-violet-700 dark:border-violet-700 dark:bg-violet-950/60 dark:text-violet-300'
                : 'border-black/[0.08] bg-lm-inset text-slate-500 hover:border-violet-300 hover:text-violet-600 dark:border-white/10 dark:bg-dm-raised dark:hover:text-violet-400'
            }`}
            aria-label={isSaved ? 'Remove from saved recipes' : 'Save recipe'}
            aria-pressed={isSaved}
          >
            <Bookmark className={`h-5 w-5 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {analysis.have.length > 0 ? (
        <div className="mb-3">
          <p className="text-muted mb-1.5 text-xs font-semibold uppercase tracking-wide">
            What you have
          </p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.have.map((ing) => (
              <span
                key={ing.name}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  ing.status === STATUS.EXPIRING
                    ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:ring-amber-700'
                    : 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:ring-emerald-700'
                }`}
              >
                {ing.name}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-muted mb-3 text-xs">
          Add matching ingredients in Fridge to see what you already have for this recipe.
        </p>
      )}

      {analysis.need.length > 0 && (
        <div className="mb-4">
          <p className="text-muted mb-1.5 text-xs font-semibold uppercase tracking-wide">
            What you need
          </p>
          <ul className="mb-3 flex flex-wrap gap-1.5">
            {analysis.need.map((name) => (
              <li
                key={name}
                className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800 ring-1 ring-rose-300 dark:bg-rose-950/80 dark:text-rose-200 dark:ring-rose-700"
              >
                {name}
              </li>
            ))}
          </ul>
          {showAddConfirm ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-800 dark:bg-sky-950/40">
              <p className="text-heading text-sm font-semibold">Add to shopping list?</p>
              <p className="text-muted mt-1 text-xs leading-relaxed">
                Add {analysis.need.length} missing ingredient
                {analysis.need.length === 1 ? '' : 's'} from &ldquo;{recipe.title}&rdquo; to your
                household shopping list.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddConfirm(false)}
                  className="flex-1 rounded-lg border border-black/[0.08] bg-lm-raised py-2.5 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-dm-raised dark:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddNeedToShoppingList(analysis.need);
                    setShowAddConfirm(false);
                  }}
                  className="flex-1 rounded-lg bg-sky-600 py-2.5 text-xs font-semibold text-white active:scale-[0.98]"
                >
                  Add all
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddConfirm(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 py-2.5 text-xs font-semibold text-sky-800 transition hover:bg-sky-100 active:scale-[0.98] dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200 dark:hover:bg-sky-950"
            >
              <ShoppingCart className="h-4 w-4" aria-hidden />
              Add all to shopping list
            </button>
          )}
        </div>
      )}

      <CollapsibleInstructions recipe={recipe} />

      {onRemix && (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={Boolean(remixingMode)}
            onClick={() => onRemix(recipe, 'higher_protein')}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60"
          >
            {remixingMode === 'higher_protein' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              '💪 Boost Protein'
            )}
          </button>
          <button
            type="button"
            disabled={Boolean(remixingMode)}
            onClick={() => onRemix(recipe, 'lower_calorie')}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-lime-200 bg-lime-50 py-2.5 text-xs font-semibold text-lime-900 transition hover:bg-lime-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:border-lime-800 dark:bg-lime-950/40 dark:text-lime-200 dark:hover:bg-lime-950/60"
          >
            {remixingMode === 'lower_calorie' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              '🥗 Lower Calorie'
            )}
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => onMarkCooked(recipe)}
          className="surface-inset flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold text-slate-800 transition hover:border-emerald-500 hover:text-emerald-700 active:scale-[0.98] dark:text-slate-200 dark:hover:border-emerald-600 dark:hover:text-emerald-400"
        >
          <ChefHat className="h-4 w-4" aria-hidden />
          Cooked It!
        </button>
        <button
          type="button"
          onClick={() => onToggleSave(recipe)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition active:scale-[0.98] ${
            isSaved
              ? 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-200'
              : 'border-slate-200 text-slate-700 hover:border-violet-300 hover:text-violet-700 dark:border-slate-600 dark:text-slate-300 dark:hover:text-violet-400'
          }`}
        >
          <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
          {isSaved ? 'Saved' : 'Save recipe'}
        </button>
      </div>
    </li>
  );
}

export function RecipesView({ items, updateItems, savedRecipes }) {
  const { savedIds, isSaved, toggleSave, recipeLibrary, rememberRecipe, mergeRecipeLibrary } =
    savedRecipes;
  const [recipeView, setRecipeView] = useState(RECIPE_VIEW.MATCHED);
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [pantryOnly, setPantryOnly] = useState(false);
  const [aiRecipes, setAiRecipes] = useState(() => loadCachedAiRecipes());
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [cravingInput, setCravingInput] = useState('');
  const [selectedQuickTag, setSelectedQuickTag] = useState('');
  const [remixingId, setRemixingId] = useState(null);
  const [remixingMode, setRemixingMode] = useState('');
  const [remixError, setRemixError] = useState('');

  const handleGenerateAiRecipes = useCallback(async () => {
    if (isAiLoading) return;
    setIsAiLoading(true);
    setAiError('');
    try {
      const data = await fetchAiRecipeMatches({
        cravings: cravingInput,
        quickTag: selectedQuickTag,
      });
      const recipes = Array.isArray(data.recipes) ? data.recipes : [];
      setAiRecipes(recipes);
      mergeRecipeLibrary(recipes.filter((recipe) => recipe.isAiGenerated));
      saveCachedAiRecipes(recipes);
      if (recipes.length === 0) {
        setAiError(AI_EMPTY_MESSAGE);
      }
    } catch (err) {
      const message = toUserFacingAiError(
        err?.message || 'Could not generate AI recommendations.',
      );
      if (/not authenticated|unauthorized/i.test(message)) {
        setAiError('Please sign in to use AI recommendations.');
      } else if (err?.status === 504 || /deployment|timed out/i.test(message)) {
        setAiError('AI generation timed out. Please try again in a moment.');
      } else {
        setAiError(message);
      }
    } finally {
      setIsAiLoading(false);
    }
  }, [cravingInput, selectedQuickTag, mergeRecipeLibrary, isAiLoading]);

  const handleRemix = useCallback(
    async (recipe, mode) => {
      if (!recipe?.id) return;
      setRemixError('');
      setRemixingId(recipe.id);
      setRemixingMode(mode);
      rememberRecipe(recipe);
      try {
        const data = await fetchRemixRecipe(recipe.id, mode, recipe);
        const remixed = data.recipe;
        if (remixed) {
          mergeRecipeLibrary([remixed]);
          setAiRecipes((prev) => {
            const next = [...prev.filter((entry) => entry.id !== remixed.id), remixed];
            saveCachedAiRecipes(next);
            return next;
          });
        }
      } catch (err) {
        const message = toUserFacingAiError(err?.message || 'Could not remix this recipe.');
        setRemixError(message);
      } finally {
        setRemixingId(null);
        setRemixingMode('');
      }
    },
    [mergeRecipeLibrary, rememberRecipe],
  );

  const aiRecipeCards = useMemo(
    () =>
      aiRecipes.map((recipe) => {
        const analysis = analyzeRecipe(recipe, items);
        if (recipe.missingIngredients?.length) {
          analysis.need = recipe.missingIngredients;
        }
        return { recipe, analysis };
      }),
    [aiRecipes, items],
  );

  const pantryIngredients = useMemo(
    () =>
      items
        .filter((item) => item.itemType === ITEM_TYPE.FOOD && item.status !== STATUS.OUT)
        .map((item) => item.name)
        .slice(0, 12),
    [items],
  );

  const cookableRecipes = useMemo(() => {
    const scored = BUILTIN_RECIPES.map((recipe) => {
      const analysis = analyzeRecipe(recipe, items);
      return { recipe, analysis, score: analysis.stockedCount };
    });

    const strict = scored
      .filter(({ analysis }) => recipeMatchesInventory(analysis))
      .sort((a, b) => b.score - a.score);

    if (strict.length >= MIN_MATCHED_RECIPES_TO_SHOW) {
      return strict;
    }

    const shownIds = new Set(strict.map(({ recipe }) => recipe.id));
    const filler = scored
      .filter(
        ({ recipe, analysis }) =>
          !shownIds.has(recipe.id) &&
          analysis.hasMainIngredient &&
          analysis.stockedCount >= 1,
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, MIN_MATCHED_RECIPES_TO_SHOW - strict.length);

    return [...strict, ...filler];
  }, [items]);

  const localSearchResults = useMemo(
    () => searchLocalRecipes(searchQuery, recipeLibrary),
    [searchQuery, recipeLibrary],
  );

  const savedRecipeCards = useMemo(() => {
    return savedIds
      .map((id) => getRecipeById(id, recipeLibrary))
      .filter(Boolean)
      .map((recipe) => ({
        recipe,
        analysis: analyzeRecipe(recipe, items),
      }))
      .sort((a, b) => a.recipe.title.localeCompare(b.recipe.title));
  }, [savedIds, recipeLibrary, items]);

  const mergedSearchResults = useMemo(() => {
    const byId = new Map();
    for (const recipe of localSearchResults) byId.set(recipe.id, recipe);
    for (const recipe of remoteResults) byId.set(recipe.id, recipe);
    let list = [...byId.values()];
    if (pantryOnly) {
      list = list.filter((recipe) => analyzeRecipe(recipe, items).stockedCount >= 1);
    }
    return list
      .map((recipe) => ({
        recipe,
        analysis: analyzeRecipe(recipe, items),
      }))
      .sort((a, b) => b.analysis.stockedCount - a.analysis.stockedCount);
  }, [localSearchResults, remoteResults, pantryOnly, items]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setRemoteResults([]);
      setSearchError('');
      setSearchLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError('');
      try {
        const results = await fetchRecipesBySearch(trimmed);
        if (!controller.signal.aborted) {
          setRemoteResults(results);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setSearchError(err.message || 'Could not search online recipes.');
          setRemoteResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const handlePantrySearch = useCallback(async (ingredient) => {
    setSearchQuery(ingredient);
    setRecipeView(RECIPE_VIEW.SEARCH);
    setSearchLoading(true);
    setSearchError('');
    try {
      const results = await fetchRecipesByIngredient(ingredient);
      setRemoteResults(results);
    } catch (err) {
      setSearchError(err.message || 'Could not search by ingredient.');
      setRemoteResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleToggleSave = useCallback(
    (recipe) => {
      if (recipe.source === 'themealdb' || recipe.isAiGenerated) {
        rememberRecipe(recipe);
      }
      toggleSave(recipe.id);
    },
    [rememberRecipe, toggleSave],
  );

  const markCooked = (recipe) => {
    updateItems((prev) => {
      const next = [...prev];
      for (const ingredient of recipe.ingredients) {
        const match = findFoodItemForIngredient(ingredient, next);
        if (match) {
          const idx = next.findIndex((item) => item.id === match.id);
          if (idx >= 0) {
            next[idx] = { ...next[idx], status: STATUS.OUT };
          }
        }
      }
      return next;
    });
  };

  const addNeededToShoppingList = (neededIngredients) => {
    updateItems((prev) => {
      let next = [...prev];
      for (const name of neededIngredients) {
        const needle = normalizeName(name);
        const idx = next.findIndex((item) => normalizeName(item.name) === needle);
        if (idx >= 0) {
          next[idx] = { ...next[idx], status: STATUS.OUT };
          continue;
        }
        const classified = classifyItem(name);
        const consumption = buildConsumptionFields({
          name,
          itemType: ITEM_TYPE.FOOD,
          category: classified?.category ?? FOOD_CATEGORY.AMBIENT,
        });
        next.push({
          id: crypto.randomUUID(),
          name,
          itemType: ITEM_TYPE.FOOD,
          status: STATUS.OUT,
          category: classified?.category ?? FOOD_CATEGORY.AMBIENT,
          expiryDate: null,
          ...consumption,
        });
      }
      return next;
    });
  };

  const list =
    recipeView === RECIPE_VIEW.SAVED
      ? savedRecipeCards
      : recipeView === RECIPE_VIEW.SEARCH
        ? mergedSearchResults
        : cookableRecipes;

  return (
    <div className="pb-28">
      <header className="mb-4">
        <h1 className="text-heading text-2xl font-extrabold">What Can We Cook?</h1>
        <p className="text-muted mt-1.5 text-sm">
          {recipeView === RECIPE_VIEW.SAVED
            ? 'Your bookmarked recipes — always available here'
            : recipeView === RECIPE_VIEW.SEARCH
              ? 'Search built-in recipes and import free recipes from TheMealDB'
              : 'Get AI recommendations from your pantry or browse catalogue recipes you can cook now'}
        </p>
      </header>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          { id: RECIPE_VIEW.MATCHED, label: 'Recommendations', icon: ChefHat, count: cookableRecipes.length },
          { id: RECIPE_VIEW.SEARCH, label: 'Search', icon: Search, count: 0 },
          { id: RECIPE_VIEW.SAVED, label: 'Saved', icon: Bookmark, count: savedIds.length },
        ].map(({ id, label, icon: Icon, count }) => {
          const active = recipeView === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setRecipeView(id)}
              className={`flex items-center justify-center gap-1.5 rounded-xl border-2 py-2.5 text-xs font-semibold transition active:scale-[0.98] sm:text-sm ${
                active
                  ? id === RECIPE_VIEW.SAVED
                    ? 'border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300'
                    : 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-400'
              }`}
            >
              <Icon
                className={`h-4 w-4 ${id === RECIPE_VIEW.SAVED && active ? 'fill-current' : ''}`}
                aria-hidden
              />
              {label}
              {count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white ${
                    id === RECIPE_VIEW.SAVED ? 'bg-violet-600' : 'bg-emerald-600'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {recipeView === RECIPE_VIEW.SEARCH && (
        <section className="surface-card mb-5 space-y-3 p-4">
          <label className="sr-only" htmlFor="recipe-search">
            Search recipes
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              id="recipe-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search recipes, cuisines, ingredients…"
              className="input-field w-full py-3 pl-11 pr-10"
              autoComplete="off"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setRemoteResults([]);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Clear recipe search"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={pantryOnly}
              onChange={(event) => setPantryOnly(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Only show recipes using what I have
          </label>

          {pantryIngredients.length > 0 && (
            <div>
              <p className="text-muted mb-2 text-xs font-semibold uppercase tracking-wide">
                Search using my pantry
              </p>
              <div className="flex flex-wrap gap-2">
                {pantryIngredients.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handlePantrySearch(name)}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 active:scale-[0.98] dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {searchLoading && (
            <p className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" aria-hidden />
              Searching built-in &amp; TheMealDB recipes…
            </p>
          )}
          {searchError && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              {searchError}
            </p>
          )}
          <p className="text-muted text-[11px] leading-relaxed">
            Import recipes from{' '}
            <a
              href="https://www.themealdb.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-violet-700 underline dark:text-violet-300"
            >
              TheMealDB
            </a>
            . Save any result to add it to your household library. Built-in catalogue:{' '}
            {BUILTIN_RECIPES.length} favourites.
          </p>
        </section>
      )}

      {recipeView === RECIPE_VIEW.MATCHED && (
        <section className="surface-card mb-5 overflow-hidden border border-violet-200/70 dark:border-violet-900/40">
          <div className="bg-gradient-to-br from-violet-50 via-white to-emerald-50 px-4 py-5 dark:from-violet-950/40 dark:via-dm-raised dark:to-emerald-950/20">
            <h2 className="text-heading text-lg font-extrabold leading-snug">
              Pantry Chef
            </h2>
            <p className="text-muted mt-1 text-sm leading-relaxed">
              Cook what you have — tailored to your cravings and time.
            </p>
            <PantryChefChat />
            <label className="sr-only" htmlFor="craving-input">
              What are you craving today?
            </label>
            <input
              id="craving-input"
              type="text"
              value={cravingInput}
              onChange={(event) => setCravingInput(event.target.value)}
              placeholder="What are you craving today?"
              className="mt-4 w-full rounded-xl border border-violet-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-violet-800 dark:bg-dm-raised dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-violet-900"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_FILTER_CHIPS.map((chip) => {
                const active = selectedQuickTag === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() =>
                      setSelectedQuickTag((current) => (current === chip.id ? '' : chip.id))
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98] ${
                      active
                        ? 'border-violet-500 bg-violet-600 text-white shadow-sm'
                        : 'border-violet-200 bg-white text-violet-800 hover:border-violet-400 dark:border-violet-800 dark:bg-dm-raised dark:text-violet-200 dark:hover:border-violet-600'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleGenerateAiRecipes}
              disabled={isAiLoading}
              title={isAiLoading ? 'Generating AI Recommendations...' : 'Generate AI recommendations from your pantry'}
              aria-busy={isAiLoading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-violet-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isAiLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Generating AI Recommendations...
                </>
              ) : (
                'AI Recommendation'
              )}
            </button>
          </div>
        </section>
      )}

      {recipeView === RECIPE_VIEW.MATCHED && remixError && (
        <p
          className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          role="alert"
        >
          {remixError}
        </p>
      )}

      {recipeView === RECIPE_VIEW.MATCHED && aiError && !isAiLoading && (
        <p
          className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          role="alert"
        >
          {aiError}
        </p>
      )}

      {recipeView === RECIPE_VIEW.MATCHED && aiRecipeCards.length > 0 && !isAiLoading && (
        <section className="mb-6">
          <ul className="space-y-4">
            {aiRecipeCards.map(({ recipe, analysis }) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                analysis={analysis}
                isSaved={isSaved(recipe.id)}
                onToggleSave={handleToggleSave}
                onMarkCooked={markCooked}
                onAddNeedToShoppingList={addNeededToShoppingList}
                onRemix={handleRemix}
                remixingMode={remixingId === recipe.id ? remixingMode : ''}
              />
            ))}
          </ul>
          <p className="text-muted mt-4 text-center text-[11px] leading-relaxed">
            AI recommendations are generated with Gemini and saved to your household library.
          </p>
        </section>
      )}

      {recipeView === RECIPE_VIEW.MATCHED && cookableRecipes.length > 0 && (
        <h2 className="text-heading mb-3 text-sm font-bold">From your catalogue</h2>
      )}

      {recipeView === RECIPE_VIEW.MATCHED &&
        !isAiLoading &&
        aiRecipeCards.length === 0 &&
        list.length === 0 && (
          <EmptyState
            icon={ChefHat}
            title="No AI recommendations found"
            description="Try adding more inventory items or tweaking your craving search."
          />
        )}

      {list.length === 0 ? (
        recipeView === RECIPE_VIEW.MATCHED && (aiRecipes.length > 0 || isAiLoading) ? null :
        recipeView === RECIPE_VIEW.MATCHED && aiRecipeCards.length === 0 ? null : (
        <EmptyState
          icon={
            recipeView === RECIPE_VIEW.SAVED
              ? Bookmark
              : recipeView === RECIPE_VIEW.SEARCH
                ? Search
                : ChefHat
          }
          title={
            recipeView === RECIPE_VIEW.SAVED
              ? 'No saved recipes yet'
              : recipeView === RECIPE_VIEW.SEARCH
                ? searchQuery.trim().length < 2
                  ? 'Start typing to search'
                  : 'No recipes found'
                : 'No catalogue recipes yet'
          }
          description={
            recipeView === RECIPE_VIEW.SAVED
              ? 'Tap the bookmark on any recipe to save favourites for quick access.'
              : recipeView === RECIPE_VIEW.SEARCH
                ? searchQuery.trim().length < 2
                  ? 'Search by dish name, cuisine, or ingredient — or tap a pantry item above.'
                  : 'Try a different keyword, turn off “Only show recipes using what I have”, or search a pantry item chip.'
                : AI_EMPTY_MESSAGE
          }
        />
        )
      ) : (
        <ul className="space-y-4">
          {list.map(({ recipe, analysis }) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              analysis={analysis}
              isSaved={isSaved(recipe.id)}
              onToggleSave={handleToggleSave}
              onMarkCooked={markCooked}
              onAddNeedToShoppingList={addNeededToShoppingList}
              onRemix={handleRemix}
              remixingMode={remixingId === recipe.id ? remixingMode : ''}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

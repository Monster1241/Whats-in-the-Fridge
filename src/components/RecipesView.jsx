import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  ChefHat,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Search,
  ShoppingCart,
  Sparkles,
  X,
} from 'lucide-react';
import { fetchAiRecipeMatches, addRecipeIngredientsToShoppingList } from '../api.js';
import { FridgeScoutChat } from './FridgeScoutChat.jsx';
import { MetaIcon } from './MetaIcon.jsx';
import {
  buildRecipeTweakPrompt,
  buildRecipeTweakSummary,
  FRIDGE_SCOUT_PERSONA,
  RECIPE_TWEAK_MODES,
} from '../recipes/kitchenAiBranding.js';
import { ITEM_TYPE, STATUS } from '../inventory/constants.js';
import { isExpired } from '../inventory/expiryDisplay.js';
import { findFoodItemForIngredient } from '../recipes/ingredientMatching.js';
import {
  getDietaryPreferenceModeLabel,
  isDietaryPreferenceActive,
  normalizeDietaryPreference,
} from '../recipes/dietaryPreferences.js';
import { BUILTIN_RECIPES } from '../recipes/recipeCatalog.js';
import {
  analyzeRecipe,
  findRecipesByCraving,
  getAllKnownRecipes,
  getRecipeById,
  MIN_MATCHED_RECIPES_TO_SHOW,
  recipeMatchesInventory,
  searchLocalRecipes,
} from '../recipes/recipeUtils.js';
import { fetchRecipesByIngredient, fetchRecipesBySearch } from '../recipes/themealdb.js';

const RECIPE_VIEW = {
  SCOUT: 'scout',
  MATCHED: 'matched',
  SEARCH: 'search',
  SAVED: 'saved',
};

const AI_RECIPES_CACHE_KEY = 'fridge.aiRecipes';

const AI_EMPTY_MESSAGE =
  'No AI recommendations found. Try adding more inventory items or tweaking your craving search.';

const GENERATED_RECIPES_INITIAL = 3;
const GENERATED_RECIPES_STEP = 4;

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

function ViewMoreRecipesButton({ remaining, onClick }) {
  if (remaining <= 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-black/[0.08] bg-lm-raised py-3 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-50 active:scale-[0.99] dark:border-white/10 dark:bg-dm-raised dark:text-violet-300 dark:hover:border-violet-700 dark:hover:bg-violet-950/40"
    >
      View more
      <span className="text-muted font-medium">
        ({remaining} more recipe{remaining === 1 ? '' : 's'})
      </span>
      <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
    </button>
  );
}

function CollapsibleInstructions({ recipe }) {
  const [open, setOpen] = useState(false);
  const steps = Array.isArray(recipe.instructions) ? recipe.instructions.filter(Boolean) : [];
  const stepCount = steps.length;

  if (stepCount === 0) {
    return (
      <p className="text-muted mb-4 text-xs italic">No cooking instructions available for this recipe.</p>
    );
  }

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
          {steps.map((step, index) => (
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
        <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[11px] font-semibold text-teal-900 ring-1 ring-teal-300 dark:bg-teal-950/60 dark:text-teal-200 dark:ring-teal-700/80">
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
  onAskScoutToTweak,
  scoutTweakingId,
  scoutTweakingMode,
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
                  ing.status === STATUS.EXPIRED
                    ? 'bg-rose-100 text-rose-900 ring-1 ring-rose-300 dark:bg-rose-950/70 dark:text-rose-200 dark:ring-rose-700'
                    : ing.status === STATUS.EXPIRING
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
                    onAddNeedToShoppingList(analysis.need, recipe);
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

      {onAskScoutToTweak && (
        <div className="mb-3">
          <p className="text-muted mb-2 text-[10px] font-bold uppercase tracking-wide">
            Tweak with {FRIDGE_SCOUT_PERSONA}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {(['higher_protein', 'lower_calorie']).map((mode) => {
              const tweak = RECIPE_TWEAK_MODES[mode];
              const isActive = scoutTweakingId === recipe.id && scoutTweakingMode === mode;
              const isBusy = scoutTweakingId === recipe.id;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={isBusy}
                  onClick={() => onAskScoutToTweak(recipe, mode)}
                  title={`Ask Scout to ${tweak.label.toLowerCase()} for this recipe`}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                    mode === 'higher_protein'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950/60'
                      : 'border-lime-200 bg-lime-50 text-lime-900 hover:bg-lime-100 dark:border-lime-800/60 dark:bg-lime-950/40 dark:text-lime-100 dark:hover:bg-lime-950/60'
                  }`}
                >
                  {isActive ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      Asking Scout…
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1">
                        <MetaIcon name={tweak.label} className="h-3.5 w-3.5" /> {tweak.label}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
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

export function RecipesView({ items, updateItems, replaceItemsFromServer, savedRecipes, dietaryPreference }) {
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
  const [cravingMatches, setCravingMatches] = useState([]);
  const [lastCravingQuery, setLastCravingQuery] = useState('');
  const [cravingSearchLoading, setCravingSearchLoading] = useState(false);
  const [generatedVisibleCounts, setGeneratedVisibleCounts] = useState({
    craving: GENERATED_RECIPES_INITIAL,
    ai: GENERATED_RECIPES_INITIAL,
    catalogue: GENERATED_RECIPES_INITIAL,
  });
  const [selectedQuickTag, setSelectedQuickTag] = useState('');
  const [scoutTweakingId, setScoutTweakingId] = useState(null);
  const [scoutTweakingMode, setScoutTweakingMode] = useState('');
  const [recipeShopFeedback, setRecipeShopFeedback] = useState('');
  const scoutChatRef = useRef(null);
  const activeDietaryPreference = normalizeDietaryPreference(dietaryPreference);
  const dietaryModeLabel = getDietaryPreferenceModeLabel(activeDietaryPreference);
  const showDietaryBadge = isDietaryPreferenceActive(activeDietaryPreference);

  const fetchCravingCatalogMatches = useCallback(
    async (craving) => {
      const query = String(craving ?? '').trim();
      if (query.length < 2) return [];

      const local = findRecipesByCraving(query, recipeLibrary, { limit: 12 });
      let remote = [];
      try {
        remote = (await fetchRecipesBySearch(query)).slice(0, 8);
      } catch {
        remote = [];
      }

      const byId = new Map();
      for (const recipe of local) byId.set(recipe.id, recipe);
      for (const recipe of remote) {
        if (!byId.has(recipe.id)) byId.set(recipe.id, recipe);
      }
      return [...byId.values()];
    },
    [recipeLibrary],
  );

  const showMoreGeneratedRecipes = useCallback((section) => {
    setGeneratedVisibleCounts((prev) => ({
      ...prev,
      [section]: prev[section] + GENERATED_RECIPES_STEP,
    }));
  }, []);

  const handleGenerateAiRecipes = useCallback(async () => {
    if (isAiLoading) return;
    setIsAiLoading(true);
    setCravingSearchLoading(true);
    setAiError('');
    setGeneratedVisibleCounts({
      craving: GENERATED_RECIPES_INITIAL,
      ai: GENERATED_RECIPES_INITIAL,
      catalogue: GENERATED_RECIPES_INITIAL,
    });
    const craving = cravingInput.trim();
    try {
      const [data, catalogueMatches] = await Promise.all([
        fetchAiRecipeMatches({
          cravings: craving,
          quickTag: selectedQuickTag,
        }),
        craving.length >= 2 ? fetchCravingCatalogMatches(craving) : Promise.resolve([]),
      ]);

      const recipes = Array.isArray(data.recipes) ? data.recipes : [];
      const matchIds = new Set(catalogueMatches.map((recipe) => recipe.id));
      const aiOnly = recipes.filter((recipe) => !matchIds.has(recipe.id));

      setCravingMatches(catalogueMatches);
      setLastCravingQuery(craving);
      setAiRecipes(aiOnly);
      mergeRecipeLibrary([
        ...catalogueMatches.filter((recipe) => recipe.source === 'themealdb'),
        ...aiOnly.filter((recipe) => recipe.isAiGenerated),
      ]);
      saveCachedAiRecipes([...catalogueMatches, ...aiOnly]);

      if (catalogueMatches.length === 0 && aiOnly.length === 0) {
        setAiError(AI_EMPTY_MESSAGE);
      } else {
        setRecipeView(RECIPE_VIEW.MATCHED);
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
      setCravingSearchLoading(false);
    }
  }, [
    cravingInput,
    selectedQuickTag,
    mergeRecipeLibrary,
    isAiLoading,
    fetchCravingCatalogMatches,
  ]);

  const handleAskScoutToTweak = useCallback(async (recipe, mode) => {
    if (!recipe?.id) return;
    const prompt = buildRecipeTweakPrompt(recipe, mode);
    if (!prompt) return;
    const summary = buildRecipeTweakSummary(recipe, mode);

    setScoutTweakingId(recipe.id);
    setScoutTweakingMode(mode);
    setRecipeView(RECIPE_VIEW.SCOUT);

    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        await scoutChatRef.current?.sendMessage(prompt, { summary });
        setScoutTweakingId(null);
        setScoutTweakingMode('');
        scoutChatRef.current?.focus();
      });
    });
  }, []);

  const usableRecipeItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.itemType === ITEM_TYPE.FOOD &&
          item.status !== STATUS.OUT &&
          !isExpired(item),
      ),
    [items],
  );

  const cravingMatchCards = useMemo(
    () =>
      cravingMatches.map((recipe) => ({
        recipe,
        analysis: analyzeRecipe(recipe, usableRecipeItems),
      })),
    [cravingMatches, usableRecipeItems],
  );

  const aiRecipeCards = useMemo(
    () =>
      aiRecipes.map((recipe) => {
        const analysis = analyzeRecipe(recipe, usableRecipeItems);
        if (recipe.missingIngredients?.length) {
          analysis.need = recipe.missingIngredients;
        }
        return { recipe, analysis };
      }),
    [aiRecipes, usableRecipeItems],
  );

  const pantryIngredients = useMemo(
    () => usableRecipeItems.map((item) => item.name).slice(0, 12),
    [usableRecipeItems],
  );

  const cookableRecipes = useMemo(() => {
    const scored = getAllKnownRecipes(recipeLibrary).map((recipe) => {
      const analysis = analyzeRecipe(recipe, usableRecipeItems);
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
  }, [usableRecipeItems, recipeLibrary]);

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
        analysis: analyzeRecipe(recipe, usableRecipeItems),
      }))
      .sort((a, b) => a.recipe.title.localeCompare(b.recipe.title));
  }, [savedIds, recipeLibrary, usableRecipeItems]);

  const mergedSearchResults = useMemo(() => {
    const byId = new Map();
    for (const recipe of localSearchResults) byId.set(recipe.id, recipe);
    for (const recipe of remoteResults) byId.set(recipe.id, recipe);
    let list = [...byId.values()];
    if (pantryOnly) {
      list = list.filter((recipe) => analyzeRecipe(recipe, usableRecipeItems).stockedCount >= 1);
    }
    return list
      .map((recipe) => ({
        recipe,
        analysis: analyzeRecipe(recipe, usableRecipeItems),
      }))
      .sort((a, b) => b.analysis.stockedCount - a.analysis.stockedCount);
  }, [localSearchResults, remoteResults, pantryOnly, usableRecipeItems]);

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

  const addNeededToShoppingList = async (neededIngredients, recipe) => {
    if (!neededIngredients?.length) return;
    setRecipeShopFeedback('');
    try {
      const result = await addRecipeIngredientsToShoppingList({
        recipe: recipe
          ? { id: recipe.id, title: recipe.title, ingredients: recipe.ingredients }
          : undefined,
        ingredients: neededIngredients.map((name) => ({ name, quantity: 1 })),
      });
      if (replaceItemsFromServer) {
        replaceItemsFromServer(result.items, { inventoryRevision: result.inventoryRevision });
      } else {
        updateItems(result.items);
      }
      if (result.warnings?.length) {
        setRecipeShopFeedback(result.warnings.map((warning) => warning.message).join(' '));
      }
    } catch (err) {
      setRecipeShopFeedback(err.message || 'Could not add ingredients to shopping list.');
    }
  };

  const list =
    recipeView === RECIPE_VIEW.SAVED
      ? savedRecipeCards
      : recipeView === RECIPE_VIEW.SEARCH
        ? mergedSearchResults
        : recipeView === RECIPE_VIEW.SCOUT
          ? []
          : cookableRecipes;

  function tabClassName(id, active) {
    const base = `recipe-tab recipe-tab--${id}`;
    return active ? `${base} recipe-tab--active` : `${base} recipe-tab--idle`;
  }

  const pageSubtitle =
    recipeView === RECIPE_VIEW.SCOUT
      ? 'Chat with Scout — meal ideas, tweaks & kitchen help'
      : recipeView === RECIPE_VIEW.SAVED
        ? 'Your bookmarked recipes — always available here'
        : recipeView === RECIPE_VIEW.SEARCH
          ? 'Search built-in recipes and import free recipes from TheMealDB'
          : 'AI picks and catalogue recipes you can cook with what you have';

  return (
    <div
      className={
        recipeView === RECIPE_VIEW.SCOUT
          ? 'fridge-scout-page -mx-4 flex flex-col sm:-mx-5'
          : 'pb-28'
      }
    >
      <header className={`page-header shrink-0 ${recipeView === RECIPE_VIEW.SCOUT ? 'px-4 sm:px-5' : ''}`}>
        <h1 className="page-header__title">What Can We Cook?</h1>
        <p className="page-header__subtitle">{pageSubtitle}</p>
        {showDietaryBadge && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
            <Sparkles className="h-3 w-3" aria-hidden />
            {dietaryModeLabel}
          </p>
        )}
      </header>

      {recipeShopFeedback && (
        <p
          role="status"
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        >
          {recipeShopFeedback}
        </p>
      )}

      <div
        className={`grid grid-cols-4 gap-1.5 sm:gap-2 ${
          recipeView === RECIPE_VIEW.SCOUT ? 'mb-2 shrink-0 px-4 sm:px-5' : 'mb-4'
        }`}
      >
        {[
          { id: RECIPE_VIEW.SCOUT, label: 'Fridge Scout', shortLabel: 'Scout', icon: Sparkles, count: 0 },
          { id: RECIPE_VIEW.MATCHED, label: 'Recommendations', shortLabel: 'Recs', icon: ChefHat, count: cookableRecipes.length },
          { id: RECIPE_VIEW.SEARCH, label: 'Search', shortLabel: 'Search', icon: Search, count: 0 },
          { id: RECIPE_VIEW.SAVED, label: 'Saved', shortLabel: 'Saved', icon: Bookmark, count: savedIds.length },
        ].map(({ id, label, shortLabel, icon: Icon, count }) => {
          const active = recipeView === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setRecipeView(id)}
              className={tabClassName(id, active)}
            >
              <span className="relative inline-flex shrink-0">
                <Icon
                  className={`h-4 w-4 ${id === RECIPE_VIEW.SAVED && active ? 'fill-current' : ''}`}
                  aria-hidden
                />
                {count > 0 && (
                  <span
                    className={`absolute -right-2 -top-2 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none text-white ${
                      id === RECIPE_VIEW.SAVED ? 'bg-violet-600' : 'bg-emerald-600'
                    }`}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center text-[10px] font-semibold leading-tight sm:hidden">
                {shortLabel}
              </span>
              <span className="hidden w-full truncate text-center text-[11px] font-semibold leading-tight sm:block">
                {label}
              </span>
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
        <section className="fridge-scout-zone mb-5">
          <div className="fridge-scout-zone__generator border-0 bg-transparent p-0 dark:bg-transparent">
            <div className="fridge-scout-zone__hero rounded-2xl px-4 pb-4 pt-5">
              <div className="fridge-scout-zone__hero-top">
                <span className="fridge-scout-zone__badge">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  AI kitchen
                </span>
              </div>
              <h2 className="fridge-scout-zone__title">Recipe generator</h2>
              <p className="fridge-scout-zone__tagline">
                Generate meals from your pantry — plus catalogue picks when you name a cuisine or craving.
              </p>
            </div>
            <div className="fridge-scout-zone__generator !border-t-0 px-4 pb-4 pt-0">
              <label className="sr-only" htmlFor="craving-input">
                What are you craving today?
              </label>
              <input
                id="craving-input"
                type="text"
                value={cravingInput}
                onChange={(event) => setCravingInput(event.target.value)}
                placeholder="What are you craving today?"
                className="input-field w-full"
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
                      className={`fridge-scout-chip ${active ? 'fridge-scout-chip--active' : ''}`}
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
                title={
                  isAiLoading
                    ? 'Generating AI Recommendations...'
                    : 'Generate AI recommendations from your pantry'
                }
                aria-busy={isAiLoading}
                className="fridge-scout-generate-btn mt-4"
              >
                {isAiLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    {cravingInput.trim().length >= 2
                      ? 'Finding matches & generating…'
                      : 'Generating recommendations…'}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" aria-hidden />
                    Generate recommendations
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      )}

      {recipeView === RECIPE_VIEW.MATCHED && aiError && !isAiLoading && (
        <p
          className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          role="alert"
        >
          {aiError}
        </p>
      )}

      <div
        className={
          recipeView === RECIPE_VIEW.SCOUT
            ? 'flex min-h-0 flex-1 flex-col'
            : 'hidden'
        }
        aria-hidden={recipeView !== RECIPE_VIEW.SCOUT}
      >
        <FridgeScoutChat
          ref={scoutChatRef}
          expanded
          fullscreen
          dietaryPreference={activeDietaryPreference}
        />
      </div>

      {recipeView === RECIPE_VIEW.MATCHED && cravingMatchCards.length > 0 && !isAiLoading && (
        <section className="mb-6">
          <h2 className="text-heading mb-3 text-sm font-bold">
            {lastCravingQuery
              ? `Matches for “${lastCravingQuery}”`
              : 'Craving matches'}
          </h2>
          <ul className="space-y-4">
            {cravingMatchCards
              .slice(0, generatedVisibleCounts.craving)
              .map(({ recipe, analysis }) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  analysis={analysis}
                  isSaved={isSaved(recipe.id)}
                  onToggleSave={handleToggleSave}
                  onMarkCooked={markCooked}
                  onAddNeedToShoppingList={addNeededToShoppingList}
                  onAskScoutToTweak={handleAskScoutToTweak}
                  scoutTweakingId={scoutTweakingId}
                  scoutTweakingMode={scoutTweakingMode}
                />
              ))}
          </ul>
          <ViewMoreRecipesButton
            remaining={cravingMatchCards.length - generatedVisibleCounts.craving}
            onClick={() => showMoreGeneratedRecipes('craving')}
          />
          <p className="text-muted mt-3 text-center text-[11px] leading-relaxed">
            From your built-in catalogue, saved library, and TheMealDB.
          </p>
        </section>
      )}

      {recipeView === RECIPE_VIEW.MATCHED && aiRecipeCards.length > 0 && !isAiLoading && (
        <section className="mb-6">
          <h2 className="text-heading mb-3 text-sm font-bold">AI recommendations</h2>
          <ul className="space-y-4">
            {aiRecipeCards
              .slice(0, generatedVisibleCounts.ai)
              .map(({ recipe, analysis }) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  analysis={analysis}
                  isSaved={isSaved(recipe.id)}
                  onToggleSave={handleToggleSave}
                  onMarkCooked={markCooked}
                  onAddNeedToShoppingList={addNeededToShoppingList}
                  onAskScoutToTweak={handleAskScoutToTweak}
                  scoutTweakingId={scoutTweakingId}
                  scoutTweakingMode={scoutTweakingMode}
                />
              ))}
          </ul>
          <ViewMoreRecipesButton
            remaining={aiRecipeCards.length - generatedVisibleCounts.ai}
            onClick={() => showMoreGeneratedRecipes('ai')}
          />
          <p className="text-muted mt-4 text-center text-[11px] leading-relaxed">
            Recommendations are powered by Gemini and saved to your household library.
          </p>
        </section>
      )}

      {recipeView === RECIPE_VIEW.MATCHED && cookableRecipes.length > 0 && (
        <h2 className="text-heading mb-3 text-sm font-bold">From your catalogue</h2>
      )}

      {recipeView === RECIPE_VIEW.MATCHED &&
        !isAiLoading &&
        !cravingSearchLoading &&
        aiRecipeCards.length === 0 &&
        cravingMatchCards.length === 0 &&
        list.length === 0 && (
          <EmptyState
            icon={ChefHat}
            title="No recommendations yet"
            description="Use the recipe generator above or open Fridge Scout to chat and tweak meals."
          />
        )}

      {recipeView !== RECIPE_VIEW.SCOUT &&
        (list.length === 0 ? (
        recipeView === RECIPE_VIEW.MATCHED &&
        (aiRecipes.length > 0 || cravingMatches.length > 0 || isAiLoading || cravingSearchLoading)
          ? null
        : recipeView === RECIPE_VIEW.MATCHED &&
            aiRecipeCards.length === 0 &&
            cravingMatchCards.length === 0
          ? null
        : (
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
        <>
          <ul className="space-y-4">
            {(recipeView === RECIPE_VIEW.MATCHED
              ? list.slice(0, generatedVisibleCounts.catalogue)
              : list
            ).map(({ recipe, analysis }) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                analysis={analysis}
                isSaved={isSaved(recipe.id)}
                onToggleSave={handleToggleSave}
                onMarkCooked={markCooked}
                onAddNeedToShoppingList={addNeededToShoppingList}
                onAskScoutToTweak={handleAskScoutToTweak}
                scoutTweakingId={scoutTweakingId}
                scoutTweakingMode={scoutTweakingMode}
              />
            ))}
          </ul>
          {recipeView === RECIPE_VIEW.MATCHED && (
            <ViewMoreRecipesButton
              remaining={list.length - generatedVisibleCounts.catalogue}
              onClick={() => showMoreGeneratedRecipes('catalogue')}
            />
          )}
        </>
      ))}
    </div>
  );
}

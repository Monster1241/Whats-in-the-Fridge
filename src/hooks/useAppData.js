import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAppState, saveAppState } from '../api.js';
import { migrateItems, inventoryChangedByMigration, normalizeName } from '../inventory/itemUtils.js';
import { DEFAULT_ENABLED_MODULES, normalizeEnabledModules } from '../inventory/modules.js';
import {
  applyConsumptionLearningFields,
  processItemDepletion,
  processItemRestock,
} from '../inventory/restockLearning.js';
import { normalizeUsageInsights, recordUsageInsightEvent } from '../inventory/usageInsights.js';
import { diffAppState, toApiStateSnapshot } from '../utils/diffAppState.js';

export const DEFAULT_SETTINGS = {
  theme: 'light',
  user: { name: '', email: '' },
};

const SAVE_DELAY_MS = 400;

function resolvePatchResult(result, prevItems) {
  if (result && typeof result === 'object' && Array.isArray(result.items)) {
    return {
      items: result.items,
      restockFrom: result.restockFrom ?? null,
      depletionFrom: result.depletionFrom ?? null,
    };
  }
  return { items: result, restockFrom: null, depletionFrom: null };
}

export function useAppData(enabled) {
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [enabledModules, setEnabledModules] = useState({ ...DEFAULT_ENABLED_MODULES });
  const [savedIds, setSavedIds] = useState([]);
  const [recipeLibrary, setRecipeLibrary] = useState([]);
  const [onboarding, setOnboarding] = useState({ dismissed: [] });
  const [restockHistory, setRestockHistory] = useState([]);
  const [itemKnowledge, setItemKnowledge] = useState([]);
  const [usageInsights, setUsageInsights] = useState(() => normalizeUsageInsights(null));
  const [householdCode, setHouseholdCode] = useState('');

  const skipSaveRef = useRef(true);
  const saveTimerRef = useRef(null);
  const saveEpochRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const hasUnsyncedEditsRef = useRef(false);
  const lastSyncedRef = useRef(null);
  const latestRef = useRef({
    items,
    settings,
    savedIds,
    recipeLibrary,
    onboarding,
    restockHistory,
    itemKnowledge,
    usageInsights,
  });

  latestRef.current = {
    items,
    settings,
    savedIds,
    recipeLibrary,
    onboarding,
    restockHistory,
    itemKnowledge,
    usageInsights,
  };

  const applyState = useCallback((state) => {
    hasUnsyncedEditsRef.current = false;
    const migrated = migrateItems(state.items);
    const needsPersist = inventoryChangedByMigration(state.items, migrated);
    setItems(migrated);
    setSettings({ ...DEFAULT_SETTINGS, ...state.settings });
    setEnabledModules(normalizeEnabledModules(state.enabledModules));
    setSavedIds(Array.isArray(state.savedRecipeIds) ? state.savedRecipeIds : []);
    setRecipeLibrary(Array.isArray(state.recipeLibrary) ? state.recipeLibrary : []);
    setOnboarding(
      state.onboarding?.dismissed ? state.onboarding : { dismissed: [] },
    );
    setRestockHistory(Array.isArray(state.restockHistory) ? state.restockHistory : []);
    setItemKnowledge(Array.isArray(state.itemKnowledge) ? state.itemKnowledge : []);
    setUsageInsights(normalizeUsageInsights(state.usageInsights));
    setHouseholdCode(state.householdCode || state.inviteCode || '');
    lastSyncedRef.current = toApiStateSnapshot({
      items: needsPersist ? (state.items ?? []) : migrated,
      settings: { ...DEFAULT_SETTINGS, ...state.settings },
      savedIds: Array.isArray(state.savedRecipeIds) ? state.savedRecipeIds : [],
      recipeLibrary: Array.isArray(state.recipeLibrary) ? state.recipeLibrary : [],
      onboarding: state.onboarding?.dismissed ? state.onboarding : { dismissed: [] },
      restockHistory: Array.isArray(state.restockHistory) ? state.restockHistory : [],
      itemKnowledge: Array.isArray(state.itemKnowledge) ? state.itemKnowledge : [],
      usageInsights: normalizeUsageInsights(state.usageInsights),
    });
    skipSaveRef.current = !needsPersist;
  }, []);

  const reload = useCallback(async () => {
    if (!enabled) return null;
    setLoading(true);
    setError(null);
    try {
      const state = await fetchAppState();
      skipSaveRef.current = true;
      applyState(state);
      setError(null);
      setSaveError(null);
      return state;
    } catch (err) {
      setError(err.message || 'Could not connect to the server.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [applyState, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        setError(null);
        setLoading(true);
        const state = await fetchAppState();
        if (!cancelled) {
          skipSaveRef.current = true;
          applyState(state);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not connect to the server.');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyState, enabled]);

  useEffect(() => {
    if (!enabled || loading || error) return undefined;

    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return undefined;
    }

    hasUnsyncedEditsRef.current = true;
    const epoch = ++saveEpochRef.current;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      saveTimerRef.current = null;
      const {
        items: nextItems,
        settings: nextSettings,
        savedIds: nextSaved,
        recipeLibrary: nextRecipeLibrary,
        onboarding: nextOnboarding,
        restockHistory: nextRestockHistory,
      } = latestRef.current;
      saveInFlightRef.current = true;
      try {
        const nextSnapshot = toApiStateSnapshot({
          items: nextItems,
          settings: nextSettings,
          savedIds: nextSaved,
          recipeLibrary: nextRecipeLibrary,
          onboarding: nextOnboarding,
          restockHistory: nextRestockHistory,
          itemKnowledge: latestRef.current.itemKnowledge,
          usageInsights: latestRef.current.usageInsights,
        });
        const partial = diffAppState(lastSyncedRef.current, nextSnapshot);
        if (Object.keys(partial).length === 0) {
          if (epoch !== saveEpochRef.current) return;
          hasUnsyncedEditsRef.current = false;
          setSaveError(null);
          return;
        }
        await saveAppState(partial);
        if (epoch !== saveEpochRef.current) return;
        lastSyncedRef.current = { ...lastSyncedRef.current, ...partial };
        hasUnsyncedEditsRef.current = false;
        setSaveError(null);
      } catch (err) {
        if (epoch !== saveEpochRef.current) return;
        setSaveError(err.message || 'Failed to save to MongoDB.');
      } finally {
        if (epoch === saveEpochRef.current) {
          saveInFlightRef.current = false;
        }
      }
    }, SAVE_DELAY_MS);

    return () => {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    };
  }, [items, settings, savedIds, recipeLibrary, onboarding, restockHistory, itemKnowledge, usageInsights, loading, error, enabled]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  const updateItems = useCallback((updater) => {
    setItems((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  const updateRestockHistory = useCallback((updater) => {
    setRestockHistory((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  const updateItemKnowledge = useCallback((updater) => {
    setItemKnowledge((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  const recordUsageEvent = useCallback((event, amount = 1) => {
    setUsageInsights((prev) => recordUsageInsightEvent(prev, event, amount));
  }, []);

  const syncUsageInsights = useCallback((insights) => {
    setUsageInsights(normalizeUsageInsights(insights));
  }, []);

  const persistSnapshot = useCallback(async (snapshot, epoch) => {
    saveInFlightRef.current = true;
    try {
      const nextSnapshot = toApiStateSnapshot(snapshot);
      const partial = diffAppState(lastSyncedRef.current, nextSnapshot);
      if (Object.keys(partial).length === 0) {
        if (epoch !== saveEpochRef.current) return;
        hasUnsyncedEditsRef.current = false;
        setSaveError(null);
        return;
      }
      await saveAppState(partial);
      if (epoch !== saveEpochRef.current) return;
      lastSyncedRef.current = { ...lastSyncedRef.current, ...partial };
      hasUnsyncedEditsRef.current = false;
      setSaveError(null);
    } catch (err) {
      if (epoch !== saveEpochRef.current) return;
      setSaveError(err.message || 'Failed to save to MongoDB.');
      throw err;
    } finally {
      if (epoch === saveEpochRef.current) {
        saveInFlightRef.current = false;
      }
    }
  }, []);

  /**
   * Apply an inventory patch and optionally save immediately (used for banner actions).
   * @param {(prev: unknown[]) => unknown[] | { items: unknown[], restockFrom?: object, depletionFrom?: object }} recipe
   * @param {{ saveNow?: boolean }} [options]
   */
  const patchItems = useCallback(
    async (recipe, { saveNow = false } = {}) => {
      const prevItems = latestRef.current.items;
      const raw = typeof recipe === 'function' ? recipe(prevItems) : recipe;
      let { items: nextItems, restockFrom, depletionFrom } = resolvePatchResult(raw, prevItems);
      if (!Array.isArray(nextItems) || nextItems === prevItems) return false;

      let nextRestock = latestRef.current.restockHistory;
      let restockHistoryChanged = false;

      if (depletionFrom) {
        const depletion = processItemDepletion(nextRestock, depletionFrom);
        nextRestock = depletion.restockHistory;
        restockHistoryChanged = true;
      }

      if (restockFrom) {
        const learning = processItemRestock(nextRestock, restockFrom);
        nextRestock = learning.restockHistory;
        restockHistoryChanged = true;
        const now = new Date().toISOString();
        nextItems = nextItems.map((entry) => {
          if (
            normalizeName(entry.name) !== normalizeName(restockFrom.name)
            || entry.itemType !== restockFrom.itemType
          ) {
            return entry;
          }
          return applyConsumptionLearningFields(entry, {
            consumptionDuration: learning.consumptionDuration,
            consumptionLearned: learning.consumptionLearned,
            now,
          });
        });
      }

      const snapshot = {
        ...latestRef.current,
        items: nextItems,
        restockHistory: nextRestock,
      };
      latestRef.current = snapshot;

      if (saveNow) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        skipSaveRef.current = true;
      }

      setItems(nextItems);
      if (restockHistoryChanged) {
        setRestockHistory(nextRestock);
      }

      if (!saveNow) {
        hasUnsyncedEditsRef.current = true;
        return true;
      }

      hasUnsyncedEditsRef.current = true;
      const epoch = ++saveEpochRef.current;
      try {
        await persistSnapshot(snapshot, epoch);
        return true;
      } catch {
        return false;
      }
    },
    [persistSnapshot],
  );

  const updateSettings = useCallback((updater) => {
    setSettings((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  const updateEnabledModules = useCallback(
    async (patch) => {
      const next = normalizeEnabledModules({ ...enabledModules, ...patch });
      setEnabledModules(next);
      setSaveError(null);
      try {
        const state = await saveAppState({ enabledModules: next });
        skipSaveRef.current = true;
        applyState(state);
      } catch (err) {
        setSaveError(err.message || 'Could not save dashboard settings.');
        await reload();
        throw err;
      }
    },
    [enabledModules, applyState, reload],
  );

  const isDismissed = useCallback(
    (id) => onboarding.dismissed.includes(id),
    [onboarding.dismissed],
  );

  const dismissOnboarding = useCallback((id) => {
    setOnboarding((prev) => {
      if (prev.dismissed.includes(id)) return prev;
      return { dismissed: [...prev.dismissed, id] };
    });
  }, []);

  const resetOnboarding = useCallback(() => {
    setOnboarding({ dismissed: [] });
  }, []);

  const dismissSaveError = useCallback(() => {
    setSaveError(null);
  }, []);

  const isSaved = useCallback((recipeId) => savedIds.includes(recipeId), [savedIds]);

  const toggleSave = useCallback((recipeId) => {
    setSavedIds((prev) =>
      prev.includes(recipeId) ? prev.filter((id) => id !== recipeId) : [...prev, recipeId],
    );
  }, []);

  const rememberRecipe = useCallback((recipe) => {
    if (!recipe?.id) return;
    setRecipeLibrary((prev) => {
      if (prev.some((entry) => entry.id === recipe.id)) return prev;
      return [...prev, recipe];
    });
  }, []);

  const mergeRecipeLibrary = useCallback((recipes) => {
    if (!Array.isArray(recipes) || recipes.length === 0) return;
    setRecipeLibrary((prev) => {
      const byId = new Map(prev.map((entry) => [entry.id, entry]));
      for (const recipe of recipes) {
        if (recipe?.id) byId.set(recipe.id, recipe);
      }
      return [...byId.values()];
    });
  }, []);

  const replaceItemsFromServer = useCallback((serverItems, options = {}) => {
    const migrated = migrateItems(serverItems);
    skipSaveRef.current = true;
    hasUnsyncedEditsRef.current = false;
    setItems(migrated);
    const patch = {};
    if (Array.isArray(options.restockHistory)) patch.restockHistory = options.restockHistory;
    if (Array.isArray(options.itemKnowledge)) patch.itemKnowledge = options.itemKnowledge;
    if (options.usageInsights) patch.usageInsights = normalizeUsageInsights(options.usageInsights);
    if (Object.keys(patch).length) {
      if (patch.restockHistory) setRestockHistory(patch.restockHistory);
      if (patch.itemKnowledge) setItemKnowledge(patch.itemKnowledge);
      if (patch.usageInsights) setUsageInsights(patch.usageInsights);
      latestRef.current = { ...latestRef.current, items: migrated, ...patch };
    } else {
      latestRef.current = { ...latestRef.current, items: migrated };
    }
    lastSyncedRef.current = toApiStateSnapshot(latestRef.current);
    return migrated;
  }, []);

  return {
    loading,
    error,
    saveError,
    dismissSaveError,
    reload,
    items,
    updateItems,
    patchItems,
    replaceItemsFromServer,
    restockHistory,
    updateRestockHistory,
    itemKnowledge,
    updateItemKnowledge,
    usageInsights,
    recordUsageEvent,
    syncUsageInsights,
    settings,
    updateSettings,
    enabledModules,
    updateEnabledModules,
    householdCode,
    savedRecipes: { savedIds, isSaved, toggleSave, recipeLibrary, rememberRecipe, mergeRecipeLibrary },
    onboarding: { isDismissed, dismiss: dismissOnboarding, resetOnboarding },
  };
}

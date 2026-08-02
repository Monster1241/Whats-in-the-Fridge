import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAppState, saveAppState } from '../api.js';
import { migrateItems, inventoryChangedByMigration } from '../inventory/itemUtils.js';
import { DEFAULT_ENABLED_MODULES, normalizeEnabledModules } from '../inventory/modules.js';
import { recordRestockEvent } from '../inventory/restockHistory.js';

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
    };
  }
  return { items: result, restockFrom: null };
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
  const [householdCode, setHouseholdCode] = useState('');

  const skipSaveRef = useRef(true);
  const saveTimerRef = useRef(null);
  const saveEpochRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const hasUnsyncedEditsRef = useRef(false);
  const latestRef = useRef({ items, settings, savedIds, recipeLibrary, onboarding, restockHistory });

  latestRef.current = { items, settings, savedIds, recipeLibrary, onboarding, restockHistory };

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
    setHouseholdCode(state.householdCode || state.inviteCode || '');
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
        await saveAppState({
          items: nextItems,
          settings: nextSettings,
          savedRecipeIds: nextSaved,
          recipeLibrary: nextRecipeLibrary,
          onboarding: nextOnboarding,
          restockHistory: nextRestockHistory,
        });
        if (epoch !== saveEpochRef.current) return;
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
  }, [items, settings, savedIds, recipeLibrary, onboarding, restockHistory, loading, error, enabled]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  const updateItems = useCallback((updater) => {
    setItems((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  const updateRestockHistory = useCallback((updater) => {
    setRestockHistory((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  const persistSnapshot = useCallback(async (snapshot, epoch) => {
    saveInFlightRef.current = true;
    try {
      await saveAppState({
        items: snapshot.items,
        settings: snapshot.settings,
        savedRecipeIds: snapshot.savedIds,
        recipeLibrary: snapshot.recipeLibrary,
        onboarding: snapshot.onboarding,
        restockHistory: snapshot.restockHistory,
      });
      if (epoch !== saveEpochRef.current) return;
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
   * @param {(prev: unknown[]) => unknown[] | { items: unknown[], restockFrom?: object }} recipe
   * @param {{ saveNow?: boolean }} [options]
   */
  const patchItems = useCallback(
    async (recipe, { saveNow = false } = {}) => {
      const prevItems = latestRef.current.items;
      const raw = typeof recipe === 'function' ? recipe(prevItems) : recipe;
      const { items: nextItems, restockFrom } = resolvePatchResult(raw, prevItems);
      if (!Array.isArray(nextItems) || nextItems === prevItems) return false;

      let nextRestock = latestRef.current.restockHistory;
      if (restockFrom) {
        nextRestock = recordRestockEvent(nextRestock, restockFrom);
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
      if (restockFrom) {
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

  return {
    loading,
    error,
    saveError,
    dismissSaveError,
    reload,
    items,
    updateItems,
    patchItems,
    restockHistory,
    updateRestockHistory,
    settings,
    updateSettings,
    enabledModules,
    updateEnabledModules,
    householdCode,
    savedRecipes: { savedIds, isSaved, toggleSave, recipeLibrary, rememberRecipe },
    onboarding: { isDismissed, dismiss: dismissOnboarding, resetOnboarding },
  };
}

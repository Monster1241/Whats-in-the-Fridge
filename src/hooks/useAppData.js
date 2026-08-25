import { useCallback, useEffect, useRef, useState } from 'react';
import { clearAllInventory, fetchAppState, restoreClearedInventory, saveAppState, syncInventory } from '../api.js';
import { toInventoryClearBackupSummary } from '../inventory/clearBackup.js';
import { cacheAppStateResponse, getActiveHouseholdId } from '../inventory/offlineCache.js';
import { migrateItems, inventoryChangedByMigration, normalizeName } from '../inventory/itemUtils.js';
import { DEFAULT_ENABLED_MODULES, normalizeEnabledModules } from '../inventory/modules.js';
import {
  applyConsumptionLearningFields,
  processItemDepletion,
  processItemRestock,
} from '../inventory/restockLearning.js';
import { normalizeUsageInsights, recordUsageInsightEvent } from '../inventory/usageInsights.js';
import {
  applyInventoryDeltaLocal,
  buildInventorySyncPayload,
  buildStateSavePayload,
  diffInventoryItems,
  toApiStateSnapshot,
} from '../utils/diffAppState.js';
import {
  applyThemePreference,
  normalizeThemePreference,
  readStoredThemePreference,
  subscribeSystemColorScheme,
  writeStoredThemePreference,
} from '../theme/themePreference.js';

export const DEFAULT_SETTINGS = {
  theme: 'system',
  user: { name: '', email: '' },
  dietaryPreference: 'none',
};

function mergeSettingsWithDeviceTheme(settings) {
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  const stored = readStoredThemePreference();
  return {
    ...merged,
    theme: stored ?? normalizeThemePreference(merged.theme),
  };
}

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
  const [offlineMode, setOfflineMode] = useState(false);
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(() => mergeSettingsWithDeviceTheme(DEFAULT_SETTINGS));
  const [enabledModules, setEnabledModules] = useState({ ...DEFAULT_ENABLED_MODULES });
  const [savedIds, setSavedIds] = useState([]);
  const [recipeLibrary, setRecipeLibrary] = useState([]);
  const [onboarding, setOnboarding] = useState({ dismissed: [] });
  const [restockHistory, setRestockHistory] = useState([]);
  const [itemKnowledge, setItemKnowledge] = useState([]);
  const [usageInsights, setUsageInsights] = useState(() => normalizeUsageInsights(null));
  const [householdCode, setHouseholdCode] = useState('');
  const [inventoryClearBackup, setInventoryClearBackup] = useState(null);

  const skipSaveRef = useRef(true);
  const offlineModeRef = useRef(false);
  const saveTimerRef = useRef(null);
  const saveEpochRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const hasUnsyncedEditsRef = useRef(false);
  const lastSyncedRef = useRef(null);
  const inventoryRevisionRef = useRef(0);
  const latestRef = useRef({
    items,
    settings,
    savedIds,
    recipeLibrary,
    onboarding,
    restockHistory,
    itemKnowledge,
    usageInsights,
    inventoryRevision: 0,
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
    inventoryRevision: inventoryRevisionRef.current,
  };

  const setOffline = useCallback((next) => {
    offlineModeRef.current = Boolean(next);
    setOfflineMode(Boolean(next));
  }, []);

  const applyState = useCallback((state) => {
    hasUnsyncedEditsRef.current = false;
    const migrated = migrateItems(state.items);
    const needsPersist = inventoryChangedByMigration(state.items, migrated);
    const revision = Number(state.inventoryRevision ?? 0);
    inventoryRevisionRef.current = revision;
    setItems(migrated);
    setSettings(mergeSettingsWithDeviceTheme(state.settings));
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
    setInventoryClearBackup(toInventoryClearBackupSummary(state.inventoryClearBackup) ?? null);
    lastSyncedRef.current = toApiStateSnapshot({
      items: needsPersist ? (state.items ?? []) : migrated,
      settings: mergeSettingsWithDeviceTheme(state.settings),
      savedIds: Array.isArray(state.savedRecipeIds) ? state.savedRecipeIds : [],
      recipeLibrary: Array.isArray(state.recipeLibrary) ? state.recipeLibrary : [],
      onboarding: state.onboarding?.dismissed ? state.onboarding : { dismissed: [] },
      restockHistory: Array.isArray(state.restockHistory) ? state.restockHistory : [],
      itemKnowledge: Array.isArray(state.itemKnowledge) ? state.itemKnowledge : [],
      usageInsights: normalizeUsageInsights(state.usageInsights),
      inventoryRevision: revision,
    });
    latestRef.current = {
      ...latestRef.current,
      items: migrated,
      settings: mergeSettingsWithDeviceTheme(state.settings),
      savedIds: Array.isArray(state.savedRecipeIds) ? state.savedRecipeIds : [],
      recipeLibrary: Array.isArray(state.recipeLibrary) ? state.recipeLibrary : [],
      onboarding: state.onboarding?.dismissed ? state.onboarding : { dismissed: [] },
      restockHistory: Array.isArray(state.restockHistory) ? state.restockHistory : [],
      itemKnowledge: Array.isArray(state.itemKnowledge) ? state.itemKnowledge : [],
      usageInsights: normalizeUsageInsights(state.usageInsights),
      inventoryRevision: revision,
    };
    // Never auto-persist migration/offline caches while offline.
    skipSaveRef.current = !needsPersist || Boolean(state.fromOfflineCache) || offlineModeRef.current;
  }, []);

  const persistLatest = useCallback(async (epoch, { retryOnConflict = true } = {}) => {
    if (offlineModeRef.current) {
      setSaveError('Offline — changes will sync when you are back online.');
      return;
    }
    const localSnapshot = toApiStateSnapshot(latestRef.current);
    const base = lastSyncedRef.current;
    const inventoryPayload = buildInventorySyncPayload(
      base,
      localSnapshot,
      Number(base?.inventoryRevision ?? inventoryRevisionRef.current ?? 0),
    );
    const metaPartial = buildStateSavePayload(base, localSnapshot);
    if (!inventoryPayload && Object.keys(metaPartial).length === 0) {
      if (epoch !== saveEpochRef.current) return;
      hasUnsyncedEditsRef.current = false;
      setSaveError(null);
      return;
    }

    saveInFlightRef.current = true;
    try {
      let state = null;
      if (inventoryPayload) {
        state = await syncInventory(inventoryPayload);
        inventoryRevisionRef.current = Number(state?.inventoryRevision ?? inventoryRevisionRef.current);
        latestRef.current = {
          ...latestRef.current,
          inventoryRevision: inventoryRevisionRef.current,
        };
      }
      if (Object.keys(metaPartial).length > 0) {
        state = await saveAppState(metaPartial);
      }
      if (epoch !== saveEpochRef.current) return;
      skipSaveRef.current = true;
      if (state) {
        applyState(state);
        const householdId = getActiveHouseholdId();
        if (householdId) cacheAppStateResponse(householdId, state);
      }
      hasUnsyncedEditsRef.current = false;
      setSaveError(null);
      setOffline(false);
    } catch (err) {
      if (retryOnConflict && err?.conflict && err.body?.state) {
        const serverState = err.body.state;
        const itemDelta = diffInventoryItems(base?.items ?? [], localSnapshot.items ?? []);
        skipSaveRef.current = true;
        applyState(serverState);

        const mergedItems = applyInventoryDeltaLocal(migrateItems(serverState.items ?? []), itemDelta);
        const metaDiff = buildStateSavePayload(
          toApiStateSnapshot({
            ...serverState,
            savedIds: serverState.savedRecipeIds,
            inventoryRevision: serverState.inventoryRevision,
          }),
          localSnapshot,
        );

        const nextLocal = {
          items: mergedItems,
          settings: mergeSettingsWithDeviceTheme(
            metaDiff.settings ?? { ...DEFAULT_SETTINGS, ...serverState.settings },
          ),
          savedIds: metaDiff.savedRecipeIds ?? serverState.savedRecipeIds ?? [],
          recipeLibrary: metaDiff.recipeLibrary ?? serverState.recipeLibrary ?? [],
          onboarding: metaDiff.onboarding ?? serverState.onboarding ?? { dismissed: [] },
          restockHistory: metaDiff.restockHistory ?? serverState.restockHistory ?? [],
          itemKnowledge: metaDiff.itemKnowledge ?? serverState.itemKnowledge ?? [],
          usageInsights: metaDiff.usageInsights
            ?? normalizeUsageInsights(serverState.usageInsights),
          inventoryRevision: Number(serverState.inventoryRevision ?? 0),
        };
        latestRef.current = nextLocal;
        inventoryRevisionRef.current = nextLocal.inventoryRevision;
        setItems(mergedItems);
        if (metaDiff.settings) setSettings(nextLocal.settings);
        if (metaDiff.savedRecipeIds) setSavedIds(nextLocal.savedIds);
        if (metaDiff.recipeLibrary) setRecipeLibrary(nextLocal.recipeLibrary);
        if (metaDiff.onboarding) setOnboarding(nextLocal.onboarding);
        if (metaDiff.restockHistory) setRestockHistory(nextLocal.restockHistory);
        if (metaDiff.itemKnowledge) setItemKnowledge(nextLocal.itemKnowledge);
        if (metaDiff.usageInsights) setUsageInsights(nextLocal.usageInsights);
        skipSaveRef.current = true;
        try {
          await persistLatest(epoch, { retryOnConflict: false });
        } catch (retryErr) {
          if (epoch !== saveEpochRef.current) return;
          setSaveError(retryErr.message || 'Failed to save to MongoDB.');
        }
        return;
      }
      if (epoch !== saveEpochRef.current) return;
      setSaveError(err.message || 'Failed to save to MongoDB.');
      throw err;
    } finally {
      if (epoch === saveEpochRef.current) {
        saveInFlightRef.current = false;
      }
    }
  }, [applyState, setOffline]);

  const reload = useCallback(async () => {
    if (!enabled) return null;
    setLoading(true);
    setError(null);
    try {
      const state = await fetchAppState();
      skipSaveRef.current = true;
      applyState(state);
      setOffline(Boolean(state?.fromOfflineCache));
      setError(null);
      setSaveError(null);
      return state;
    } catch (err) {
      setError(err.message || 'Could not connect to the server.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [applyState, enabled, setOffline]);

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
          setOffline(Boolean(state?.fromOfflineCache));
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
  }, [applyState, enabled, setOffline]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onOnline = () => {
      void reload().catch(() => {});
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [enabled, reload]);

  useEffect(() => {
    if (!enabled || loading || error || offlineMode) return undefined;

    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return undefined;
    }

    hasUnsyncedEditsRef.current = true;
    const epoch = ++saveEpochRef.current;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      saveTimerRef.current = null;
      try {
        await persistLatest(epoch);
      } catch {
        // saveError already set
      }
    }, SAVE_DELAY_MS);

    return () => {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    };
  }, [items, settings, savedIds, recipeLibrary, onboarding, restockHistory, itemKnowledge, usageInsights, loading, error, enabled, offlineMode, persistLatest]);

  useEffect(() => {
    if (!enabled) return undefined;
    const flush = () => {
      if (!hasUnsyncedEditsRef.current || saveInFlightRef.current) return;
      const epoch = ++saveEpochRef.current;
      void persistLatest(epoch).catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, persistLatest]);

  useEffect(() => {
    applyThemePreference(settings.theme);
    return subscribeSystemColorScheme(settings.theme, () => {
      applyThemePreference(settings.theme);
    });
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

      latestRef.current = {
        ...latestRef.current,
        items: nextItems,
        restockHistory: nextRestock,
      };

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
        await persistLatest(epoch);
        return true;
      } catch {
        return false;
      }
    },
    [persistLatest],
  );

  const updateSettings = useCallback((updater) => {
    setSettings((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const theme = normalizeThemePreference(next?.theme);
      writeStoredThemePreference(theme);
      applyThemePreference(theme);
      return { ...next, theme };
    });
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
    if (typeof options.inventoryRevision === 'number') {
      inventoryRevisionRef.current = options.inventoryRevision;
      patch.inventoryRevision = options.inventoryRevision;
    }
    if (options.inventoryClearBackup !== undefined) {
      setInventoryClearBackup(toInventoryClearBackupSummary(options.inventoryClearBackup) ?? null);
    }
    latestRef.current = { ...latestRef.current, items: migrated, ...patch };
    if (patch.restockHistory) setRestockHistory(patch.restockHistory);
    if (patch.itemKnowledge) setItemKnowledge(patch.itemKnowledge);
    if (patch.usageInsights) setUsageInsights(patch.usageInsights);
    lastSyncedRef.current = toApiStateSnapshot(latestRef.current);
    return migrated;
  }, []);

  const clearAllItems = useCallback(async () => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const state = await clearAllInventory();
    skipSaveRef.current = true;
    hasUnsyncedEditsRef.current = false;
    applyState(state);
    return state;
  }, [applyState]);

  const restoreClearedItems = useCallback(async () => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const state = await restoreClearedInventory();
    skipSaveRef.current = true;
    hasUnsyncedEditsRef.current = false;
    applyState(state);
    return state;
  }, [applyState]);

  return {
    loading,
    error,
    saveError,
    dismissSaveError,
    reload,
    offlineMode,
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
    inventoryClearBackup,
    clearAllItems,
    restoreClearedItems,
    savedRecipes: { savedIds, isSaved, toggleSave, recipeLibrary, rememberRecipe, mergeRecipeLibrary },
    onboarding: { isDismissed, dismiss: dismissOnboarding, resetOnboarding },
  };
}

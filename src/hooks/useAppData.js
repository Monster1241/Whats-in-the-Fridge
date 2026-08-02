import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAppState, saveAppState } from '../api.js';
import { migrateItems } from '../inventory/itemUtils.js';
import { DEFAULT_ENABLED_MODULES, normalizeEnabledModules } from '../inventory/modules.js';

export const DEFAULT_SETTINGS = {
  theme: 'light',
  user: { name: '', email: '' },
};

const SAVE_DELAY_MS = 400;

export function useAppData(enabled) {
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [enabledModules, setEnabledModules] = useState({ ...DEFAULT_ENABLED_MODULES });
  const [savedIds, setSavedIds] = useState([]);
  const [onboarding, setOnboarding] = useState({ dismissed: [] });
  const [restockHistory, setRestockHistory] = useState([]);
  const [householdCode, setHouseholdCode] = useState('');

  const skipSaveRef = useRef(true);
  const saveTimerRef = useRef(null);
  const saveEpochRef = useRef(0);
  const latestRef = useRef({ items, settings, savedIds, onboarding, restockHistory });

  latestRef.current = { items, settings, savedIds, onboarding, restockHistory };

  const applyState = useCallback((state) => {
    setItems(migrateItems(state.items));
    setSettings({ ...DEFAULT_SETTINGS, ...state.settings });
    setEnabledModules(normalizeEnabledModules(state.enabledModules));
    setSavedIds(Array.isArray(state.savedRecipeIds) ? state.savedRecipeIds : []);
    setOnboarding(
      state.onboarding?.dismissed ? state.onboarding : { dismissed: [] },
    );
    setRestockHistory(Array.isArray(state.restockHistory) ? state.restockHistory : []);
    setHouseholdCode(state.householdCode || state.inviteCode || '');
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
    if (!enabled) return undefined;
    const onFocus = () => {
      reload().catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reload, enabled]);

  useEffect(() => {
    if (!enabled || loading || error) return undefined;

    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return undefined;
    }

    const epoch = ++saveEpochRef.current;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const {
        items: nextItems,
        settings: nextSettings,
        savedIds: nextSaved,
        onboarding: nextOnboarding,
        restockHistory: nextRestockHistory,
      } = latestRef.current;
      try {
        await saveAppState({
          items: nextItems,
          settings: nextSettings,
          savedRecipeIds: nextSaved,
          onboarding: nextOnboarding,
          restockHistory: nextRestockHistory,
        });
        if (epoch !== saveEpochRef.current) return;
        setSaveError(null);
      } catch (err) {
        if (epoch !== saveEpochRef.current) return;
        setSaveError(err.message || 'Failed to save to MongoDB.');
      }
    }, SAVE_DELAY_MS);

    return () => clearTimeout(saveTimerRef.current);
  }, [items, settings, savedIds, onboarding, restockHistory, loading, error, enabled]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  const updateItems = useCallback((updater) => {
    setItems((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  const updateRestockHistory = useCallback((updater) => {
    setRestockHistory((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

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

  return {
    loading,
    error,
    saveError,
    dismissSaveError,
    reload,
    items,
    updateItems,
    restockHistory,
    updateRestockHistory,
    settings,
    updateSettings,
    enabledModules,
    updateEnabledModules,
    householdCode,
    savedRecipes: { savedIds, isSaved, toggleSave },
    onboarding: { isDismissed, dismiss: dismissOnboarding, resetOnboarding },
  };
}

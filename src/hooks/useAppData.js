import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAppState, saveAppState } from '../api.js';

export const DEFAULT_SETTINGS = {
  theme: 'light',
  user: { name: '', email: '' },
};

function migrateItem(item) {
  const category = ['Ambient', 'Fresh', 'Freezer'].includes(item.category)
    ? item.category
    : 'Fresh';
  const status = item.status === 'out' ? 'out' : 'fresh';
  return {
    ...item,
    expiryDate: item.expiryDate ?? null,
    category,
    status,
  };
}

function migrateItems(items) {
  return Array.isArray(items) ? items.map(migrateItem) : [];
}

const SAVE_DELAY_MS = 400;

export function useAppData(enabled) {
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [savedIds, setSavedIds] = useState([]);
  const [onboarding, setOnboarding] = useState({ dismissed: [] });
  const [householdCode, setHouseholdCode] = useState('');

  const skipSaveRef = useRef(true);
  const saveTimerRef = useRef(null);
  const latestRef = useRef({ items, settings, savedIds, onboarding });

  latestRef.current = { items, settings, savedIds, onboarding };

  const applyState = useCallback((state) => {
    setItems(migrateItems(state.items));
    setSettings({ ...DEFAULT_SETTINGS, ...state.settings });
    setSavedIds(Array.isArray(state.savedRecipeIds) ? state.savedRecipeIds : []);
    setOnboarding(
      state.onboarding?.dismissed ? state.onboarding : { dismissed: [] },
    );
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

    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const { items: nextItems, settings: nextSettings, savedIds: nextSaved, onboarding: nextOnboarding } =
        latestRef.current;
      try {
        const state = await saveAppState({
          items: nextItems,
          settings: nextSettings,
          savedRecipeIds: nextSaved,
          onboarding: nextOnboarding,
        });
        skipSaveRef.current = true;
        applyState(state);
        setSaveError(null);
      } catch (err) {
        setSaveError(err.message || 'Failed to save to MongoDB.');
      }
    }, SAVE_DELAY_MS);

    return () => clearTimeout(saveTimerRef.current);
  }, [items, settings, savedIds, onboarding, loading, error, enabled, applyState]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  const updateItems = useCallback((updater) => {
    setItems((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  const updateSettings = useCallback((updater) => {
    setSettings((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

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
    settings,
    updateSettings,
    householdCode,
    savedRecipes: { savedIds, isSaved, toggleSave },
    onboarding: { isDismissed, dismiss: dismissOnboarding, resetOnboarding },
  };
}

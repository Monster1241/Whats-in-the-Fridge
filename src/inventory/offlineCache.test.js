import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  cacheAppStateResponse,
  isOfflineNetworkError,
  readCachedAppState,
  readCachedInventory,
  readCachedShoppingList,
  setActiveHouseholdId,
  withOfflineMeta,
} from './offlineCache.js';
import { STATUS } from './constants.js';

describe('offlineCache', () => {
  const store = new Map();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => {
        store.set(key, String(value));
      },
      removeItem: (key) => {
        store.delete(key);
      },
    });
    setActiveHouseholdId('hh123');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('caches app state and derived inventory / shopping slices', () => {
    cacheAppStateResponse('hh123', {
      items: [
        { id: '1', name: 'Milk', status: STATUS.FRESH },
        { id: '2', name: 'Bread', status: STATUS.OUT },
      ],
      settings: { theme: 'light' },
      householdCode: 'ABCD-1234',
    });

    const state = readCachedAppState('hh123');
    expect(state?.payload?.householdCode).toBe('ABCD-1234');
    expect(readCachedInventory('hh123')?.payload?.items).toHaveLength(1);
    expect(readCachedShoppingList('hh123')?.payload?.items?.[0]?.name).toBe('Bread');
  });

  it('marks offline payloads', () => {
    const marked = withOfflineMeta({ items: [] }, '2026-08-25T00:00:00.000Z');
    expect(marked.fromOfflineCache).toBe(true);
    expect(marked.offlineCachedAt).toBe('2026-08-25T00:00:00.000Z');
  });

  it('detects offline network errors', () => {
    expect(isOfflineNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    const httpErr = new Error('Unauthorized');
    httpErr.status = 401;
    expect(isOfflineNetworkError(httpErr)).toBe(false);
  });
});

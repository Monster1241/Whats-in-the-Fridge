import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  cacheAppStateResponse,
  decodeAuthTokenPayload,
  isOfflineNetworkError,
  readCachedAppState,
  readCachedInventory,
  readCachedShoppingList,
  sessionFromStoredToken,
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
    const timeout = new Error('Network timeout. Please check your connection or try again.');
    timeout.name = 'AbortError';
    expect(isOfflineNetworkError(timeout)).toBe(true);
    const httpErr = new Error('Unauthorized');
    httpErr.status = 401;
    expect(isOfflineNetworkError(httpErr)).toBe(false);
  });

  it('rebuilds a session from a still-valid stored JWT', () => {
    const payload = {
      userId: 'user-1',
      email: 'ada@example.com',
      householdId: 'hh-1',
      isVerified: true,
      exp: Date.now() + 60_000,
    };
    const encoded = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const token = `${encoded}.sig`;
    expect(decodeAuthTokenPayload(token)?.userId).toBe('user-1');
    const session = sessionFromStoredToken(token);
    expect(session?.user).toMatchObject({
      id: 'user-1',
      email: 'ada@example.com',
      householdId: 'hh-1',
      isVerified: true,
    });
    expect(session?.needsHousehold).toBe(false);
  });

  it('rejects an expired stored JWT', () => {
    const payload = {
      userId: 'user-1',
      email: 'ada@example.com',
      householdId: 'hh-1',
      isVerified: true,
      exp: Date.now() - 1000,
    };
    const encoded = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(sessionFromStoredToken(`${encoded}.sig`)).toBeNull();
  });
});

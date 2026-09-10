import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_SCOPE_APP, fetchSession, setAuthToken } from './api.js';

function makeToken(payload) {
  const encoded = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${encoded}.sig`;
}

describe('fetchSession', () => {
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
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the stored household session when /auth/me cannot be reached', async () => {
    const token = makeToken({
      userId: 'user-1',
      email: 'ada@example.com',
      householdId: 'hh-1',
      isVerified: true,
      exp: Date.now() + 60_000,
    });
    setAuthToken(token, AUTH_SCOPE_APP);

    const data = await fetchSession(AUTH_SCOPE_APP);

    expect(data.user).toMatchObject({
      id: 'user-1',
      email: 'ada@example.com',
      householdId: 'hh-1',
      isVerified: true,
    });
    expect(data.token).toBe(token);
    expect(data.needsHousehold).toBe(false);
  });

  it('stays logged out when there is no stored session', async () => {
    const data = await fetchSession(AUTH_SCOPE_APP);
    expect(data).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

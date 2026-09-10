import { isInStockInventory, isOnShoppingList } from './constants.js';

const ACTIVE_HOUSEHOLD_KEY = 'fridge.activeHouseholdId';
const INVENTORY_PREFIX = 'cached_inventory_';
const SHOPPING_PREFIX = 'cached_shopping_';
const APP_STATE_PREFIX = 'cached_app_state_';

/**
 * @param {string} token
 * @returns {{ householdId?: string|null, userId?: string, email?: string, isVerified?: boolean, exp?: number } | null}
 */
export function decodeAuthTokenPayload(token) {
  if (!token) return null;
  try {
    const encoded = String(token).split('.')[0];
    if (!encoded) return null;
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (padded.length % 4)) % 4;
    const json = atob(padded + '='.repeat(padLen));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Rebuild a client session from the stored household JWT so a slow or
 * offline /auth/me check does not dump the user back to the login screen.
 * @param {string} token
 * @param {number} [now]
 */
export function sessionFromStoredToken(token, now = Date.now()) {
  const payload = decodeAuthTokenPayload(token);
  const userId = String(payload?.userId ?? '').trim();
  if (!userId) return null;
  if (payload?.exp && now > Number(payload.exp)) return null;

  const isVerified = Boolean(payload.isVerified);
  const householdId = payload.householdId ? String(payload.householdId) : null;
  return {
    user: {
      id: userId,
      email: String(payload.email || ''),
      householdId,
      isVerified,
      isHouseholdOwner: false,
    },
    needsVerification: !isVerified,
    needsHousehold: isVerified && !householdId,
    token,
  };
}

export function setActiveHouseholdId(householdId) {
  const id = String(householdId ?? '').trim();
  try {
    if (id) localStorage.setItem(ACTIVE_HOUSEHOLD_KEY, id);
    else localStorage.removeItem(ACTIVE_HOUSEHOLD_KEY);
  } catch {
    // ignore
  }
}

export function getActiveHouseholdId() {
  try {
    const stored = localStorage.getItem(ACTIVE_HOUSEHOLD_KEY);
    if (stored) return stored;
  } catch {
    // ignore
  }
  return null;
}

/**
 * Resolve household id for cache keys (active session → JWT → last known).
 * @param {string} [token]
 */
export function resolveHouseholdIdForCache(token = '') {
  const active = getActiveHouseholdId();
  if (active) return active;
  const payload = decodeAuthTokenPayload(token);
  const fromToken = payload?.householdId ? String(payload.householdId) : '';
  return fromToken || null;
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.payload == null) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key, payload) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        cachedAt: new Date().toISOString(),
        payload,
      }),
    );
  } catch {
    // quota / private mode
  }
}

/**
 * @param {string} householdId
 * @param {{ items?: unknown[] }} inventoryPayload
 */
export function cacheInventoryResponse(householdId, inventoryPayload) {
  const id = String(householdId ?? '').trim();
  if (!id || !inventoryPayload) return;
  setActiveHouseholdId(id);
  writeCache(`${INVENTORY_PREFIX}${id}`, inventoryPayload);
}

/**
 * @param {string} householdId
 * @param {{ items?: unknown[], shoppingList?: unknown[] }} shoppingPayload
 */
export function cacheShoppingListResponse(householdId, shoppingPayload) {
  const id = String(householdId ?? '').trim();
  if (!id || !shoppingPayload) return;
  setActiveHouseholdId(id);
  writeCache(`${SHOPPING_PREFIX}${id}`, shoppingPayload);
}

/**
 * Cache full household app state and derived inventory / shopping slices.
 * @param {string} householdId
 * @param {Record<string, unknown>} state
 */
export function cacheAppStateResponse(householdId, state) {
  const id = String(householdId ?? '').trim();
  if (!id || !state || typeof state !== 'object') return;
  setActiveHouseholdId(id);
  writeCache(`${APP_STATE_PREFIX}${id}`, state);

  const items = Array.isArray(state.items) ? state.items : [];
  cacheInventoryResponse(id, { items: items.filter((item) => isInStockInventory(item)) });
  const shopping = items.filter((item) => isOnShoppingList(item));
  cacheShoppingListResponse(id, { items: shopping, shoppingList: shopping });
}

/**
 * @param {string} householdId
 */
export function readCachedInventory(householdId) {
  const id = String(householdId ?? '').trim();
  if (!id) return null;
  return readCache(`${INVENTORY_PREFIX}${id}`);
}

/**
 * @param {string} householdId
 */
export function readCachedShoppingList(householdId) {
  const id = String(householdId ?? '').trim();
  if (!id) return null;
  return readCache(`${SHOPPING_PREFIX}${id}`);
}

/**
 * @param {string} householdId
 */
export function readCachedAppState(householdId) {
  const id = String(householdId ?? '').trim();
  if (!id) return null;
  return readCache(`${APP_STATE_PREFIX}${id}`);
}

/**
 * True for offline / network failures (not HTTP 4xx/5xx from a reachable server).
 * @param {unknown} err
 */
export function isOfflineNetworkError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!err || typeof err !== 'object') return false;
  const status = /** @type {{ status?: number }} */ (err).status;
  if (typeof status === 'number' && status > 0) return false;
  const name = String(/** @type {{ name?: string }} */ (err).name ?? '');
  if (name === 'AbortError' || name === 'TimeoutError') return true;
  const message = String(/** @type {{ message?: string }} */ (err).message ?? '').toLowerCase();
  if (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('load failed') ||
    message.includes('network timeout') ||
    message.includes('the internet connection appears to be offline')
  ) {
    return true;
  }
  return name === 'TypeError' || name === 'NetworkError';
}

/**
 * Mark a payload as served from local cache.
 * @template T
 * @param {T} payload
 * @param {string} [cachedAt]
 * @returns {T & { fromOfflineCache: true, offlineCachedAt: string|null }}
 */
export function withOfflineMeta(payload, cachedAt = null) {
  return {
    ...payload,
    fromOfflineCache: true,
    offlineCachedAt: cachedAt ?? null,
  };
}

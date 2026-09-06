import {
  cacheAppStateResponse,
  cacheInventoryResponse,
  cacheShoppingListResponse,
  decodeAuthTokenPayload,
  isOfflineNetworkError,
  readCachedAppState,
  readCachedInventory,
  readCachedShoppingList,
  resolveHouseholdIdForCache,
  setActiveHouseholdId,
  withOfflineMeta,
} from './inventory/offlineCache.js';

/** Absolute API origin for Capacitor; relative `/api` only works in Vite/browser proxy. */
const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

/**
 * Resolve an API path against VITE_API_URL (or `/api` in local Vite).
 * @param {string} endpoint - path like `/auth/session` or full `https://…` URL
 */
export function apiUrl(endpoint) {
  if (!endpoint) return API_BASE;
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE}${path}`;
}

export const AUTH_SCOPE_APP = 'app';
export const AUTH_SCOPE_ADMIN = 'admin';

const TOKEN_KEYS = {
  [AUTH_SCOPE_APP]: 'fridge.authToken',
  [AUTH_SCOPE_ADMIN]: 'fridge.adminAuthToken',
};

/** @returns {'app' | 'admin'} */
export function getAuthScope() {
  try {
    const path = String(window.location.pathname || '/').replace(/\/$/, '') || '/';
    if (path === '/admin' || path.startsWith('/admin/')) return AUTH_SCOPE_ADMIN;
  } catch {
    // ignore
  }
  return AUTH_SCOPE_APP;
}

function tokenKeyForScope(scope = getAuthScope()) {
  return TOKEN_KEYS[scope] || TOKEN_KEYS[AUTH_SCOPE_APP];
}

/**
 * @param {'app' | 'admin'} [scope]
 */
export function getAuthToken(scope = getAuthScope()) {
  try {
    return localStorage.getItem(tokenKeyForScope(scope)) || '';
  } catch {
    return '';
  }
}

/**
 * @param {string} token
 * @param {'app' | 'admin'} [scope]
 */
export function setAuthToken(token, scope = getAuthScope()) {
  try {
    const key = tokenKeyForScope(scope);
    if (token) {
      localStorage.setItem(key, token);
      // Household cache is only for the consumer app session.
      if (scope === AUTH_SCOPE_APP) {
        const payload = decodeAuthTokenPayload(token);
        if (payload?.householdId) setActiveHouseholdId(payload.householdId);
      }
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

/**
 * One-time: seed admin JWT from the shared app token so existing admin tabs keep working.
 * @param {'app' | 'admin'} scope
 */
function ensureAdminTokenSeeded(scope) {
  if (scope !== AUTH_SCOPE_ADMIN) return;
  if (getAuthToken(AUTH_SCOPE_ADMIN)) return;
  const appToken = getAuthToken(AUTH_SCOPE_APP);
  if (appToken) setAuthToken(appToken, AUTH_SCOPE_ADMIN);
}

/**
 * @param {Record<string, string>} [extra]
 * @param {'app' | 'admin'} [scope]
 */
function authHeaders(extra = {}, scope = getAuthScope()) {
  const token = getAuthToken(scope);
  const headers = { ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseJson(res) {
  const text = await res.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = {};
    }
  }
  if (!res.ok) {
    const detail = body.error || (text && text.length < 300 ? text : '');
    const err = new Error(detail || `Request failed (${res.status})`);
    err.status = res.status;
    err.body = body;
    err.conflict = res.status === 409 || body.conflict === true;
    throw err;
  }
  return body;
}

/**
 * Exchange a Firebase ID token for our household API session (JWT).
 * @param {string} idToken
 * @param {'app' | 'admin'} [scope]
 */
export async function syncFirebaseSession(idToken, scope = getAuthScope()) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(apiUrl(`/auth/session`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      signal: controller.signal,
    });
    const data = await parseJson(res);
    if (data.token) setAuthToken(data.token, scope);
    return data;
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Network timeout. Please check your connection or try again.');
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function signup(email, password, scope = getAuthScope()) {
  const { firebaseSignUp, firebaseGetIdToken } = await import('./auth/firebaseAuth.js');
  await firebaseSignUp(email, password);
  const idToken = await firebaseGetIdToken(true);
  if (!idToken) {
    throw new Error('Could not complete sign up. Please try again.');
  }
  return syncFirebaseSession(idToken, scope);
}

export async function login(email, password, scope = getAuthScope()) {
  const { firebaseSignIn, firebaseGetIdToken } = await import('./auth/firebaseAuth.js');
  await firebaseSignIn(email, password);
  const idToken = await firebaseGetIdToken(true);
  if (!idToken) {
    throw new Error('Could not complete sign in. Please try again.');
  }
  return syncFirebaseSession(idToken, scope);
}

export async function sendPasswordResetEmail(email) {
  const { firebaseSendPasswordReset } = await import('./auth/firebaseAuth.js');
  await firebaseSendPasswordReset(email);
}

/**
 * Persist this browser's FCM device token for the signed-in user.
 * @param {string} token
 */
export async function saveFcmToken(token) {
  const res = await fetch(apiUrl(`/auth/save-token`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ token }),
  });
  return parseJson(res);
}

export async function fetchSession(scope = getAuthScope()) {
  ensureAdminTokenSeeded(scope);
  const existingToken = getAuthToken(scope);
  let expiredJwt = false;

  if (existingToken) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(apiUrl(`/auth/me`), {
        headers: authHeaders({}, scope),
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await parseJson(res);
        if (data.token) setAuthToken(data.token, scope);
        return data;
      }
      if (res.status !== 401) {
        throw new Error(`Request failed (${res.status})`);
      }
      setAuthToken('', scope);
      expiredJwt = true;
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw new Error('Network timeout. Please check your connection or try again.');
      }
      throw err;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  // Admin sessions must not be rebuilt from whatever Firebase user the app last used.
  // That would replace the admin JWT when a non-admin signs into the consumer app.
  if (scope === AUTH_SCOPE_ADMIN) return null;

  // No session cookie/JWT: stay logged out without loading Firebase.
  if (!expiredJwt) return null;

  const {
    waitForFirebaseAuth,
    firebaseGetIdToken,
  } = await import('./auth/firebaseAuth.js');

  await waitForFirebaseAuth();
  const idToken = await firebaseGetIdToken();
  if (!idToken) return null;
  try {
    return await syncFirebaseSession(idToken, scope);
  } catch {
    return null;
  }
}

export async function refreshEmailVerificationSession(scope = getAuthScope()) {
  const {
    firebaseReloadUser,
    firebaseGetIdToken,
  } = await import('./auth/firebaseAuth.js');
  const user = await firebaseReloadUser();
  if (!user?.emailVerified) {
    throw new Error('Email not verified yet. Check your inbox and tap the link, then try again.');
  }
  const idToken = await firebaseGetIdToken(true);
  if (!idToken) {
    throw new Error('Could not refresh session. Please sign in again.');
  }
  return syncFirebaseSession(idToken, scope);
}

export async function resendVerificationEmail() {
  const { firebaseResendVerificationEmail } = await import('./auth/firebaseAuth.js');
  await firebaseResendVerificationEmail();
}

export async function createHousehold() {
  const scope = getAuthScope();
  const res = await fetch(apiUrl(`/household/create`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }, scope),
  });
  const data = await parseJson(res);
  if (data.token) setAuthToken(data.token, scope);
  return data;
}

export async function joinHousehold(inviteCode) {
  const scope = getAuthScope();
  const res = await fetch(apiUrl(`/household/join`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }, scope),
    body: JSON.stringify({ inviteCode }),
  });
  const data = await parseJson(res);
  if (data.token) setAuthToken(data.token, scope);
  return data;
}

export async function pingShoppingList(recipientUserIds) {
  const body =
    Array.isArray(recipientUserIds) && recipientUserIds.length > 0
      ? { recipientUserIds }
      : {};
  const res = await fetch(apiUrl(`/household/ping-shopping`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function fetchHouseholdMembers() {
  const res = await fetch(apiUrl(`/household/members`), {
    headers: authHeaders(),
  });
  return parseJson(res);
}

export async function leaveHousehold() {
  const scope = getAuthScope();
  const res = await fetch(apiUrl(`/household/leave`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }, scope),
  });
  const data = await parseJson(res);
  if (data.token) setAuthToken(data.token, scope);
  return data;
}

export async function removeHouseholdMember(userId) {
  const res = await fetch(apiUrl(`/household/members/remove`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId }),
  });
  return parseJson(res);
}

/**
 * Log out of one surface only (app or admin). The other JWT is left intact.
 * @param {{ scope?: 'app' | 'admin' }} [options]
 */
export async function logout(options = {}) {
  const scope = options.scope || getAuthScope();
  setAuthToken('', scope);

  // Only sign out of Firebase when the other surface has no session,
  // so admin can stay logged in while the app switches users.
  const otherScope = scope === AUTH_SCOPE_ADMIN ? AUTH_SCOPE_APP : AUTH_SCOPE_ADMIN;
  if (!getAuthToken(otherScope)) {
    const { firebaseSignOut } = await import('./auth/firebaseAuth.js');
    try {
      await firebaseSignOut();
    } catch {
      // ignore
    }
  }
}

export async function deleteAccount() {
  const scope = getAuthScope();
  const res = await fetch(apiUrl(`/auth/account`), {
    method: 'DELETE',
    headers: authHeaders({}, scope),
  });
  await parseJson(res);
  const { firebaseDeleteCurrentUser } = await import('./auth/firebaseAuth.js');
  try {
    await firebaseDeleteCurrentUser();
  } catch {
    // MongoDB account removed; Firebase user may need re-auth to delete
  }
  setAuthToken('', AUTH_SCOPE_APP);
  setAuthToken('', AUTH_SCOPE_ADMIN);
}

export async function fetchAppState() {
  const householdId = resolveHouseholdIdForCache(getAuthToken());
  try {
    const res = await fetch(apiUrl(`/state`), {
      headers: authHeaders(),
    });
    const state = await parseJson(res);
    const id =
      householdId ||
      resolveHouseholdIdForCache(getAuthToken()) ||
      decodeAuthTokenPayload(getAuthToken())?.householdId;
    if (id) cacheAppStateResponse(String(id), state);
    return { ...state, fromOfflineCache: false };
  } catch (err) {
    if (!isOfflineNetworkError(err)) throw err;
    const id = householdId || resolveHouseholdIdForCache(getAuthToken());
    const cached = id ? readCachedAppState(id) : null;
    if (!cached?.payload) throw err;
    return withOfflineMeta(cached.payload, cached.cachedAt);
  }
}

export async function saveAppState(partial) {
  const res = await fetch(apiUrl(`/state`), {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(partial),
  });
  return parseJson(res);
}

/** POST /api/inventory/sync — revision/409 inventory delta (not PUT /api/state). */
export async function syncInventory(payload) {
  const res = await fetch(apiUrl(`/inventory/sync`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

/** POST /api/inventory/clear-all — wipe inventory and keep a 7-day restore snapshot. */
export async function clearAllInventory() {
  const res = await fetch(apiUrl(`/inventory/clear-all`), {
    method: 'POST',
    headers: authHeaders(),
  });
  return parseJson(res);
}

/** POST /api/inventory/restore-cleared — restore inventory from the active snapshot. */
export async function restoreClearedInventory() {
  const res = await fetch(apiUrl(`/inventory/restore-cleared`), {
    method: 'POST',
    headers: authHeaders(),
  });
  return parseJson(res);
}

export async function searchExternalRecipes(query) {
  const res = await fetch(
    apiUrl(`/recipes/search?q=${encodeURIComponent(query)}`),
    { headers: authHeaders() },
  );
  const data = await parseJson(res);
  return data.meals ?? [];
}

export async function searchRecipesByIngredient(ingredient) {
  const res = await fetch(
    apiUrl(`/recipes/by-ingredient?i=${encodeURIComponent(ingredient)}`),
    { headers: authHeaders() },
  );
  const data = await parseJson(res);
  return data.meals ?? [];
}

export async function lookupExternalRecipe(mealId) {
  const res = await fetch(apiUrl(`/recipes/lookup/${encodeURIComponent(mealId)}`), {
    headers: authHeaders(),
  });
  const data = await parseJson(res);
  return data.meal ?? null;
}

/** POST /api/recipes/ai-match — Gemini-powered recipes from current household inventory. */
export async function fetchAiRecipeMatches({ cravings, quickTag } = {}) {
  const payload = {};
  if (cravings?.trim()) payload.cravings = cravings.trim();
  if (quickTag?.trim()) payload.quickTag = quickTag.trim();

  const res = await fetch(apiUrl(`/recipes/ai-match`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = {};
    }
  }
  if (!res.ok) {
    if (res.status === 504) {
      const err = new Error(
        'AI generation timed out. Please try again — if this keeps happening, check your server timeout settings.',
      );
      err.status = 504;
      throw err;
    }
    const err = new Error(
      body.message || body.error || (text && text.length < 300 ? text : '') || `Request failed (${res.status})`,
    );
    err.status = res.status;
    throw err;
  }
  return body;
}

/** POST /api/recipes/remix — FitChef macro remix of a household library recipe. */
export async function fetchRemixRecipe(recipeId, mode, recipe) {
  const payload = { recipeId, mode };
  if (recipe) payload.recipe = recipe;

  const res = await fetch(apiUrl(`/recipes/remix`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = {};
    }
  }
  if (!res.ok) {
    const err = new Error(
      body.message || body.error || (text && text.length < 300 ? text : '') || `Request failed (${res.status})`,
    );
    err.status = res.status;
    throw err;
  }
  return body;
}

/** POST /api/recipes/chat — Fridge Scout conversational assistant. */
export async function fetchFridgeScoutChat(messages) {
  const res = await fetch(apiUrl(`/recipes/chat`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ messages }),
  });
  const text = await res.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = {};
    }
  }
  if (!res.ok) {
    const err = new Error(
      body.message || body.error || (text && text.length < 300 ? text : '') || `Request failed (${res.status})`,
    );
    err.status = res.status;
    throw err;
  }
  return body;
}

/** @deprecated Use fetchFridgeScoutChat */
export const fetchPantryChefChat = fetchFridgeScoutChat;

/**
 * @param {{ store?: string, category?: string, groupBy?: 'store'|'category' }} [filters]
 */
/**
 * @param {{ store?: string, category?: string, groupBy?: string }} [filters]
 * @param {{ force?: boolean }} [options]
 */
export async function fetchWeeklyDeals(filters = {}, options = {}) {
  const params = new URLSearchParams();
  if (filters.postcode) params.set('postcode', filters.postcode);
  if (filters.store) params.set('store', filters.store);
  if (filters.category) params.set('category', filters.category);
  if (filters.groupBy) params.set('groupBy', filters.groupBy);

  const query = params.toString();
  const cacheKey = `weekly:${query}`;
  if (!options.force) {
    const cached = readDealsCache(cacheKey);
    if (cached?.deals && cached?.cycle?.cycleStart) {
      return cached;
    }
  }

  const res = await fetch(apiUrl(`/deals/weekly${query ? `?${query}` : ''}`), {
    headers: authHeaders(),
  });
  const data = await parseJson(res);
  writeDealsCache(cacheKey, data);
  return data;
}

/**
 * @param {{ postcode?: string }} [options]
 * @param {{ force?: boolean }} [fetchOptions]
 */
export async function fetchStoreCatalogues(options = {}, fetchOptions = {}) {
  const params = new URLSearchParams();
  if (options.postcode) params.set('postcode', options.postcode);

  const query = params.toString();
  const cacheKey = `catalogues:${query}`;
  if (!fetchOptions.force) {
    const cached = readDealsCache(cacheKey);
    if (cached) return cached;
  }

  const res = await fetch(apiUrl(`/deals/catalogues${query ? `?${query}` : ''}`), {
    headers: authHeaders(),
  });
  const data = await parseJson(res);
  writeDealsCache(cacheKey, data);
  return data;
}

const DEALS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const DEALS_CACHE_PREFIX = 'witf:deals-cache:';

function readDealsCache(key) {
  try {
    const raw = sessionStorage.getItem(`${DEALS_CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || Date.now() - parsed.at > DEALS_CACHE_TTL_MS) {
      sessionStorage.removeItem(`${DEALS_CACHE_PREFIX}${key}`);
      return null;
    }
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

function writeDealsCache(key, data) {
  try {
    sessionStorage.setItem(
      `${DEALS_CACHE_PREFIX}${key}`,
      JSON.stringify({ at: Date.now(), data }),
    );
  } catch {
    // sessionStorage may be full or unavailable
  }
}

export async function checkApiHealth() {
  try {
    const res = await fetch(apiUrl(`/health`));
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchInventory() {
  const householdId = resolveHouseholdIdForCache(getAuthToken());
  try {
    const res = await fetch(apiUrl(`/inventory`), { headers: authHeaders() });
    const data = await parseJson(res);
    const id = householdId || resolveHouseholdIdForCache(getAuthToken());
    if (id) cacheInventoryResponse(String(id), data);
    return { ...data, fromOfflineCache: false };
  } catch (err) {
    if (!isOfflineNetworkError(err)) throw err;
    const id = householdId || resolveHouseholdIdForCache(getAuthToken());
    const cached = id ? readCachedInventory(id) : null;
    if (!cached?.payload) throw err;
    return withOfflineMeta(cached.payload, cached.cachedAt);
  }
}

export async function createInventoryItem(payload) {
  const res = await fetch(apiUrl(`/inventory`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function updateInventoryItemApi(id, payload) {
  const res = await fetch(apiUrl(`/inventory/${encodeURIComponent(id)}`), {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function deleteInventoryItemApi(id) {
  const res = await fetch(apiUrl(`/inventory/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return parseJson(res);
}

export async function fetchShoppingList() {
  const householdId = resolveHouseholdIdForCache(getAuthToken());
  try {
    const res = await fetch(apiUrl(`/shopping-list`), { headers: authHeaders() });
    const data = await parseJson(res);
    const id = householdId || resolveHouseholdIdForCache(getAuthToken());
    if (id) cacheShoppingListResponse(String(id), data);
    return { ...data, fromOfflineCache: false };
  } catch (err) {
    if (!isOfflineNetworkError(err)) throw err;
    const id = householdId || resolveHouseholdIdForCache(getAuthToken());
    const cached = id ? readCachedShoppingList(id) : null;
    if (!cached?.payload) throw err;
    return withOfflineMeta(cached.payload, cached.cachedAt);
  }
}

export async function addShoppingListItem(payload) {
  const res = await fetch(apiUrl(`/shopping-list/add`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function addRecipeIngredientsToShoppingList(payload) {
  const res = await fetch(apiUrl(`/shopping-list/add-from-recipe`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function markShoppingItemPurchased(id, options = {}) {
  const res = await fetch(apiUrl(`/shopping-list/mark-purchased`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id, ...options }),
  });
  return parseJson(res);
}

export async function scanReceipt(file) {
  const formData = new FormData();
  formData.append('receipt', file, file.name || 'receipt.jpg');
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 55000);
  try {
    const res = await fetch(apiUrl(`/inventory/scan-receipt`), {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
      signal: controller.signal,
    });
    return parseJson(res);
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Receipt scan timed out. Try a smaller photo or try again in a moment.');
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function confirmReceiptScan(items) {
  const res = await fetch(apiUrl(`/inventory/confirm-receipt-scan`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ items }),
  });
  return parseJson(res);
}

export async function classifyInventoryItem(name, options = {}) {
  const res = await fetch(apiUrl(`/inventory/classify-item`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      name,
      itemType: options.itemType,
      remember: options.remember !== false,
    }),
  });
  return parseJson(res);
}

// —— Support (user-facing) ——

export async function submitUserReport(payload) {
  const res = await fetch(apiUrl('/support/report'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function submitUserFeedback(payload) {
  const res = await fetch(apiUrl('/support/feedback'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

// —— Admin ——

export async function fetchAdminMe() {
  const res = await fetch(apiUrl('/admin/me'), { headers: authHeaders() });
  return parseJson(res);
}

export async function fetchAdminDashboard() {
  const res = await fetch(apiUrl('/admin/dashboard'), { headers: authHeaders() });
  return parseJson(res);
}

export async function fetchAdminDeals(store, verified = false) {
  const params = new URLSearchParams();
  if (store) params.set('store', store);
  params.set('verified', verified ? 'true' : 'false');
  const query = params.toString();
  const res = await fetch(apiUrl(`/admin/deals?${query}`), { headers: authHeaders() });
  return parseJson(res);
}

export async function fetchAdminUnverifiedDeals(store) {
  return fetchAdminDeals(store, false);
}

export async function fetchAdminVerifiedDeals(store) {
  return fetchAdminDeals(store, true);
}

export async function verifyAdminDeal(payload) {
  const res = await fetch(apiUrl('/admin/deals/verify'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function unverifyAdminDeal(payload) {
  const res = await fetch(apiUrl('/admin/deals/unverify'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function createAdminDeal(payload) {
  const res = await fetch(apiUrl('/admin/deals'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function updateAdminDeal(id, payload) {
  const res = await fetch(apiUrl(`/admin/deals/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function deleteAdminDeal(id) {
  const res = await fetch(apiUrl(`/admin/deals/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return parseJson(res);
}

export async function fetchAdminReports(status) {
  const params = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(apiUrl(`/admin/reports${params}`), { headers: authHeaders() });
  return parseJson(res);
}

export async function updateAdminReport(id, patch) {
  const res = await fetch(apiUrl(`/admin/reports/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(patch),
  });
  return parseJson(res);
}

export async function fetchAdminFeedback(status) {
  const params = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(apiUrl(`/admin/feedback${params}`), { headers: authHeaders() });
  return parseJson(res);
}

export async function updateAdminFeedback(id, patch) {
  const res = await fetch(apiUrl(`/admin/feedback/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(patch),
  });
  return parseJson(res);
}

export async function fetchSupportChat(threadId) {
  const params = threadId ? `?threadId=${encodeURIComponent(threadId)}` : '';
  const res = await fetch(apiUrl(`/support/chat${params}`), { headers: authHeaders() });
  return parseJson(res);
}

/** Open the active support chat, or create a new one after a closed conversation. */
export async function startSupportChat() {
  const res = await fetch(apiUrl('/support/chat'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({}),
  });
  return parseJson(res);
}

export async function sendSupportChatMessage(message) {
  const res = await fetch(apiUrl('/support/chat/messages'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ message }),
  });
  return parseJson(res);
}

export async function fetchAdminSupportChats(status) {
  const params = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(apiUrl(`/admin/support-chats${params}`), { headers: authHeaders() });
  return parseJson(res);
}

export async function fetchAdminSupportChat(id) {
  const res = await fetch(apiUrl(`/admin/support-chats/${encodeURIComponent(id)}`), {
    headers: authHeaders(),
  });
  return parseJson(res);
}

export async function replyAdminSupportChat(id, message) {
  const res = await fetch(apiUrl(`/admin/support-chats/${encodeURIComponent(id)}/messages`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ message }),
  });
  return parseJson(res);
}

export async function updateAdminSupportChat(id, patch) {
  const res = await fetch(apiUrl(`/admin/support-chats/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(patch),
  });
  return parseJson(res);
}

export async function closeAdminSupportChat(id) {
  return updateAdminSupportChat(id, { status: 'closed' });
}

export async function fetchAdminRecoveryUser(email) {
  const res = await fetch(
    apiUrl(`/admin/recovery/users?email=${encodeURIComponent(email)}`),
    { headers: authHeaders() },
  );
  return parseJson(res);
}

export async function fetchAdminRecoveryHousehold(query) {
  const res = await fetch(
    apiUrl(`/admin/recovery/households?q=${encodeURIComponent(query)}`),
    { headers: authHeaders() },
  );
  return parseJson(res);
}

export async function postAdminRecoverySendCode({ userId, householdId }) {
  const res = await fetch(apiUrl('/admin/recovery/send-code'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId, householdId }),
  });
  return parseJson(res);
}

export async function postAdminRecoveryConfirmCode({ userId, householdId, code }) {
  const res = await fetch(apiUrl('/admin/recovery/confirm-code'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId, householdId, code }),
  });
  return parseJson(res);
}

export async function postAdminRecoveryRejoin({ userId, householdId, force = false }) {
  const res = await fetch(apiUrl('/admin/recovery/rejoin'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId, householdId, force }),
  });
  return parseJson(res);
}

/** @param {'weekly'|'fortnightly'|'monthly'} [timeframe] */
export async function fetchExpenses(timeframe = 'weekly') {
  const params = new URLSearchParams({ timeframe });
  const res = await fetch(apiUrl(`/expenses?${params}`), { headers: authHeaders() });
  return parseJson(res);
}

/** @param {'weekly'|'fortnightly'|'monthly'} [timeframe] */
export async function fetchExpenseSplit(timeframe = 'weekly') {
  const params = new URLSearchParams({ timeframe });
  const res = await fetch(apiUrl(`/expenses/split?${params}`), { headers: authHeaders() });
  return parseJson(res);
}

/**
 * @param {{
 *   totalAmount: number,
 *   storeName: string,
 *   purchaseDate?: string,
 *   receiptImageUrl?: string|null,
 *   savedToVault?: boolean,
 * }} payload
 */
export async function createExpense(payload) {
  const res = await fetch(apiUrl('/expenses'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function deleteExpense(id) {
  const res = await fetch(apiUrl(`/expenses/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return parseJson(res);
}

export async function fetchDeletedExpenses() {
  const res = await fetch(apiUrl('/expenses/deleted'), { headers: authHeaders() });
  return parseJson(res);
}

export async function restoreExpense(id) {
  const res = await fetch(apiUrl(`/expenses/${encodeURIComponent(id)}/restore`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
  });
  return parseJson(res);
}

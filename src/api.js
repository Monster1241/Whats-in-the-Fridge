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

const TOKEN_KEY = 'fridge.authToken';

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setAuthToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}

function authHeaders(extra = {}) {
  const token = getAuthToken();
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
 */
export async function syncFirebaseSession(idToken) {
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
    if (data.token) setAuthToken(data.token);
    return data;
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Sign-in timed out. Please check your connection and try again.');
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function signup(email, password) {
  const { firebaseSignUp, firebaseGetIdToken } = await import('./auth/firebaseAuth.js');
  await firebaseSignUp(email, password);
  const idToken = await firebaseGetIdToken(true);
  if (!idToken) {
    throw new Error('Could not complete sign up. Please try again.');
  }
  return syncFirebaseSession(idToken);
}

export async function login(email, password) {
  const { firebaseSignIn, firebaseGetIdToken } = await import('./auth/firebaseAuth.js');
  await firebaseSignIn(email, password);
  const idToken = await firebaseGetIdToken(true);
  if (!idToken) {
    throw new Error('Could not complete sign in. Please try again.');
  }
  return syncFirebaseSession(idToken);
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

export async function fetchSession() {
  const existingToken = getAuthToken();
  let expiredJwt = false;

  if (existingToken) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(apiUrl(`/auth/me`), {
        headers: authHeaders(),
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await parseJson(res);
        if (data.token) setAuthToken(data.token);
        return data;
      }
      if (res.status !== 401) {
        throw new Error(`Request failed (${res.status})`);
      }
      setAuthToken('');
      expiredJwt = true;
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw new Error('Could not restore your session in time. Please try again.');
      }
      throw err;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

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
    return await syncFirebaseSession(idToken);
  } catch {
    return null;
  }
}

export async function refreshEmailVerificationSession() {
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
  return syncFirebaseSession(idToken);
}

export async function resendVerificationEmail() {
  const { firebaseResendVerificationEmail } = await import('./auth/firebaseAuth.js');
  await firebaseResendVerificationEmail();
}

export async function createHousehold() {
  const res = await fetch(apiUrl(`/household/create`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
  });
  const data = await parseJson(res);
  if (data.token) setAuthToken(data.token);
  return data;
}

export async function joinHousehold(inviteCode) {
  const res = await fetch(apiUrl(`/household/join`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ inviteCode }),
  });
  const data = await parseJson(res);
  if (data.token) setAuthToken(data.token);
  return data;
}

export async function pingShoppingList() {
  const res = await fetch(apiUrl(`/household/ping-shopping`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
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
  const res = await fetch(apiUrl(`/household/leave`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
  });
  const data = await parseJson(res);
  if (data.token) setAuthToken(data.token);
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

export async function logout() {
  const { firebaseSignOut } = await import('./auth/firebaseAuth.js');
  try {
    await firebaseSignOut();
  } catch {
    // ignore
  }
  setAuthToken('');
}

export async function deleteAccount() {
  const res = await fetch(apiUrl(`/auth/account`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await parseJson(res);
  const { firebaseDeleteCurrentUser } = await import('./auth/firebaseAuth.js');
  try {
    await firebaseDeleteCurrentUser();
  } catch {
    // MongoDB account removed; Firebase user may need re-auth to delete
  }
  setAuthToken('');
}

export async function fetchAppState() {
  const res = await fetch(apiUrl(`/state`), {
    headers: authHeaders(),
  });
  return parseJson(res);
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
  if (filters.store) params.set('store', filters.store);
  if (filters.category) params.set('category', filters.category);
  if (filters.groupBy) params.set('groupBy', filters.groupBy);

  const query = params.toString();
  const cacheKey = `weekly:${query}`;
  if (!options.force) {
    const cached = readDealsCache(cacheKey);
    if (cached) return cached;
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
  const res = await fetch(apiUrl(`/inventory`), { headers: authHeaders() });
  return parseJson(res);
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
  const res = await fetch(apiUrl(`/shopping-list`), { headers: authHeaders() });
  return parseJson(res);
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

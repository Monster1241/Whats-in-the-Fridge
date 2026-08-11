const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
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
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return body;
}

/**
 * Exchange a Firebase ID token for our household API session (JWT).
 * @param {string} idToken
 */
export async function syncFirebaseSession(idToken) {
  const res = await fetch(`${API_BASE}/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const data = await parseJson(res);
  if (data.token) setAuthToken(data.token);
  return data;
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
  const res = await fetch(`${API_BASE}/auth/save-token`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ token }),
  });
  return parseJson(res);
}

export async function fetchSession() {
  const {
    waitForFirebaseAuth,
    firebaseGetIdToken,
  } = await import('./auth/firebaseAuth.js');

  await waitForFirebaseAuth();
  const idToken = await firebaseGetIdToken();
  if (idToken) {
    try {
      return await syncFirebaseSession(idToken);
    } catch (err) {
      const token = getAuthToken();
      if (!token) throw err;
    }
  }

  const token = getAuthToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: authHeaders(),
  });
  if (res.status === 401) {
    setAuthToken('');
    return null;
  }
  const data = await parseJson(res);
  if (data.token) setAuthToken(data.token);
  return data;
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
  const res = await fetch(`${API_BASE}/household/create`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
  });
  const data = await parseJson(res);
  if (data.token) setAuthToken(data.token);
  return data;
}

export async function joinHousehold(inviteCode) {
  const res = await fetch(`${API_BASE}/household/join`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ inviteCode }),
  });
  const data = await parseJson(res);
  if (data.token) setAuthToken(data.token);
  return data;
}

export async function pingShoppingList() {
  const res = await fetch(`${API_BASE}/household/ping-shopping`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
  });
  return parseJson(res);
}

export async function fetchHouseholdMembers() {
  const res = await fetch(`${API_BASE}/household/members`, {
    headers: authHeaders(),
  });
  return parseJson(res);
}

export async function leaveHousehold() {
  const res = await fetch(`${API_BASE}/household/leave`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
  });
  const data = await parseJson(res);
  if (data.token) setAuthToken(data.token);
  return data;
}

export async function removeHouseholdMember(userId) {
  const res = await fetch(`${API_BASE}/household/members/remove`, {
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
  const res = await fetch(`${API_BASE}/auth/account`, {
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
  const res = await fetch(`${API_BASE}/state`, {
    headers: authHeaders(),
  });
  return parseJson(res);
}

export async function saveAppState(partial) {
  const res = await fetch(`${API_BASE}/state`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(partial),
  });
  return parseJson(res);
}

export async function searchExternalRecipes(query) {
  const res = await fetch(
    `${API_BASE}/recipes/search?q=${encodeURIComponent(query)}`,
    { headers: authHeaders() },
  );
  const data = await parseJson(res);
  return data.meals ?? [];
}

export async function searchRecipesByIngredient(ingredient) {
  const res = await fetch(
    `${API_BASE}/recipes/by-ingredient?i=${encodeURIComponent(ingredient)}`,
    { headers: authHeaders() },
  );
  const data = await parseJson(res);
  return data.meals ?? [];
}

export async function lookupExternalRecipe(mealId) {
  const res = await fetch(`${API_BASE}/recipes/lookup/${encodeURIComponent(mealId)}`, {
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

  const res = await fetch(`${API_BASE}/recipes/ai-match`, {
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

  const res = await fetch(`${API_BASE}/recipes/remix`, {
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
  const res = await fetch(`${API_BASE}/recipes/chat`, {
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
export async function fetchWeeklyDeals(filters = {}) {
  const params = new URLSearchParams();
  if (filters.store) params.set('store', filters.store);
  if (filters.category) params.set('category', filters.category);
  if (filters.groupBy) params.set('groupBy', filters.groupBy);

  const query = params.toString();
  const res = await fetch(`${API_BASE}/deals/weekly${query ? `?${query}` : ''}`, {
    headers: authHeaders(),
  });
  return parseJson(res);
}

/**
 * @param {{ postcode?: string }} [options]
 */
export async function fetchStoreCatalogues(options = {}) {
  const params = new URLSearchParams();
  if (options.postcode) params.set('postcode', options.postcode);

  const query = params.toString();
  const res = await fetch(`${API_BASE}/deals/catalogues${query ? `?${query}` : ''}`, {
    headers: authHeaders(),
  });
  return parseJson(res);
}

export async function checkApiHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchInventory() {
  const res = await fetch(`${API_BASE}/inventory`, { headers: authHeaders() });
  return parseJson(res);
}

export async function createInventoryItem(payload) {
  const res = await fetch(`${API_BASE}/inventory`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function updateInventoryItemApi(id, payload) {
  const res = await fetch(`${API_BASE}/inventory/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function deleteInventoryItemApi(id) {
  const res = await fetch(`${API_BASE}/inventory/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return parseJson(res);
}

export async function fetchShoppingList() {
  const res = await fetch(`${API_BASE}/shopping-list`, { headers: authHeaders() });
  return parseJson(res);
}

export async function addShoppingListItem(payload) {
  const res = await fetch(`${API_BASE}/shopping-list/add`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function addRecipeIngredientsToShoppingList(payload) {
  const res = await fetch(`${API_BASE}/shopping-list/add-from-recipe`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function markShoppingItemPurchased(id, options = {}) {
  const res = await fetch(`${API_BASE}/shopping-list/mark-purchased`, {
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
    const res = await fetch(`${API_BASE}/inventory/scan-receipt`, {
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
  const res = await fetch(`${API_BASE}/inventory/confirm-receipt-scan`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ items }),
  });
  return parseJson(res);
}

export async function classifyInventoryItem(name, options = {}) {
  const res = await fetch(`${API_BASE}/inventory/classify-item`, {
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

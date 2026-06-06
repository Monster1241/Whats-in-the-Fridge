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

/**
 * @param {string[]} names
 * @returns {Promise<{ suggestions: Array<{
 *   id: string,
 *   name: string,
 *   itemType: string,
 *   category: string,
 *   prices: Array<{ store: string, label: string, price: number|null }>,
 *   deal: { active: boolean, store: string|null, label: string|null, discountText: string|null, isHalfPrice: boolean, originalPrice: number|null },
 *   lastUpdated: string|null
 * }> }>}
 */
export async function fetchProductSuggestionsByNames(names) {
  const unique = [...new Set(names.map((name) => String(name).trim()).filter(Boolean))];
  if (unique.length === 0) return { suggestions: [] };

  const params = new URLSearchParams({ names: unique.join(',') });
  const res = await fetch(`${API_BASE}/products/autocomplete?${params}`, {
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

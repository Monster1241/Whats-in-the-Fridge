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
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body;
}

export async function signup(email, password) {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJson(res);
  if (data.token) setAuthToken(data.token);
  return data;
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJson(res);
  if (data.token) setAuthToken(data.token);
  return data;
}

export async function fetchSession() {
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

export function logout() {
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

export async function checkApiHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

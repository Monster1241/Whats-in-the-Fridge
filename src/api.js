// Same-origin /api on Vercel (serverless). Override only if API is on another host.
const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const HOUSEHOLD_CODE_KEY = 'fridge.householdCode';

export function getStoredHouseholdCode() {
  try {
    return localStorage.getItem(HOUSEHOLD_CODE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredHouseholdCode(code) {
  try {
    const normalized = String(code || '')
      .trim()
      .toUpperCase();
    if (normalized) {
      localStorage.setItem(HOUSEHOLD_CODE_KEY, normalized);
    } else {
      localStorage.removeItem(HOUSEHOLD_CODE_KEY);
    }
    return normalized;
  } catch {
    return '';
  }
}

function withHouseholdHeaders(headers = {}, code = getStoredHouseholdCode()) {
  const normalized = String(code || '')
    .trim()
    .toUpperCase();
  if (!normalized) return headers;
  return { ...headers, 'X-Household-Code': normalized };
}

export async function fetchAppState() {
  const res = await fetch(`${API_BASE}/state`, {
    headers: withHouseholdHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load data (${res.status})`);
  }
  const state = await res.json();
  if (state?.householdCode) {
    setStoredHouseholdCode(state.householdCode);
  }
  return state;
}

export async function saveAppState(partial) {
  const householdCode = partial?.householdCode || getStoredHouseholdCode();
  const res = await fetch(`${API_BASE}/state`, {
    method: 'PUT',
    headers: withHouseholdHeaders({ 'Content-Type': 'application/json' }, householdCode),
    body: JSON.stringify({ ...partial, householdCode }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to save data (${res.status})`);
  }
  const state = await res.json();
  if (state?.householdCode) {
    setStoredHouseholdCode(state.householdCode);
  }
  return state;
}

export async function checkApiHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

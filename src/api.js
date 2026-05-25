// Same-origin /api on Vercel (serverless). Override only if API is on another host.
const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export async function fetchAppState() {
  const res = await fetch(`${API_BASE}/state`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load data (${res.status})`);
  }
  return res.json();
}

export async function saveAppState(partial) {
  const res = await fetch(`${API_BASE}/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(partial),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to save data (${res.status})`);
  }
  return res.json();
}

export async function checkApiHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

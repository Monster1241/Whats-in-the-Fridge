/** Env vars Vercel serverless can read (not .env — that is local-only). */
const URI_KEYS = ['MONGODB_URI', 'MONGODB_URL', 'DATABASE_URL'];

export function getMongoUri() {
  for (const key of URI_KEYS) {
    const value = process.env[key]?.trim();
    if (value) {
      return { uri: value, source: key };
    }
  }

  if (process.env.VITE_MONGODB_URI?.trim()) {
    return {
      error:
        'VITE_MONGODB_URI is set, but the API needs MONGODB_URI (no VITE_ prefix). In Vercel → Environment Variables, add MONGODB_URI with the same connection string, then Redeploy.',
    };
  }

  return {
    error:
      'MONGODB_URI is not set in this deployment. Vercel → Project → Settings → Environment Variables → add MONGODB_URI for Production, Preview, and Development, then Redeploy (env vars do not apply until you redeploy).',
  };
}

export function getEnvDiagnostics() {
  return {
    hasMongoUri: Boolean(process.env.MONGODB_URI?.trim()),
    hasMongoUrl: Boolean(process.env.MONGODB_URL?.trim()),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL?.trim()),
    hasViteMongoUri: Boolean(process.env.VITE_MONGODB_URI?.trim()),
    vercel: Boolean(process.env.VERCEL),
  };
}

const CAPACITOR_ORIGINS = [
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export function getAllowedOrigins() {
  const configured = (process.env.CORS_ORIGIN || process.env.APP_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set([...configured, ...CAPACITOR_ORIGINS]);
}

export function isOriginAllowed(origin) {
  if (!origin) return true;
  if (getAllowedOrigins().has(origin)) return true;

  // Allow the current Vercel deployment URL automatically.
  if (process.env.VERCEL_URL && origin === `https://${process.env.VERCEL_URL}`) {
    return true;
  }

  // Allow Vercel preview and production subdomains by default.
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) {
    return true;
  }

  // Capacitor / WebView localhost variants (ports, capacitor://, ionic://).
  if (
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
    /^(capacitor|ionic):\/\/localhost$/i.test(origin)
  ) {
    return true;
  }

  return false;
}

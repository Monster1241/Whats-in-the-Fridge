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

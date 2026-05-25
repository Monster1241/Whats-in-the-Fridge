import { connectDb } from './db.js';

export async function ensureDb() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not configured. Add it in Vercel → Settings → Environment Variables (or in your local .env file).',
    );
  }
  return connectDb(uri);
}

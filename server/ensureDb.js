import { connectDb } from './db.js';
import { getMongoUri } from './env.js';

function assertJwtSecret() {
  if (!process.env.JWT_SECRET?.trim()) {
    const err = new Error(
      'JWT_SECRET is not set. Add it to .env locally and Vercel Environment Variables, then redeploy.',
    );
    err.status = 503;
    throw err;
  }
}

export async function ensureDb() {
  assertJwtSecret();
  const resolved = getMongoUri();
  if (resolved.error) {
    const err = new Error(resolved.error);
    err.status = 503;
    throw err;
  }
  try {
    return await connectDb(resolved.uri);
  } catch (err) {
    const message = String(err.message || '');
    if (message.includes('ENOTFOUND') || message.includes('authentication failed')) {
      const friendly = new Error(
        'Cannot connect to MongoDB. Check MONGODB_URI in .env (local) or Vercel environment variables.',
      );
      friendly.status = 503;
      throw friendly;
    }
    throw err;
  }
}

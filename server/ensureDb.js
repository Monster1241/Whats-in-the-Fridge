import { connectDb } from './db.js';
import { getMongoUri } from './env.js';

export async function ensureDb() {
  const resolved = getMongoUri();
  if (resolved.error) {
    throw new Error(resolved.error);
  }
  return connectDb(resolved.uri);
}

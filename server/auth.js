import { createHmac, scryptSync, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
/** OWASP recommends ≥10 bcrypt cost; 12 gives comfortable margin for new passwords. */
const MIN_BCRYPT_ROUNDS = 10;
const BCRYPT_ROUNDS = 12;

if (BCRYPT_ROUNDS < MIN_BCRYPT_ROUNDS) {
  throw new Error(`BCRYPT_ROUNDS must be at least ${MIN_BCRYPT_ROUNDS}.`);
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error(
      'JWT_SECRET is not set. Add it to .env locally and Vercel Environment Variables.',
    );
  }
  return secret;
}

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export async function hashPassword(password) {
  return bcrypt.hash(String(password), BCRYPT_ROUNDS);
}

function verifyLegacyScrypt(password, stored) {
  const [saltHex, hashHex] = String(stored).split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(String(password), salt, 64);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export async function verifyPassword(password, stored) {
  if (!stored) return false;
  const hash = String(stored);
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    return bcrypt.compare(String(password), hash);
  }
  return verifyLegacyScrypt(password, hash);
}

export function signToken(payload) {
  const secret = getJwtSecret();
  const body = {
    ...payload,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encoded = toBase64Url(JSON.stringify(body));
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyToken(token) {
  if (!token) return null;
  try {
    const secret = getJwtSecret();
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return null;
    const expected = createHmac('sha256', secret).update(encoded).digest('base64url');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const payload = JSON.parse(fromBase64Url(encoded));
    if (!payload?.exp || Date.now() > payload.exp) return null;
    if (!payload.userId) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getBearerUser(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header || typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return verifyToken(match[1]);
}

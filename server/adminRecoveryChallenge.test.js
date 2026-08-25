import { afterEach, describe, expect, it } from 'vitest';
import {
  generateRecoveryCode,
  hashRecoveryCode,
} from './adminRecoveryChallenge.js';

describe('adminRecoveryChallenge', () => {
  const prevSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevSecret;
  });

  it('generates a 6-digit code', () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('hashes codes stably with JWT_SECRET', () => {
    process.env.JWT_SECRET = 'test-secret-for-recovery';
    const a = hashRecoveryCode('123456');
    const b = hashRecoveryCode('123456');
    const c = hashRecoveryCode('654321');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});

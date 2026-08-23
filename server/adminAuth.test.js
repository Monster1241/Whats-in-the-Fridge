import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { getAdminEmails, isAdminEmail } from './adminAuth.js';

describe('adminAuth', () => {
  const prev = process.env.ADMIN_EMAILS;

  afterEach(() => {
    if (prev === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = prev;
  });

  it('parses ADMIN_EMAILS allowlist', () => {
    process.env.ADMIN_EMAILS = ' Admin@Example.com , other@test.com ';
    expect(getAdminEmails()).toEqual(['admin@example.com', 'other@test.com']);
    expect(isAdminEmail('admin@example.com')).toBe(true);
    expect(isAdminEmail('nope@test.com')).toBe(false);
  });

  it('denies everyone when allowlist is empty', () => {
    process.env.ADMIN_EMAILS = '';
    expect(isAdminEmail('admin@example.com')).toBe(false);
  });
});

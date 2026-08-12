import { describe, expect, it } from 'vitest';
import { generateInviteCode, normalizeInviteCode } from './db.js';

describe('generateInviteCode', () => {
  it('uses AAAA-9999 alphabet without ambiguous characters', () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789]{4}$/);
    expect(code).not.toMatch(/[IO01]/);
  });
});

describe('normalizeInviteCode', () => {
  it('still accepts legacy XYZ-123 codes', () => {
    expect(normalizeInviteCode(' xyz-123 ')).toBe('XYZ-123');
  });

  it('normalizes new WXYZ-2345 codes', () => {
    expect(normalizeInviteCode('wxyz-2345')).toBe('WXYZ-2345');
  });
});

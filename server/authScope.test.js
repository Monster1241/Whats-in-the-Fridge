import { describe, expect, it } from 'vitest';
import { assertScopedHouseholdId } from './db.js';

describe('assertScopedHouseholdId', () => {
  it('accepts a valid ObjectId string', () => {
    expect(assertScopedHouseholdId('507f1f77bcf86cd799439011')).toBe('507f1f77bcf86cd799439011');
  });

  it('trims whitespace', () => {
    expect(assertScopedHouseholdId('  507f1f77bcf86cd799439011  ')).toBe('507f1f77bcf86cd799439011');
  });

  it('rejects missing or malformed ids', () => {
    for (const value of [null, undefined, '', '   ', 'not-an-id', '123']) {
      expect(() => assertScopedHouseholdId(value)).toThrow('Invalid household scope.');
    }
  });
});

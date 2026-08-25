import { describe, expect, it } from 'vitest';
import {
  findExpiredItems,
  findExpiringSoonItems,
  isExpiredInventoryItem,
} from './expiryAlerts.js';

function isoDaysFromToday(offset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

describe('expiryAlerts', () => {
  it('detects expired inventory items', () => {
    const item = { expiryDate: isoDaysFromToday(-1), status: 'Plentiful', itemType: 'Food' };
    expect(isExpiredInventoryItem(item)).toBe(true);
    expect(findExpiredItems([item])).toHaveLength(1);
    expect(findExpiringSoonItems([item])).toHaveLength(0);
  });

  it('detects expiring soon items but not expired ones', () => {
    const soon = { id: 'a', expiryDate: isoDaysFromToday(2), status: 'Plentiful', itemType: 'Food' };
    const expired = { id: 'b', expiryDate: isoDaysFromToday(-2), status: 'Plentiful', itemType: 'Food' };
    expect(findExpiringSoonItems([soon, expired])).toEqual([soon]);
    expect(findExpiredItems([soon, expired])).toEqual([expired]);
  });

  it('ignores out-of-stock and non-food items', () => {
    const out = { expiryDate: isoDaysFromToday(-1), status: 'out', itemType: 'Food' };
    const supply = { expiryDate: isoDaysFromToday(-1), status: 'Plentiful', itemType: 'Home Essentials' };
    expect(findExpiredItems([out, supply])).toHaveLength(0);
  });
});

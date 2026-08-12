import { describe, expect, it } from 'vitest';
import { sanitizeInventoryItemInput, sanitizeInventoryItems } from './inventorySanitize.js';

describe('sanitizeInventoryItems', () => {
  it('merges same name + itemType and sums quantity', () => {
    const merged = sanitizeInventoryItems([
      {
        id: 'a',
        name: 'Tomato paste (400g)',
        itemType: 'Food',
        category: 'Ambient',
        status: 'fresh',
        quantity: 1,
        unit: '',
      },
      {
        id: 'b',
        name: 'Tomato paste (400g)',
        itemType: 'Food',
        category: 'Ambient',
        status: 'out',
        quantity: 1,
        unit: '',
      },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('a');
    expect(merged[0].status).toBe('fresh');
    expect(merged[0].quantity).toBeGreaterThanOrEqual(400);
    expect(merged[0].unit).toBe('g');
  });

  it('drops blank names', () => {
    expect(sanitizeInventoryItems([{ id: 'x', name: '   ', itemType: 'Food' }])).toEqual([]);
  });
});

describe('sanitizeInventoryItemInput', () => {
  it('returns a single sanitized item or null', () => {
    expect(sanitizeInventoryItemInput({ name: '' })).toBeNull();
    const item = sanitizeInventoryItemInput({
      id: 'milk-1',
      name: 'Milk',
      itemType: 'Food',
      category: 'Fresh',
      status: 'fresh',
      quantity: 2,
      unit: 'L',
    });
    expect(item?.name).toBe('Milk');
    expect(item?.status).toBe('fresh');
  });
});

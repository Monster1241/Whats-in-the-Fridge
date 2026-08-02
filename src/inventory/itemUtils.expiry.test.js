import { describe, expect, it } from 'vitest';
import { STATUS } from './constants.js';
import {
  dedupeInventoryItems,
  markItemBoughtFromShopping,
  markItemOnShoppingList,
} from './itemUtils.js';

const BASE_ITEM = {
  id: '1',
  name: 'Milk',
  itemType: 'Food',
  category: 'Fresh',
  status: STATUS.FRESH,
  expiryDate: '2026-08-10',
  stockedAt: '2026-08-01T00:00:00.000Z',
  createdAt: '2026-08-01T00:00:00.000Z',
};

describe('step 1 — expiry on restock', () => {
  it('clears expiry when moving to shopping list', () => {
    const result = markItemOnShoppingList(BASE_ITEM);
    expect(result.status).toBe(STATUS.OUT);
    expect(result.expiryDate).toBeNull();
    expect(result.name).toBe('Milk');
  });

  it('clears expiry and marks fresh when bought from shopping', () => {
    const shopping = markItemOnShoppingList(BASE_ITEM);
    const result = markItemBoughtFromShopping(shopping, '2026-08-02T12:00:00.000Z');
    expect(result.status).toBe(STATUS.FRESH);
    expect(result.expiryDate).toBeNull();
    expect(result.stockedAt).toBe('2026-08-02T12:00:00.000Z');
    expect(result.createdAt).toBe('2026-08-02T12:00:00.000Z');
  });

  it('drops expiry when merging duplicates onto shopping list', () => {
    const inStock = { ...BASE_ITEM, id: 'a', expiryDate: '2026-08-15' };
    const onList = {
      ...BASE_ITEM,
      id: 'b',
      status: STATUS.OUT,
      expiryDate: '2026-08-20',
    };
    const merged = dedupeInventoryItems([inStock, onList]);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe(STATUS.OUT);
    expect(merged[0].expiryDate).toBeNull();
  });

  it('keeps an expiry when merging two in-stock duplicates', () => {
    const a = { ...BASE_ITEM, id: 'a', expiryDate: '2026-08-20' };
    const b = { ...BASE_ITEM, id: 'b', expiryDate: '2026-08-10' };
    const merged = dedupeInventoryItems([a, b]);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe(STATUS.FRESH);
    expect(merged[0].expiryDate).toBeTruthy();
  });
});

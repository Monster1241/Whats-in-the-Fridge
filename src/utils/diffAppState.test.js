import { describe, expect, it } from 'vitest';
import {
  applyInventoryDeltaLocal,
  buildInventorySyncPayload,
  buildStateSavePayload,
  diffAppState,
  diffInventoryItems,
} from './diffAppState.js';

const milk = {
  id: 'milk-1',
  name: 'Milk',
  itemType: 'Food',
  category: 'Fresh',
  status: 'fresh',
  quantity: 1,
  unit: 'L',
};

const bread = {
  id: 'bread-1',
  name: 'Bread',
  itemType: 'Food',
  category: 'Ambient',
  status: 'out',
  quantity: 1,
  unit: '',
};

describe('diffInventoryItems', () => {
  it('detects upserts and deletes', () => {
    const delta = diffInventoryItems([milk, bread], [{ ...milk, quantity: 2 }]);
    expect(delta.deletedIds).toEqual(['bread-1']);
    expect(delta.upserts).toHaveLength(1);
    expect(delta.upserts[0].quantity).toBe(2);
  });

  it('returns empty delta when items match', () => {
    const delta = diffInventoryItems([milk], [{ ...milk }]);
    expect(delta.upserts).toEqual([]);
    expect(delta.deletedIds).toEqual([]);
  });
});

describe('diffAppState / buildStateSavePayload', () => {
  it('diffs household meta without inventory', () => {
    const prev = {
      settings: { theme: 'light', user: { name: 'A', email: '' } },
      savedRecipeIds: [],
      recipeLibrary: [],
      onboarding: { dismissed: [] },
      restockHistory: [],
      itemKnowledge: [],
      usageInsights: { events: {} },
    };
    const next = {
      ...prev,
      settings: { theme: 'dark', user: { name: 'A', email: '' } },
    };
    expect(diffAppState(prev, next)).toEqual({
      settings: next.settings,
    });
    expect(buildStateSavePayload(prev, next)).toEqual({ settings: next.settings });
    expect(buildStateSavePayload(prev, next).inventoryDelta).toBeUndefined();
  });
});

describe('buildInventorySyncPayload', () => {
  it('returns null when inventory is unchanged', () => {
    expect(buildInventorySyncPayload({ items: [milk] }, { items: [{ ...milk }] })).toBeNull();
  });

  it('includes revision with upserts', () => {
    const payload = buildInventorySyncPayload(
      { items: [milk] },
      { items: [{ ...milk, status: 'out' }] },
      7,
    );
    expect(payload.inventoryRevision).toBe(7);
    expect(payload.inventoryDelta.upserts[0].status).toBe('out');
  });
});

describe('applyInventoryDeltaLocal', () => {
  it('applies upserts and deletes without wiping other items', () => {
    const next = applyInventoryDeltaLocal(
      [milk, bread],
      { upserts: [{ ...milk, isLow: true }], deletedIds: ['bread-1'] },
    );
    expect(next).toHaveLength(1);
    expect(next[0].isLow).toBe(true);
  });
});

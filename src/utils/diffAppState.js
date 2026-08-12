const STATE_KEYS = [
  'settings',
  'savedRecipeIds',
  'recipeLibrary',
  'onboarding',
  'restockHistory',
  'itemKnowledge',
  'usageInsights',
];

function itemFingerprint(item) {
  if (!item) return '';
  return JSON.stringify({
    id: item.id ?? null,
    name: item.name ?? null,
    itemType: item.itemType ?? null,
    category: item.category ?? null,
    subCategory: item.subCategory ?? null,
    status: item.status ?? null,
    expiryDate: item.expiryDate ?? null,
    preferredStore: item.preferredStore ?? null,
    consumptionDuration: item.consumptionDuration ?? null,
    consumptionLearned: item.consumptionLearned === true,
    stockedAt: item.stockedAt ?? null,
    quantity: item.quantity ?? 1,
    unit: item.unit ?? '',
    foodGroup: item.foodGroup ?? null,
    storageLocation: item.storageLocation ?? null,
    isLow: Boolean(item.isLow),
    checked: Boolean(item.checked),
    sourceRecipe: item.sourceRecipe ?? null,
  });
}

/**
 * @param {Record<string, unknown>} state
 */
export function toApiStateSnapshot(state) {
  return {
    items: state.items,
    settings: state.settings,
    savedRecipeIds: state.savedIds ?? state.savedRecipeIds,
    recipeLibrary: state.recipeLibrary,
    onboarding: state.onboarding,
    restockHistory: state.restockHistory,
    itemKnowledge: state.itemKnowledge,
    usageInsights: state.usageInsights,
    inventoryRevision: Number(state.inventoryRevision ?? 0),
  };
}

/**
 * @param {Array<Record<string, unknown>>|null|undefined} prevItems
 * @param {Array<Record<string, unknown>>|null|undefined} nextItems
 */
export function diffInventoryItems(prevItems, nextItems) {
  const prevById = new Map((prevItems ?? []).map((item) => [String(item.id), item]));
  const nextById = new Map((nextItems ?? []).map((item) => [String(item.id), item]));
  const upserts = [];
  const deletedIds = [];

  for (const [id, item] of nextById) {
    const prev = prevById.get(id);
    if (!prev || itemFingerprint(prev) !== itemFingerprint(item)) {
      upserts.push(item);
    }
  }
  for (const id of prevById.keys()) {
    if (!nextById.has(id)) deletedIds.push(id);
  }
  return { upserts, deletedIds };
}

/**
 * @param {Record<string, unknown>|null|undefined} prev
 * @param {Record<string, unknown>} next
 */
export function diffAppState(prev, next) {
  const partial = {};
  for (const key of STATE_KEYS) {
    if (JSON.stringify(prev?.[key] ?? null) !== JSON.stringify(next[key] ?? null)) {
      partial[key] = next[key];
    }
  }
  return partial;
}

/**
 * Household meta only — inventory writes go through item APIs.
 * @param {Record<string, unknown>|null|undefined} prev
 * @param {Record<string, unknown>} next
 */
export function buildStateSavePayload(prev, next) {
  return diffAppState(prev, next);
}

/**
 * @param {Record<string, unknown>|null|undefined} prev
 * @param {Record<string, unknown>} next
 * @param {number} [inventoryRevision]
 * @returns {{ inventoryDelta: { upserts: unknown[], deletedIds: string[] }, inventoryRevision: number }|null}
 */
export function buildInventorySyncPayload(prev, next, inventoryRevision = 0) {
  const delta = diffInventoryItems(prev?.items, next?.items);
  if (!delta.upserts.length && !delta.deletedIds.length) return null;
  return {
    inventoryDelta: delta,
    inventoryRevision: Number(inventoryRevision) || 0,
  };
}

/**
 * @param {Array<Record<string, unknown>>} serverItems
 * @param {{ upserts?: Array<Record<string, unknown>>, deletedIds?: string[] }} delta
 */
export function applyInventoryDeltaLocal(serverItems, delta) {
  const byId = new Map((serverItems ?? []).map((item) => [String(item.id), item]));
  for (const id of delta?.deletedIds ?? []) byId.delete(String(id));
  for (const item of delta?.upserts ?? []) {
    if (item?.id) byId.set(String(item.id), item);
  }
  return [...byId.values()];
}

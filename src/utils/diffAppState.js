const STATE_KEYS = [
  'items',
  'settings',
  'savedRecipeIds',
  'recipeLibrary',
  'onboarding',
  'restockHistory',
  'itemKnowledge',
  'usageInsights',
];

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
  };
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

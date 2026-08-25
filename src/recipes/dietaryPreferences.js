export const DIETARY_PREFERENCE = {
  NONE: 'none',
  VEGETARIAN: 'vegetarian',
  VEGAN: 'vegan',
};

export const DIETARY_PREFERENCE_OPTIONS = [
  {
    value: DIETARY_PREFERENCE.NONE,
    label: 'No restriction',
    shortLabel: 'No restriction',
    description: 'AI can suggest any ingredients that match your inventory.',
  },
  {
    value: DIETARY_PREFERENCE.VEGETARIAN,
    label: 'Vegetarian',
    shortLabel: 'Vegetarian',
    description: 'No meat, poultry, fish, or seafood. Eggs and dairy are fine.',
  },
  {
    value: DIETARY_PREFERENCE.VEGAN,
    label: 'Vegan',
    shortLabel: 'Vegan',
    description: 'No animal products — including meat, dairy, eggs, and honey.',
  },
];

/** @param {unknown} value */
export function normalizeDietaryPreference(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (normalized === DIETARY_PREFERENCE.VEGETARIAN) return DIETARY_PREFERENCE.VEGETARIAN;
  if (normalized === DIETARY_PREFERENCE.VEGAN) return DIETARY_PREFERENCE.VEGAN;
  return DIETARY_PREFERENCE.NONE;
}

/** @param {unknown} preference */
export function isDietaryPreferenceActive(preference) {
  return normalizeDietaryPreference(preference) !== DIETARY_PREFERENCE.NONE;
}

/** @param {unknown} preference */
export function getDietaryPreferenceLabel(preference) {
  const normalized = normalizeDietaryPreference(preference);
  return (
    DIETARY_PREFERENCE_OPTIONS.find((option) => option.value === normalized)?.label ??
    DIETARY_PREFERENCE_OPTIONS[0].label
  );
}

/** @param {unknown} preference */
export function getDietaryPreferenceModeLabel(preference) {
  const normalized = normalizeDietaryPreference(preference);
  if (normalized === DIETARY_PREFERENCE.VEGETARIAN) return 'Vegetarian mode';
  if (normalized === DIETARY_PREFERENCE.VEGAN) return 'Vegan mode';
  return '';
}

/** @param {unknown} preference */
export function buildDietaryPromptInstructions(preference) {
  switch (normalizeDietaryPreference(preference)) {
    case DIETARY_PREFERENCE.VEGETARIAN:
      return [
        'Household dietary preference: VEGETARIAN.',
        'Every recipe and suggestion must be vegetarian — no meat, poultry, fish, or seafood.',
        'Do not use meat stock, fish sauce, gelatin, or rennet. Use vegetable stock or plant-based alternatives instead.',
        'Eggs and dairy are allowed.',
        'Add "Vegetarian" to the tags array for each generated recipe.',
      ].join(' ');
    case DIETARY_PREFERENCE.VEGAN:
      return [
        'Household dietary preference: VEGAN.',
        'Every recipe and suggestion must be fully vegan — no meat, poultry, fish, seafood, dairy, eggs, honey, or other animal products.',
        'Do not use meat stock, fish sauce, gelatin, Worcestershire sauce, or honey. Use plant-based alternatives instead.',
        'When inventory includes non-vegan items, suggest plant-based swaps rather than using those items.',
        'Add "Vegan" to the tags array for each generated recipe.',
      ].join(' ');
    default:
      return '';
  }
}

/** @param {string} mode @param {unknown} preference */
export function getRemixModeInstruction(mode, preference) {
  const dietary = normalizeDietaryPreference(preference);
  switch (mode) {
    case 'higher_protein':
      if (dietary === DIETARY_PREFERENCE.VEGAN) {
        return 'Remix for HIGHER PROTEIN (vegan): increase protein with plant-based sources such as tofu, tempeh, legumes, lentils, nuts, seeds, or nutritional yeast while maintaining taste. Update macros accordingly. Add "High Protein" and "Vegan" to tags.';
      }
      if (dietary === DIETARY_PREFERENCE.VEGETARIAN) {
        return 'Remix for HIGHER PROTEIN (vegetarian): increase protein with eggs, dairy, legumes, tofu, or tempeh while maintaining taste. Do not add meat, poultry, fish, or seafood. Update macros accordingly. Add "High Protein" and "Vegetarian" to tags.';
      }
      return 'Remix for HIGHER PROTEIN: increase protein by adjusting quantities or substituting ingredients (e.g. Greek yogurt, extra lean meat, legumes, tofu) while maintaining taste. Update macros accordingly. Add "High Protein" to tags.';
    case 'lower_calorie':
      return 'Remix for LOWER CALORIE: swap high-calorie items for lighter alternatives (e.g. reduce oil/cream, use lean proteins, more vegetables). Update calories and macros. Add "Lower Calorie" to tags.';
    case 'quick_speed':
      return 'Remix for QUICK SPEED: simplify preparation steps and cooking techniques to reduce total prep + cook time. Add "Under 15 Mins" or similar to tags if applicable.';
    default:
      return 'Improve the recipe while keeping it practical.';
  }
}

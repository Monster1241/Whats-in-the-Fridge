export const DIETARY_PREFERENCE = {
  NONE: 'none',
  GLUTEN_FREE: 'gluten_free',
  DAIRY_FREE: 'dairy_free',
  NUT_FREE: 'nut_free',
  NO_BEEF: 'no_beef',
  PESCATARIAN: 'pescatarian',
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
    value: DIETARY_PREFERENCE.GLUTEN_FREE,
    label: 'Gluten free',
    shortLabel: 'Gluten free',
    description: 'No wheat, barley, rye, or gluten-containing ingredients. Use GF swaps for pasta, bread, soy sauce, and flour.',
  },
  {
    value: DIETARY_PREFERENCE.DAIRY_FREE,
    label: 'Dairy free',
    shortLabel: 'Dairy free',
    description: 'No milk, cheese, butter, cream, yoghurt, or whey. Plant-based milks and oils are fine.',
  },
  {
    value: DIETARY_PREFERENCE.NUT_FREE,
    label: 'Nut free',
    shortLabel: 'Nut free',
    description: 'No tree nuts or peanuts (including peanut oil, almond meal, pesto with nuts, etc.). Seeds may be OK unless severe allergy.',
  },
  {
    value: DIETARY_PREFERENCE.NO_BEEF,
    label: 'No beef',
    shortLabel: 'No beef',
    description: 'No beef or veal. Chicken, pork, lamb, fish, and plant-based options are fine.',
  },
  {
    value: DIETARY_PREFERENCE.PESCATARIAN,
    label: 'Pescatarian',
    shortLabel: 'Pescatarian',
    description: 'Fish and seafood are fine. No meat or poultry (including stock made from them).',
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

const ALIAS_MAP = {
  none: DIETARY_PREFERENCE.NONE,
  gluten_free: DIETARY_PREFERENCE.GLUTEN_FREE,
  glutenfree: DIETARY_PREFERENCE.GLUTEN_FREE,
  gf: DIETARY_PREFERENCE.GLUTEN_FREE,
  dairy_free: DIETARY_PREFERENCE.DAIRY_FREE,
  dairyfree: DIETARY_PREFERENCE.DAIRY_FREE,
  lactose_free: DIETARY_PREFERENCE.DAIRY_FREE,
  nut_free: DIETARY_PREFERENCE.NUT_FREE,
  nutfree: DIETARY_PREFERENCE.NUT_FREE,
  no_beef: DIETARY_PREFERENCE.NO_BEEF,
  nobeef: DIETARY_PREFERENCE.NO_BEEF,
  pescatarian: DIETARY_PREFERENCE.PESCATARIAN,
  pescetarian: DIETARY_PREFERENCE.PESCATARIAN,
  vegetarian: DIETARY_PREFERENCE.VEGETARIAN,
  vegan: DIETARY_PREFERENCE.VEGAN,
};

/** @param {unknown} value */
export function normalizeDietaryPreference(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return ALIAS_MAP[normalized] ?? DIETARY_PREFERENCE.NONE;
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
  const option = DIETARY_PREFERENCE_OPTIONS.find(
    (entry) => entry.value === normalizeDietaryPreference(preference),
  );
  if (!option || option.value === DIETARY_PREFERENCE.NONE) return '';
  return `${option.shortLabel} mode`;
}

/** @param {unknown} preference */
export function buildDietaryPromptInstructions(preference) {
  switch (normalizeDietaryPreference(preference)) {
    case DIETARY_PREFERENCE.GLUTEN_FREE:
      return [
        'Household dietary preference: GLUTEN FREE.',
        'Every recipe and suggestion must avoid gluten — no wheat, barley, rye, spelt, or standard flour, bread, pasta, couscous, seitan, or regular soy sauce unless explicitly gluten-free.',
        'Use rice, potatoes, corn, quinoa, GF pasta/flour, tamari (GF soy sauce), and naturally GF ingredients.',
        'If inventory includes gluten items, suggest a GF swap rather than using them.',
        'Add "Gluten Free" to the tags array for each generated recipe.',
      ].join(' ');
    case DIETARY_PREFERENCE.DAIRY_FREE:
      return [
        'Household dietary preference: DAIRY FREE.',
        'Every recipe and suggestion must avoid dairy — no milk, cheese, butter, cream, yoghurt, whey, or ghee.',
        'Use plant milks, dairy-free margarine or oil, and nutritional yeast where helpful.',
        'If inventory includes dairy, suggest a dairy-free swap rather than using it.',
        'Add "Dairy Free" to the tags array for each generated recipe.',
      ].join(' ');
    case DIETARY_PREFERENCE.NUT_FREE:
      return [
        'Household dietary preference: NUT FREE.',
        'Every recipe and suggestion must avoid tree nuts and peanuts — including peanut butter, almond meal, pesto with pine nuts, nut oils, and praline.',
        'Be cautious with hidden nuts in sauces and desserts. Seeds (e.g. sesame, sunflower) are generally OK unless the user indicates a broader allergy.',
        'If inventory includes nuts, suggest a nut-free swap rather than using them.',
        'Add "Nut Free" to the tags array for each generated recipe.',
      ].join(' ');
    case DIETARY_PREFERENCE.NO_BEEF:
      return [
        'Household dietary preference: NO BEEF.',
        'Every recipe and suggestion must avoid beef and veal (including mince, steak, brisket, ox tongue, and beef stock/broth).',
        'Chicken, turkey, pork, lamb, fish, seafood, eggs, dairy, and plant-based proteins are allowed.',
        'If inventory includes beef, suggest a non-beef swap rather than using it.',
        'Add "No Beef" to the tags array for each generated recipe.',
      ].join(' ');
    case DIETARY_PREFERENCE.PESCATARIAN:
      return [
        'Household dietary preference: PESCATARIAN.',
        'Every recipe and suggestion may include fish and seafood, but no meat or poultry.',
        'Do not use chicken, beef, pork, lamb stock, or gelatin from meat. Fish sauce and seafood stock are allowed.',
        'Eggs and dairy are allowed.',
        'Add "Pescatarian" to the tags array for each generated recipe.',
      ].join(' ');
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
      if (dietary === DIETARY_PREFERENCE.PESCATARIAN) {
        return 'Remix for HIGHER PROTEIN (pescatarian): increase protein with fish, seafood, eggs, dairy, legumes, or tofu while maintaining taste. Do not add meat or poultry. Update macros accordingly. Add "High Protein" and "Pescatarian" to tags.';
      }
      if (dietary === DIETARY_PREFERENCE.NO_BEEF) {
        return 'Remix for HIGHER PROTEIN (no beef): increase protein with chicken, turkey, pork, lamb, fish, eggs, dairy, legumes, or tofu while maintaining taste. Do not use beef or veal. Update macros accordingly. Add "High Protein" and "No Beef" to tags.';
      }
      if (dietary === DIETARY_PREFERENCE.NUT_FREE) {
        return 'Remix for HIGHER PROTEIN (nut free): increase protein with eggs, dairy, legumes, tofu, tempeh, seeds, or lean meat/fish while maintaining taste. Do not use nuts or peanuts. Update macros accordingly. Add "High Protein" and "Nut Free" to tags.';
      }
      if (dietary === DIETARY_PREFERENCE.DAIRY_FREE) {
        return 'Remix for HIGHER PROTEIN (dairy free): increase protein with lean meat, fish, eggs, legumes, tofu, or tempeh while maintaining taste. Do not use dairy. Update macros accordingly. Add "High Protein" and "Dairy Free" to tags.';
      }
      if (dietary === DIETARY_PREFERENCE.GLUTEN_FREE) {
        return 'Remix for HIGHER PROTEIN (gluten free): increase protein with meat, fish, eggs, dairy, legumes, or tofu while maintaining taste. Stay gluten free — no wheat flour or regular pasta. Update macros accordingly. Add "High Protein" and "Gluten Free" to tags.';
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

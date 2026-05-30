export const ITEM_TYPE = {
  FOOD: 'Food',
  HOUSEHOLD: 'Household',
};

export const FOOD_CATEGORY = {
  AMBIENT: 'Ambient',
  FRESH: 'Fresh',
  FREEZER: 'Freezer',
};

export const HOUSEHOLD_CATEGORY = {
  CLEANING: 'Cleaning',
  LAUNDRY: 'Laundry',
  BATHROOM: 'Bathroom',
};

export const FOOD_CATEGORY_OPTIONS = [
  FOOD_CATEGORY.AMBIENT,
  FOOD_CATEGORY.FRESH,
  FOOD_CATEGORY.FREEZER,
];

export const HOUSEHOLD_CATEGORY_OPTIONS = [
  HOUSEHOLD_CATEGORY.CLEANING,
  HOUSEHOLD_CATEGORY.LAUNDRY,
  HOUSEHOLD_CATEGORY.BATHROOM,
];

/** @deprecated use FOOD_CATEGORY — kept for gradual refactors */
export const CATEGORY = FOOD_CATEGORY;

export const FOOD_CATEGORY_META = {
  [FOOD_CATEGORY.AMBIENT]: {
    emoji: '🧺',
    label: 'Ambient',
    subtitle: 'Pantry items',
    tabActive: 'bg-amber-600 text-white',
    tabIdle: 'text-amber-700 hover:bg-amber-50',
  },
  [FOOD_CATEGORY.FRESH]: {
    emoji: '🧊',
    label: 'Fresh',
    subtitle: 'Fridge items',
    tabActive: 'bg-sky-600 text-white',
    tabIdle: 'text-sky-700 hover:bg-sky-50',
  },
  [FOOD_CATEGORY.FREEZER]: {
    emoji: '❄️',
    label: 'Freezer',
    subtitle: 'Frozen items',
    tabActive: 'bg-cyan-600 text-white',
    tabIdle: 'text-cyan-700 hover:bg-cyan-50',
  },
};

export const HOUSEHOLD_CATEGORY_META = {
  [HOUSEHOLD_CATEGORY.CLEANING]: {
    emoji: '🧴',
    label: 'Cleaning',
    subtitle: 'Kitchen & home',
    tabActive: 'bg-teal-600 text-white',
    tabIdle: 'text-teal-700 hover:bg-teal-50',
  },
  [HOUSEHOLD_CATEGORY.LAUNDRY]: {
    emoji: '🧺',
    label: 'Laundry',
    subtitle: 'Wash & dry',
    tabActive: 'bg-indigo-600 text-white',
    tabIdle: 'text-indigo-700 hover:bg-indigo-50',
  },
  [HOUSEHOLD_CATEGORY.BATHROOM]: {
    emoji: '🛁',
    label: 'Bathroom',
    subtitle: 'Personal care',
    tabActive: 'bg-violet-600 text-white',
    tabIdle: 'text-violet-700 hover:bg-violet-50',
  },
};

export const INVENTORY_VIEW = {
  ...FOOD_CATEGORY,
  ...HOUSEHOLD_CATEGORY,
  SHOPPING: 'shopping',
};

export const STATUS = {
  FRESH: 'fresh',
  EXPIRING: 'expiring',
  OUT: 'out',
};

export function getCategoriesForItemType(itemType) {
  return itemType === ITEM_TYPE.HOUSEHOLD ? HOUSEHOLD_CATEGORY_OPTIONS : FOOD_CATEGORY_OPTIONS;
}

export function getCategoryMeta(category, itemType = ITEM_TYPE.FOOD) {
  if (itemType === ITEM_TYPE.HOUSEHOLD) {
    return HOUSEHOLD_CATEGORY_META[category] ?? null;
  }
  return FOOD_CATEGORY_META[category] ?? null;
}

export function inferItemTypeFromCategory(category) {
  if (HOUSEHOLD_CATEGORY_OPTIONS.includes(category)) return ITEM_TYPE.HOUSEHOLD;
  return ITEM_TYPE.FOOD;
}

export function isShoppingView(view) {
  return view === INVENTORY_VIEW.SHOPPING;
}

export function defaultCategoryForItemType(itemType) {
  return itemType === ITEM_TYPE.HOUSEHOLD
    ? HOUSEHOLD_CATEGORY.CLEANING
    : FOOD_CATEGORY.FRESH;
}

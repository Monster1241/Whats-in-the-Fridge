export const ITEM_TYPE = {
  FOOD: 'Food',
  HOUSEHOLD: 'Household',
  BABY: 'Baby',
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

export const BABY_CATEGORY = {
  DIAPERS: 'Diapers',
  FOOD: 'Baby Food',
  ESSENTIALS: 'Baby Essentials',
};

/** @deprecated migrated on load */
export const LEGACY_BABY_CATEGORY_TISSUES = 'Baby Tissues';
export const LEGACY_BABY_CATEGORY_WIPES = 'Wipes';

export const BABY_CATEGORY_OPTIONS = [
  BABY_CATEGORY.DIAPERS,
  BABY_CATEGORY.FOOD,
  BABY_CATEGORY.ESSENTIALS,
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

export const BABY_CATEGORY_META = {
  [BABY_CATEGORY.DIAPERS]: {
    emoji: '📦',
    label: 'Diapers',
    subtitle: 'Nappies & changing',
    tabActive: 'bg-rose-500 text-white',
    tabIdle: 'text-rose-700 hover:bg-rose-50',
  },
  [BABY_CATEGORY.FOOD]: {
    emoji: '🥣',
    label: 'Baby Food',
    subtitle: 'Purees, formula & snacks',
    tabActive: 'bg-orange-500 text-white',
    tabIdle: 'text-orange-700 hover:bg-orange-50',
  },
  [BABY_CATEGORY.ESSENTIALS]: {
    emoji: '🧸',
    label: 'Baby Essentials',
    subtitle: 'Creams, lotion & more',
    tabActive: 'bg-fuchsia-600 text-white',
    tabIdle: 'text-fuchsia-700 hover:bg-fuchsia-50',
  },
};

export const INVENTORY_VIEW = {
  ...FOOD_CATEGORY,
  ...HOUSEHOLD_CATEGORY,
  ...BABY_CATEGORY,
  SHOPPING: 'shopping',
};

export const STATUS = {
  FRESH: 'fresh',
  EXPIRING: 'expiring',
  EXPIRED: 'expired',
  ALMOST_FINISHED: 'almost_finished',
  OUT: 'out',
};

/** Canonical stored status — only `out` (shopping) or `fresh` (in inventory). */
export function normalizeInventoryStatus(status) {
  if (status == null || status === '') return STATUS.FRESH;
  const value = String(status).trim().toLowerCase();
  if (
    value === STATUS.OUT ||
    value === 'need to buy' ||
    value === 'need_to_buy' ||
    value === 'shopping'
  ) {
    return STATUS.OUT;
  }
  return STATUS.FRESH;
}

export function isOnShoppingList(item) {
  return normalizeInventoryStatus(item?.status) === STATUS.OUT;
}

export function isInStockInventory(item) {
  return !isOnShoppingList(item);
}

export function getCategoriesForItemType(itemType) {
  if (itemType === ITEM_TYPE.HOUSEHOLD) return HOUSEHOLD_CATEGORY_OPTIONS;
  if (itemType === ITEM_TYPE.BABY) return BABY_CATEGORY_OPTIONS;
  return FOOD_CATEGORY_OPTIONS;
}

export function getCategoryMeta(category, itemType = ITEM_TYPE.FOOD) {
  if (itemType === ITEM_TYPE.BABY) return BABY_CATEGORY_META[category] ?? null;
  if (itemType === ITEM_TYPE.HOUSEHOLD) return HOUSEHOLD_CATEGORY_META[category] ?? null;
  return FOOD_CATEGORY_META[category] ?? null;
}

export function inferItemTypeFromCategory(category) {
  if (
    category === LEGACY_BABY_CATEGORY_TISSUES ||
    category === LEGACY_BABY_CATEGORY_WIPES ||
    BABY_CATEGORY_OPTIONS.includes(category)
  ) {
    return ITEM_TYPE.BABY;
  }
  if (HOUSEHOLD_CATEGORY_OPTIONS.includes(category)) return ITEM_TYPE.HOUSEHOLD;
  return ITEM_TYPE.FOOD;
}

export function isShoppingView(view) {
  return view === INVENTORY_VIEW.SHOPPING;
}

export function defaultCategoryForItemType(itemType) {
  if (itemType === ITEM_TYPE.BABY) return BABY_CATEGORY.DIAPERS;
  if (itemType === ITEM_TYPE.HOUSEHOLD) return HOUSEHOLD_CATEGORY.CLEANING;
  return FOOD_CATEGORY.FRESH;
}

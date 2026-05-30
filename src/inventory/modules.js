import {
  defaultCategoryForItemType,
  FOOD_CATEGORY,
  getCategoriesForItemType,
  ITEM_TYPE,
} from './constants.js';

export const MODULE_KEYS = {
  FOOD: 'food',
  HOME_ESSENTIALS: 'homeEssentials',
  BABY_CARE: 'babyCare',
};

export const DEFAULT_ENABLED_MODULES = {
  [MODULE_KEYS.FOOD]: true,
  [MODULE_KEYS.HOME_ESSENTIALS]: true,
  [MODULE_KEYS.BABY_CARE]: false,
};

/** @type {{ key: string, itemType: string, emoji: string, label: string, description: string }[]} */
export const MODULE_DEFINITIONS = [
  {
    key: MODULE_KEYS.FOOD,
    itemType: ITEM_TYPE.FOOD,
    emoji: '🍏',
    label: 'Food & Kitchen',
    description: 'Fridge, pantry, freezer, and meal planning',
  },
  {
    key: MODULE_KEYS.HOME_ESSENTIALS,
    itemType: ITEM_TYPE.HOUSEHOLD,
    emoji: '🕯️',
    label: 'Home Essentials',
    description: 'Tissues, candles, spray, laundry, and cleaning',
  },
  {
    key: MODULE_KEYS.BABY_CARE,
    itemType: ITEM_TYPE.BABY,
    emoji: '👶',
    label: 'Baby Care',
    description: 'Diapers, wipes, and baby essentials',
  },
];

export function normalizeEnabledModules(raw) {
  const base = { ...DEFAULT_ENABLED_MODULES };
  if (!raw || typeof raw !== 'object') return base;
  return {
    [MODULE_KEYS.FOOD]: raw.food !== false,
    [MODULE_KEYS.HOME_ESSENTIALS]: raw.homeEssentials !== false,
    [MODULE_KEYS.BABY_CARE]: Boolean(raw.babyCare),
  };
}

export function getEnabledModuleList(enabledModules) {
  const normalized = normalizeEnabledModules(enabledModules);
  return MODULE_DEFINITIONS.filter((mod) => normalized[mod.key]);
}

export function getItemTypeForModule(moduleKey) {
  const mod = MODULE_DEFINITIONS.find((m) => m.key === moduleKey);
  return mod?.itemType ?? ITEM_TYPE.FOOD;
}

export function getModuleForItemType(itemType) {
  const mod = MODULE_DEFINITIONS.find((m) => m.itemType === itemType);
  return mod?.key ?? MODULE_KEYS.FOOD;
}

export function isModuleEnabled(enabledModules, moduleKey) {
  return normalizeEnabledModules(enabledModules)[moduleKey] === true;
}

export function isItemTypeEnabled(enabledModules, itemType) {
  const mod = MODULE_DEFINITIONS.find((m) => m.itemType === itemType);
  if (!mod) return true;
  return isModuleEnabled(enabledModules, mod.key);
}

/** @returns {string} first enabled module key */
export function getDefaultModuleKey(enabledModules) {
  const list = getEnabledModuleList(enabledModules);
  return list[0]?.key ?? MODULE_KEYS.FOOD;
}

export function resolveModuleKey(enabledModules, preferredKey) {
  const normalized = normalizeEnabledModules(enabledModules);
  if (preferredKey && normalized[preferredKey]) return preferredKey;
  return getDefaultModuleKey(enabledModules);
}

export function countEnabledModules(enabledModules) {
  return getEnabledModuleList(enabledModules).length;
}

export function validateEnabledModulesPatch(patch) {
  const next = normalizeEnabledModules(patch);
  if (!next[MODULE_KEYS.FOOD] && !next[MODULE_KEYS.HOME_ESSENTIALS] && !next[MODULE_KEYS.BABY_CARE]) {
    const err = new Error('At least one dashboard module must stay enabled.');
    err.status = 400;
    throw err;
  }
  return next;
}

export function getModuleGridClass(count) {
  if (count <= 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-2';
  return 'grid-cols-3';
}

export function getInitialCategoryForModule(moduleKey) {
  return defaultCategoryForItemType(getItemTypeForModule(moduleKey));
}

export function getEnabledItemTypes(enabledModules) {
  return getEnabledModuleList(enabledModules).map((m) => m.itemType);
}

export function getCategoryOptionsForModule(moduleKey) {
  return getCategoriesForItemType(getItemTypeForModule(moduleKey));
}

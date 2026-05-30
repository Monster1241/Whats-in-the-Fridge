export const DEFAULT_ENABLED_MODULES = {
  food: true,
  homeEssentials: true,
  babyCare: false,
};

export function normalizeEnabledModules(raw) {
  const base = { ...DEFAULT_ENABLED_MODULES };
  if (!raw || typeof raw !== 'object') return base;
  return {
    food: raw.food !== false,
    homeEssentials: raw.homeEssentials !== false,
    babyCare: Boolean(raw.babyCare),
  };
}

export function validateEnabledModules(patch) {
  const next = normalizeEnabledModules(patch);
  if (!next.food && !next.homeEssentials && !next.babyCare) {
    const err = new Error('At least one dashboard module must stay enabled.');
    err.status = 400;
    throw err;
  }
  return next;
}

export const THEME_PREFERENCE = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
};

export const THEME_STORAGE_KEY = 'fridge_theme_preference';

const THEME_COLOR_LIGHT = '#F2FBF7';
const THEME_COLOR_DARK = '#000000';

/**
 * @param {unknown} value
 * @returns {'light'|'dark'|'system'}
 */
export function normalizeThemePreference(value) {
  const key = String(value ?? '')
    .trim()
    .toLowerCase();
  if (key === THEME_PREFERENCE.DARK) return THEME_PREFERENCE.DARK;
  if (key === THEME_PREFERENCE.SYSTEM || key === 'auto' || key === 'device') {
    return THEME_PREFERENCE.SYSTEM;
  }
  if (key === THEME_PREFERENCE.LIGHT) return THEME_PREFERENCE.LIGHT;
  return THEME_PREFERENCE.SYSTEM;
}

/**
 * @returns {'light'|'dark'|'system'|null}
 */
export function readStoredThemePreference() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw == null || raw === '') return null;
    return normalizeThemePreference(raw);
  } catch {
    return null;
  }
}

/**
 * @param {unknown} preference
 */
export function writeStoredThemePreference(preference) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(THEME_STORAGE_KEY, normalizeThemePreference(preference));
  } catch {
    // Private mode / storage blocked — ignore.
  }
}

/**
 * @param {unknown} preference
 * @param {MediaQueryList|null} [media]
 * @returns {'light'|'dark'}
 */
export function resolveColorScheme(preference, media = null) {
  const pref = normalizeThemePreference(preference);
  if (pref === THEME_PREFERENCE.LIGHT || pref === THEME_PREFERENCE.DARK) return pref;
  const query =
    media ??
    (typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null);
  return query?.matches ? THEME_PREFERENCE.DARK : THEME_PREFERENCE.LIGHT;
}

/**
 * @param {'light'|'dark'} scheme
 */
export function applyColorScheme(scheme) {
  if (typeof document === 'undefined') return;
  const dark = scheme === THEME_PREFERENCE.DARK;
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';

  const metas = document.querySelectorAll('meta[name="theme-color"]');
  const color = dark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT;
  if (metas.length) {
    metas.forEach((meta) => {
      meta.setAttribute('content', color);
    });
  }
}

/**
 * @param {unknown} preference
 * @returns {'light'|'dark'}
 */
export function applyThemePreference(preference) {
  const resolved = resolveColorScheme(preference);
  applyColorScheme(resolved);
  return resolved;
}

/**
 * Subscribe to OS light/dark changes. Only fires while preference is `system`.
 * @param {unknown} preference
 * @param {(scheme: 'light'|'dark') => void} onChange
 * @returns {() => void}
 */
export function subscribeSystemColorScheme(preference, onChange) {
  if (typeof window === 'undefined') return () => {};
  if (normalizeThemePreference(preference) !== THEME_PREFERENCE.SYSTEM) return () => {};

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    onChange(resolveColorScheme(THEME_PREFERENCE.SYSTEM, media));
  };

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }

  // Safari < 14
  media.addListener(handler);
  return () => media.removeListener(handler);
}

export function themePreferenceLabel(preference) {
  switch (normalizeThemePreference(preference)) {
    case THEME_PREFERENCE.DARK:
      return 'Dark mode';
    case THEME_PREFERENCE.LIGHT:
      return 'Light mode';
    default:
      return 'System setting';
  }
}

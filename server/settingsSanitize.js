import { normalizeDietaryPreference } from '../src/recipes/dietaryPreferences.js';

export const DEFAULT_SETTINGS = {
  theme: 'light',
  user: { name: '', email: '' },
  dietaryPreference: 'none',
};

const MAX_NAME_LEN = 80;
const MAX_EMAIL_LEN = 254;

/**
 * @param {unknown} raw
 * @returns {{ theme: 'light'|'dark', user: { name: string, email: string }, dietaryPreference: string }}
 */
export function sanitizeSettings(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const theme = source.theme === 'dark' ? 'dark' : 'light';
  const user = source.user && typeof source.user === 'object' && !Array.isArray(source.user)
    ? source.user
    : {};
  return {
    theme,
    user: {
      name: String(user.name ?? '').trim().slice(0, MAX_NAME_LEN),
      email: String(user.email ?? '').trim().slice(0, MAX_EMAIL_LEN),
    },
    dietaryPreference: normalizeDietaryPreference(source.dietaryPreference),
  };
}

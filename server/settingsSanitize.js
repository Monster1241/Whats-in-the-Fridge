import { normalizeDietaryPreference } from '../src/recipes/dietaryPreferences.js';
import { normalizeThemePreference } from '../src/theme/themePreference.js';
import { DEFAULT_CURRENCY, normalizeCurrency } from '../src/utils/currency.js';

export const DEFAULT_SETTINGS = {
  theme: 'system',
  user: { name: '', email: '' },
  dietaryPreference: 'none',
  currency: DEFAULT_CURRENCY,
};

const MAX_NAME_LEN = 80;
const MAX_EMAIL_LEN = 254;

/**
 * Per-account profile. Never stored on the household document.
 * @param {unknown} raw
 * @returns {{ name: string, email: string }}
 */
export function sanitizeUserProfile(raw) {
  const user = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    name: String(user.name ?? user.displayName ?? '').trim().slice(0, MAX_NAME_LEN),
    email: String(user.email ?? user.profileEmail ?? '').trim().slice(0, MAX_EMAIL_LEN),
  };
}

/**
 * Household-shared settings only (theme / diet / currency). Display name and profile email
 * belong on the user record so partners cannot overwrite each other.
 * Theme may be light, dark, or system (follow the device).
 * @param {unknown} raw
 * @returns {{ theme: 'light'|'dark'|'system', dietaryPreference: string, currency: string }}
 */
export function sanitizeHouseholdSettings(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    theme: normalizeThemePreference(source.theme),
    dietaryPreference: normalizeDietaryPreference(source.dietaryPreference),
    currency: normalizeCurrency(source.currency),
  };
}

/**
 * @param {unknown} raw
 * @returns {{ theme: 'light'|'dark'|'system', user: { name: string, email: string }, dietaryPreference: string, currency: string }}
 */
export function sanitizeSettings(raw) {
  const household = sanitizeHouseholdSettings(raw);
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    ...household,
    user: sanitizeUserProfile(source.user),
  };
}

/**
 * Build the settings object a specific household member should see.
 * Legacy household.settings.user is only reused when it matches this member's login email.
 * @param {unknown} householdSettings
 * @param {{ email?: string, displayName?: string, profileEmail?: string }|null} user
 */
export function settingsForViewer(householdSettings, user) {
  const household = sanitizeHouseholdSettings(householdSettings);
  const stored = sanitizeUserProfile({
    name: user?.displayName,
    email: user?.profileEmail,
  });
  const loginEmail = String(user?.email ?? '').trim();

  let name = stored.name;
  let email = stored.email || loginEmail;

  if (!stored.name && !stored.email) {
    const legacy = sanitizeUserProfile(
      householdSettings && typeof householdSettings === 'object'
        ? householdSettings.user
        : null,
    );
    if (legacy.email && loginEmail && legacy.email.toLowerCase() === loginEmail.toLowerCase()) {
      name = legacy.name;
      email = legacy.email || loginEmail;
    }
  }

  return {
    theme: household.theme,
    dietaryPreference: household.dietaryPreference,
    currency: household.currency,
    user: { name, email },
  };
}

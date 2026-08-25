import { normalizeDietaryPreference } from '../src/recipes/dietaryPreferences.js';

export const DEFAULT_SETTINGS = {
  theme: 'light',
  user: { name: '', email: '' },
  dietaryPreference: 'none',
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
 * Household-shared settings only (theme / diet). Display name and profile email
 * belong on the user record so partners cannot overwrite each other.
 * @param {unknown} raw
 * @returns {{ theme: 'light'|'dark', dietaryPreference: string }}
 */
export function sanitizeHouseholdSettings(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    theme: source.theme === 'dark' ? 'dark' : 'light',
    dietaryPreference: normalizeDietaryPreference(source.dietaryPreference),
  };
}

/**
 * @param {unknown} raw
 * @returns {{ theme: 'light'|'dark', user: { name: string, email: string }, dietaryPreference: string }}
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
    user: { name, email },
  };
}

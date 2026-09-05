import { describe, expect, it } from 'vitest';
import { sanitizeSettings, settingsForViewer } from './settingsSanitize.js';

describe('sanitizeSettings', () => {
  it('keeps light/dark/system and trims profile fields', () => {
    expect(
      sanitizeSettings({
        theme: 'dark',
        user: { name: '  Ada  ', email: 'ada@example.com' },
        extra: true,
      }),
    ).toEqual({
      theme: 'dark',
      user: { name: 'Ada', email: 'ada@example.com' },
      dietaryPreference: 'none',
      currency: 'AUD',
    });
    expect(sanitizeSettings({ theme: 'system' }).theme).toBe('system');
    expect(sanitizeSettings({ theme: 'auto' }).theme).toBe('system');
  });

  it('falls back to system for junk theme input', () => {
    expect(sanitizeSettings(null)).toEqual({
      theme: 'system',
      user: { name: '', email: '' },
      dietaryPreference: 'none',
      currency: 'AUD',
    });
    expect(sanitizeSettings({ theme: 'neon', user: 'nope' })).toEqual({
      theme: 'system',
      user: { name: '', email: '' },
      dietaryPreference: 'none',
      currency: 'AUD',
    });
  });

  it('caps name and email length', () => {
    const out = sanitizeSettings({
      theme: 'light',
      user: { name: 'x'.repeat(200), email: `${'a'.repeat(300)}@x.com` },
    });
    expect(out.user.name).toHaveLength(80);
    expect(out.user.email.length).toBeLessThanOrEqual(254);
  });

  it('sanitizes dietary preference', () => {
    expect(sanitizeSettings({ dietaryPreference: 'vegan' }).dietaryPreference).toBe('vegan');
    expect(sanitizeSettings({ dietaryPreference: 'no_beef' }).dietaryPreference).toBe('no_beef');
    expect(sanitizeSettings({ dietaryPreference: 'gluten_free' }).dietaryPreference).toBe(
      'gluten_free',
    );
    expect(sanitizeSettings({ dietaryPreference: 'pescatarian' }).dietaryPreference).toBe(
      'pescatarian',
    );
    expect(sanitizeSettings({ dietaryPreference: 'invalid' }).dietaryPreference).toBe('none');
  });

  it('sanitizes currency', () => {
    expect(sanitizeSettings({ currency: 'usd' }).currency).toBe('USD');
    expect(sanitizeSettings({ currency: 'GBP' }).currency).toBe('GBP');
    expect(sanitizeSettings({ currency: 'xyz' }).currency).toBe('AUD');
  });
});

describe('settingsForViewer', () => {
  it('uses the signed-in user profile, not another household member', () => {
    const household = {
      theme: 'dark',
      dietaryPreference: 'vegan',
      currency: 'NZD',
      user: { name: 'Partner', email: 'partner@example.com' },
    };
    expect(
      settingsForViewer(household, {
        email: 'me@example.com',
        displayName: 'Alex',
        profileEmail: 'alex@home.test',
      }),
    ).toEqual({
      theme: 'dark',
      dietaryPreference: 'vegan',
      currency: 'NZD',
      user: { name: 'Alex', email: 'alex@home.test' },
    });
  });

  it('does not copy a partner household profile onto a member with no saved name', () => {
    const household = {
      theme: 'light',
      user: { name: 'Partner', email: 'partner@example.com' },
    };
    expect(
      settingsForViewer(household, {
        email: 'me@example.com',
        displayName: '',
        profileEmail: '',
      }),
    ).toEqual({
      theme: 'light',
      dietaryPreference: 'none',
      currency: 'AUD',
      user: { name: '', email: 'me@example.com' },
    });
  });

  it('reuses legacy household profile only when the email matches this user', () => {
    const household = {
      theme: 'light',
      user: { name: 'Ada', email: 'ada@example.com' },
    };
    expect(
      settingsForViewer(household, {
        email: 'ada@example.com',
        displayName: '',
        profileEmail: '',
      }).user,
    ).toEqual({ name: 'Ada', email: 'ada@example.com' });
  });
});

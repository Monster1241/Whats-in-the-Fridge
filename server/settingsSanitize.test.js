import { describe, expect, it } from 'vitest';
import { sanitizeSettings } from './settingsSanitize.js';

describe('sanitizeSettings', () => {
  it('keeps light/dark and trims profile fields', () => {
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
    });
  });

  it('falls back to defaults for junk input', () => {
    expect(sanitizeSettings(null)).toEqual({
      theme: 'light',
      user: { name: '', email: '' },
      dietaryPreference: 'none',
    });
    expect(sanitizeSettings({ theme: 'neon', user: 'nope' })).toEqual({
      theme: 'light',
      user: { name: '', email: '' },
      dietaryPreference: 'none',
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
});

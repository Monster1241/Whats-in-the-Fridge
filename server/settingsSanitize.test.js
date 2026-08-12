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
    });
  });

  it('falls back to defaults for junk input', () => {
    expect(sanitizeSettings(null)).toEqual({
      theme: 'light',
      user: { name: '', email: '' },
    });
    expect(sanitizeSettings({ theme: 'neon', user: 'nope' })).toEqual({
      theme: 'light',
      user: { name: '', email: '' },
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
});

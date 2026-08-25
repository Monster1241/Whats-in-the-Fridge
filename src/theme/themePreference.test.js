import { describe, expect, it } from 'vitest';
import {
  normalizeThemePreference,
  resolveColorScheme,
  themePreferenceLabel,
} from './themePreference.js';

describe('themePreference', () => {
  it('normalizes light, dark, and system aliases', () => {
    expect(normalizeThemePreference('dark')).toBe('dark');
    expect(normalizeThemePreference('LIGHT')).toBe('light');
    expect(normalizeThemePreference('system')).toBe('system');
    expect(normalizeThemePreference('auto')).toBe('system');
    expect(normalizeThemePreference('device')).toBe('system');
    expect(normalizeThemePreference('neon')).toBe('system');
    expect(normalizeThemePreference(null)).toBe('system');
  });

  it('resolves system from media query', () => {
    expect(resolveColorScheme('light')).toBe('light');
    expect(resolveColorScheme('dark')).toBe('dark');
    expect(resolveColorScheme('system', { matches: true })).toBe('dark');
    expect(resolveColorScheme('system', { matches: false })).toBe('light');
  });

  it('labels preferences for settings UI', () => {
    expect(themePreferenceLabel('system')).toBe('System setting');
    expect(themePreferenceLabel('dark')).toBe('Dark mode');
    expect(themePreferenceLabel('light')).toBe('Light mode');
  });
});

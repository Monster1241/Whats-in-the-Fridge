import { describe, expect, it } from 'vitest';
import { isOriginAllowed } from './env.js';

describe('isOriginAllowed', () => {
  it('allows missing origin (same-origin / non-browser clients)', () => {
    expect(isOriginAllowed(undefined)).toBe(true);
    expect(isOriginAllowed('')).toBe(true);
  });

  it('allows Capacitor WebView origins', () => {
    expect(isOriginAllowed('https://localhost')).toBe(true);
    expect(isOriginAllowed('http://localhost')).toBe(true);
    expect(isOriginAllowed('capacitor://localhost')).toBe(true);
    expect(isOriginAllowed('ionic://localhost')).toBe(true);
    expect(isOriginAllowed('http://localhost:5173')).toBe(true);
    expect(isOriginAllowed('http://127.0.0.1:3000')).toBe(true);
  });

  it('allows Vercel app hosts', () => {
    expect(isOriginAllowed('https://whats-in-the-fridge-x5zg.vercel.app')).toBe(true);
  });

  it('denies unrelated origins', () => {
    expect(isOriginAllowed('https://evil.example')).toBe(false);
  });
});

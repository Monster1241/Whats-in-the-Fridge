import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CURRENCY,
  formatMoney,
  inferCurrencyFromLocale,
  inferCurrencyFromPostalCode,
  normalizeCurrency,
} from './currency.js';

describe('normalizeCurrency', () => {
  it('accepts known codes and defaults unknown', () => {
    expect(normalizeCurrency('usd')).toBe('USD');
    expect(normalizeCurrency('AUD')).toBe('AUD');
    expect(normalizeCurrency('nope')).toBe(DEFAULT_CURRENCY);
    expect(normalizeCurrency(null)).toBe(DEFAULT_CURRENCY);
  });
});

describe('formatMoney', () => {
  it('formats with the selected currency', () => {
    expect(formatMoney(12.5, 'AUD')).toMatch(/12\.50/);
    expect(formatMoney(10, 'USD')).toContain('10');
  });
});

describe('inferCurrencyFromPostalCode', () => {
  it('detects distinctive formats', () => {
    expect(inferCurrencyFromPostalCode('2000')).toBe('AUD');
    expect(inferCurrencyFromPostalCode('SW1A 1AA')).toBe('GBP');
    expect(inferCurrencyFromPostalCode('K1A 0B1')).toBe('CAD');
    expect(inferCurrencyFromPostalCode('100-0001')).toBe('JPY');
    expect(inferCurrencyFromPostalCode('90210')).toBe('USD');
    expect(inferCurrencyFromPostalCode('110001')).toBe('INR');
  });

  it('uses locale for ambiguous 4-digit NZ vs AU', () => {
    expect(inferCurrencyFromPostalCode('6011', 'en-NZ')).toBe('NZD');
    expect(inferCurrencyFromPostalCode('6011', 'en-AU')).toBe('AUD');
  });
});

describe('inferCurrencyFromLocale', () => {
  it('maps common locales', () => {
    expect(inferCurrencyFromLocale('en-GB')).toBe('GBP');
    expect(inferCurrencyFromLocale('de-DE')).toBe('EUR');
    expect(inferCurrencyFromLocale('en-US')).toBe('USD');
  });
});

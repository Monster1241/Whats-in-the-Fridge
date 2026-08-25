import { describe, expect, it } from 'vitest';
import { getDealPriceCheckLinks } from './dealPriceCheck.js';

describe('getDealPriceCheckLinks', () => {
  it('builds catalogue and search URLs for Coles', () => {
    const links = getDealPriceCheckLinks({
      store: 'coles',
      name: 'Cadbury Dairy Milk',
    });
    expect(links.catalogueUrl).toBe('https://www.coles.com.au/catalogues');
    expect(links.searchUrl).toBe(
      'https://www.coles.com.au/search?q=Cadbury%20Dairy%20Milk',
    );
  });

  it('returns null search when name is missing', () => {
    expect(getDealPriceCheckLinks({ store: 'woolworths' }).searchUrl).toBeNull();
  });
});

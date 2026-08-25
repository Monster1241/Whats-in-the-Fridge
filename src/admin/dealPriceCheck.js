/**
 * Store links for admin price verification (catalogue + product search).
 * @param {{ store?: string, name?: string }} deal
 */
export function getDealPriceCheckLinks(deal) {
  const store = String(deal?.store ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  const name = String(deal?.name ?? '').trim();

  const catalogueUrls = {
    coles: 'https://www.coles.com.au/catalogues',
    woolworths: 'https://www.woolworths.com.au/shop/catalogue',
    aldi: 'https://www.aldi.com.au/catalogue/',
    harrisfarm: 'https://www.harrisfarm.com.au/catalogue',
    costco: 'https://www.costco.com.au/warehouse-offers',
  };

  const searchBuilders = {
    coles: (query) => `https://www.coles.com.au/search?q=${encodeURIComponent(query)}`,
    woolworths: (query) =>
      `https://www.woolworths.com.au/shop/search/products?searchTerm=${encodeURIComponent(query)}`,
    aldi: (query) => `https://www.aldi.com.au/search?query=${encodeURIComponent(query)}`,
    harrisfarm: (query) =>
      `https://www.harrisfarm.com.au/search?q=${encodeURIComponent(query)}`,
    costco: (query) => `https://www.costco.com.au/search?text=${encodeURIComponent(query)}`,
  };

  const buildSearch = searchBuilders[store];
  return {
    catalogueUrl: catalogueUrls[store] ?? null,
    searchUrl: buildSearch && name ? buildSearch(name) : null,
  };
}

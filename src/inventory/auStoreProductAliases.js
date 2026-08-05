/**
 * Australian supermarket search aliases for typeahead and classification hints.
 *
 * Legal / data use (Australia):
 * - Generic product names, species, and cuts are factual and not proprietary.
 * - Retailer and house-brand names are used only as optional search aliases so
 *   households can match how they label items (e.g. "woolworths salmon") —
 *   not as scraped catalogues, prices, SKUs, or barcode databases.
 * - Barcode enrichment uses Open Food Facts (ODbL / CC BY-SA) in openFoodFactsMap.js.
 *
 * @typedef {import('./productCatalog.js').ProductCatalogEntry} ProductCatalogEntry
 */

/**
 * Extra aliases keyed by canonical catalogue name.
 * @type {Record<string, string[]>}
 */
const AU_STORE_ALIASES_BY_PRODUCT = {
  // ── Fresh seafood ────────────────────────────────────────────
  'Salmon Fillet': [
    'atlantic salmon',
    'tasmanian salmon',
    'salmon portion',
    'salmon steak',
    'coles salmon',
    'woolworths salmon',
    'aldi salmon fillet',
    'macro salmon',
    'coles finest salmon',
  ],
  'Barramundi Fillet': [
    'fresh barra',
    'coles barramundi',
    'woolworths barramundi',
    'aldi barramundi',
    'harris farm barramundi',
  ],
  'Snapper Fillet': [
    'pink snapper',
    'coles snapper',
    'woolworths snapper',
  ],
  'Flathead Fillet': [
    'southern flathead',
    'coles flathead',
    'woolworths flathead',
  ],
  Prawns: [
    'raw prawns',
    'cooked prawns',
    'coles prawns',
    'woolworths prawns',
    'aldi prawns',
    'seafood counter prawns',
  ],
  'King Prawns': ['jumbo prawns', 'coles king prawns', 'woolworths king prawns'],
  'Tiger Prawns': ['black tiger prawns', 'coles tiger prawns'],
  'Banana Prawns': ['banana prawn', 'coles banana prawns'],
  Calamari: ['fresh squid', 'coles calamari', 'woolworths calamari'],
  'Tuna Steak': ['yellowfin', 'ahi tuna', 'coles tuna steak'],
  'Smoked Salmon': [
    'smoked salmon slices',
    'coles smoked salmon',
    'woolworths smoked salmon',
    'aldi smoked salmon',
  ],
  Mussels: ['green lip mussels', 'black mussels', 'coles mussels', 'woolworths mussels'],
  Oysters: ['dozen oysters', 'sydney rock oysters', 'pacific oysters'],
  Scallops: ['sea scallops', 'coles scallops', 'woolworths scallops'],
  'Moreton Bay Bugs': ['bay bugs', 'moreton bay bug'],
  'Rock Lobster': ['crayfish', 'southern rock lobster', 'wa crayfish'],
  'Blue Swimmer Crab': ['swimmer crab', 'sand crab'],
  'Mud Crab': ['mangrove crab'],
  'Hoki Fillet': ['blue grenadier', 'new zealand hoki', 'coles hoki'],
  'Blue Grenadier Fillet': ['grenadier fillet', 'deep sea dory'],
  'Kingfish Fillet': ['yellowtail kingfish', 'hiramasa'],
  'Whiting Fillets': ['sand whiting', 'school whiting'],
  'Ocean Trout Fillet': ['tasmanian ocean trout', 'steelhead trout'],
  Octopus: ['baby octopus', 'octopus tentacles'],
  // ── Frozen seafood ───────────────────────────────────────────
  'Frozen Fish Fillets': [
    'frozen fish portions',
    'coles frozen fish',
    'woolworths frozen fish',
    'aldi ocean royale',
    'ocean royale fish',
  ],
  'Frozen Salmon Portions': [
    'frozen salmon fillets',
    'coles frozen salmon',
    'woolworths frozen salmon',
    'aldi frozen salmon',
  ],
  'Frozen Barramundi Portions': [
    'frozen barra',
    'coles frozen barramundi',
    'woolworths frozen barramundi',
  ],
  'Frozen Prawns': [
    'frozen raw prawns',
    'coles frozen prawns',
    'woolworths frozen prawns',
    'aldi frozen prawns',
    'ocean royale prawns',
  ],
  'Frozen Calamari Rings': [
    'frozen squid rings',
    'salt and pepper calamari frozen',
    'coles frozen calamari',
  ],
  'Frozen Hoki Fillets': ['frozen grenadier', 'frozen blue grenadier'],
  'Frozen Fish Fingers': [
    'birds eye fish fingers',
    'coles fish fingers',
    'woolworths fish fingers',
    'aldi fish fingers',
  ],
  'Frozen Crumbed Fish': ['frozen battered fish', 'frozen fish portions crumbed'],
  'Frozen Seafood Mix': ['seafood medley frozen', 'marinara mix frozen'],
  'Frozen Scallops': ['coles frozen scallops', 'woolworths frozen scallops'],
  // ── Common AU grocery (existing items) ───────────────────────
  Milk: ['coles milk', 'woolworths milk', 'aldi milk', 'a2 milk', 'pauls milk', 'dairy farmers'],
  Eggs: ['coles eggs', 'woolworths eggs', 'aldi eggs', 'free range eggs'],
  Butter: ['coles butter', 'woolworths butter', 'aldi butter', 'western star'],
  'Chicken Breast': ['coles chicken breast', 'woolworths chicken breast', 'lilydale chicken breast'],
  'Chicken Thighs': ['coles chicken thigh', 'woolworths chicken thigh'],
  'Beef Mince': ['coles beef mince', 'woolworths beef mince', 'aldi beef mince'],
  Bread: ['coles bread', 'woolworths bread', 'aldi bread', 'bakers life'],
  'Paper Towels': ['coles paper towel', 'woolworths paper towel', 'essentials paper towel'],
  'Toilet Paper': ['coles toilet paper', 'woolworths toilet paper', 'quilton', 'kleenex toilet tissue'],
  'Dishwashing Liquid': ['coles dish liquid', 'fairy', 'morning fresh', 'aldi dishwashing liquid'],
  'Laundry Liquid': ['coles laundry liquid', 'omo', 'aldi laundry liquid', 'earth choice laundry'],
  // ── Dried herbs & spices (AU brands as search aliases only) ──
  Oregano: ['masterfoods oregano', 'coles oregano', 'woolworths oregano', 'aldi oregano'],
  'Dried Parsley': ['masterfoods parsley', 'parsley flakes', 'coles dried parsley'],
  'Onion Powder': ['masterfoods onion powder', 'coles onion powder', 'woolworths onion powder'],
  'Garlic Powder': ['masterfoods garlic powder', 'coles garlic powder'],
  Paprika: ['masterfoods paprika', 'coles paprika', 'woolworths paprika'],
  Cumin: ['masterfoods cumin', 'coles cumin ground'],
  Turmeric: ['masterfoods turmeric', 'coles turmeric ground'],
  'Mixed Herbs': ['masterfoods mixed herbs', 'coles mixed herbs'],
  'Italian Herbs': ['masterfoods italian herbs', 'coles italian herbs'],
  'Curry Powder': ['masterfoods curry powder', 'coles curry powder', 'keens curry'],
  'Chili Flakes': ['masterfoods chilli flakes', 'coles chilli flakes'],
};

/**
 * @param {ProductCatalogEntry[]} catalog
 * @returns {ProductCatalogEntry[]}
 */
export function withAustralianStoreAliases(catalog) {
  return catalog.map((entry) => {
    const extra = AU_STORE_ALIASES_BY_PRODUCT[entry.name];
    if (!extra?.length) return entry;
    const merged = [...new Set([...(entry.aliases ?? []), ...extra])];
    return { ...entry, aliases: merged };
  });
}

/**
 * Retailer names supported for preferred-store features (factual list only).
 */
export const AU_SUPERMARKET_CHAINS = [
  'Coles',
  'Woolworths',
  'ALDI',
  'IGA',
  'Harris Farm',
  'Costco',
];

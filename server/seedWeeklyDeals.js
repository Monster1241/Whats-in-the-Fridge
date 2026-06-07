/**
 * Weekly deal catalogue seed — itemized hot deals per store and promotion tier.
 * Consumed by buildDealsForCycle() on first seed and grocery refresh cycles.
 */

/** @typedef {import('./weeklyDeals.js').WeeklyDealDoc} WeeklyDealDoc */

/**
 * @type {Array<Partial<WeeklyDealDoc> & { name: string; store: string; dealPrice: number }>}
 */
export const WEEKLY_DEAL_TEMPLATES = [
  // —— Woolworths ——
  {
    name: 'Cadbury Favourites Gift Box 570g',
    store: 'woolworths',
    dealPrice: 10.0,
    originalPrice: 20.0,
    dealType: 'Half Price',
    savingsText: 'Half Price!',
    category: 'Pantry',
  },
  {
    name: 'Oral-B 3D White Toothpaste',
    store: 'woolworths',
    dealPrice: 5.0,
    originalPrice: 10.0,
    dealType: 'Half Price',
    savingsText: 'Half Price!',
    category: 'Household',
  },
  {
    name: 'Twinings Tea Bags 100pk',
    store: 'woolworths',
    dealPrice: 6.75,
    originalPrice: 13.5,
    dealType: 'Half Price',
    savingsText: 'Half Price!',
    category: 'Pantry',
  },
  {
    name: 'Pepsi Max 30-Pack Cans',
    store: 'woolworths',
    dealPrice: 24.5,
    originalPrice: 38.0,
    dealType: 'Super Saver',
    savingsText: 'Save $13.50',
    category: 'Pantry',
  },
  {
    name: 'Woolworths RSPCA Chicken Breast 1kg',
    store: 'woolworths',
    dealPrice: 11.5,
    originalPrice: 13.0,
    dealType: 'Price Drop',
    savingsText: 'Price Drop',
    category: 'Fresh',
  },

  // —— Coles ——
  {
    name: 'Connoisseur Ice Cream 1L',
    store: 'coles',
    dealPrice: 6.0,
    originalPrice: 12.0,
    dealType: 'Half Price',
    savingsText: 'Half Price!',
    category: 'Freezer',
  },
  {
    name: 'Fairy Platinum Dishwasher Tablets 52pk',
    store: 'coles',
    dealPrice: 22.5,
    originalPrice: 45.0,
    dealType: 'Half Price',
    savingsText: 'Half Price!',
    category: 'Household',
  },
  {
    name: 'Huggies Ultimate Nappy Packs',
    store: 'coles',
    dealPrice: 27.0,
    originalPrice: 36.0,
    dealType: 'Super Saver',
    savingsText: 'Save $9.00',
    category: 'Baby',
  },
  {
    name: "Smith's Crinkle Cut Chips 170g",
    store: 'coles',
    dealPrice: 2.5,
    originalPrice: 4.8,
    dealType: 'Price Drop',
    savingsText: 'Price Drop',
    category: 'Pantry',
  },

  // —— ALDI ——
  {
    name: 'Premium Corner Air Fryer',
    store: 'aldi',
    dealPrice: 49.99,
    originalPrice: null,
    dealType: 'Special Buy',
    savingsText: 'Special Buy',
    category: 'Household',
  },
  {
    name: "Mamie's Organic Baby Food Pouch",
    store: 'aldi',
    dealPrice: 1.2,
    originalPrice: null,
    dealType: 'Price Drop',
    savingsText: 'Price Drop',
    category: 'Baby',
  },

  // —— Harris Farm ——
  {
    name: 'Meredith Dairy Goat Cheese 320g',
    store: 'harrisfarm',
    dealPrice: 10.5,
    originalPrice: 14.0,
    dealType: 'Super Saver',
    savingsText: 'Save $3.50',
    category: 'Fresh',
  },
  {
    name: 'Imperfect Picks Bananas 1kg Bag',
    store: 'harrisfarm',
    dealPrice: 2.99,
    originalPrice: null,
    dealType: 'Price Drop',
    savingsText: 'Price Drop',
    category: 'Fresh',
  },

  // —— Costco ——
  {
    name: 'Kirkland Signature Bath Tissue 48-Pack',
    store: 'costco',
    dealPrice: 32.99,
    originalPrice: null,
    dealType: 'Bulk Value',
    savingsText: 'Bulk Buy Value',
    category: 'Household',
  },
  {
    name: 'Bulk Chicken Breast Fillets 5kg',
    store: 'costco',
    dealPrice: 45.0,
    originalPrice: null,
    dealType: 'Bulk Value',
    savingsText: 'Bulk Buy Value',
    category: 'Fresh',
  },
];

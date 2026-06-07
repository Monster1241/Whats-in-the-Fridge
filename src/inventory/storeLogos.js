/** Official retailer logo URLs (Wikimedia / Clearbit) with brand fallbacks. */

export const STORE_LOGO_URLS = {
  coles: 'https://upload.wikimedia.org/wikipedia/en/b/b3/Coles_logo.svg',
  woolworths: 'https://upload.wikimedia.org/wikipedia/en/2/24/Woolworths_%28Australia%29_logo.svg',
  aldi: 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Aldi_logo.svg',
  harrisfarm: 'https://logo.clearbit.com/harrisfarm.com.au',
  costco: 'https://upload.wikimedia.org/wikipedia/commons/5/59/Costco_Wholesale_logo_2010-10-26.svg',
};

export const STORE_LOGO_FALLBACK = {
  coles: { initials: 'C', bg: 'bg-red-600', text: 'text-white' },
  woolworths: { initials: 'W', bg: 'bg-emerald-600', text: 'text-white' },
  aldi: { initials: 'A', bg: 'bg-blue-800', text: 'text-white' },
  harrisfarm: { initials: 'HF', bg: 'bg-orange-500', text: 'text-white' },
  costco: { initials: 'C', bg: 'bg-[#E31837]', text: 'text-white' },
};

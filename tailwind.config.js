/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#059669',
          secondary: '#14b8a6',
          accent: '#7c3aed',
          sky: '#0ea5e9',
          light: '#ecfdf5',
          canvas: '#f2fbf7',
          text: '#0f172a',
        },
        lm: {
          canvas: '#f2fbf7',
          card: '#ffffff',
          raised: '#ffffff',
          inset: '#ecfdf5',
        },
        dm: {
          canvas: '#000000',
          card: '#131316',
          raised: '#1a1a1f',
          inset: '#09090b',
        },
      },
      boxShadow: {
        'lm-card':
          '0 1px 2px rgb(15 23 42 / 0.04), 0 10px 32px -10px rgb(5 150 105 / 0.12)',
        'lm-raised':
          '0 1px 2px rgb(15 23 42 / 0.05), 0 4px 14px -4px rgb(5 150 105 / 0.1)',
        'lm-nav': '0 -4px 24px -4px rgb(5 150 105 / 0.1)',
        'dm-card':
          '0 1px 0 0 rgb(255 255 255 / 0.05) inset, 0 12px 40px -12px rgb(0 0 0 / 0.55)',
        'dm-raised':
          '0 1px 0 0 rgb(255 255 255 / 0.06) inset, 0 4px 20px -6px rgb(0 0 0 / 0.45)',
        'dm-nav': '0 -1px 0 0 rgb(255 255 255 / 0.06) inset',
      },
    },
  },
  plugins: [],
};

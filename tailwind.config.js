/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        lm: {
          canvas: '#ffffff',
          card: '#f7f8fa',
          raised: '#ffffff',
          inset: '#f1f3f6',
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
          '0 1px 2px rgb(15 23 42 / 0.04), 0 8px 28px -8px rgb(15 23 42 / 0.08)',
        'lm-raised':
          '0 1px 2px rgb(15 23 42 / 0.05), 0 2px 10px -3px rgb(15 23 42 / 0.07)',
        'lm-nav': '0 -4px 24px -4px rgb(15 23 42 / 0.08)',
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

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dm: {
          canvas: '#000000',
          card: '#131316',
          raised: '#1a1a1f',
          inset: '#09090b',
        },
      },
      boxShadow: {
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

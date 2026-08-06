/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#6B8E5A',
          secondary: '#A3B18A',
          light: '#EDF2E8',
          bg: '#F8F8F4',
          text: '#222222',
        },
        /* Sage palette — replaces default emerald accents app-wide */
        emerald: {
          50: '#EDF2E8',
          100: '#e4ebe0',
          200: '#d0dbc6',
          300: '#A3B18A',
          400: '#8b9d75',
          500: '#789264',
          600: '#6B8E5A',
          700: '#557347',
          800: '#405636',
          900: '#2b3924',
          950: '#161e12',
        },
        /* Harmonized teal for gradients and Scout tab highlights */
        teal: {
          50: '#EDF2E8',
          100: '#e2e9da',
          200: '#d0dbc4',
          300: '#A3B18A',
          400: '#95a67f',
          500: '#84956f',
          600: '#6B8E5A',
          700: '#567247',
          800: '#415637',
          900: '#2c3925',
          950: '#161d12',
        },
        lm: {
          canvas: '#F8F8F4',
          card: '#EDF2E8',
          raised: '#ffffff',
          inset: '#EDF2E8',
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
          '0 1px 2px rgb(34 34 34 / 0.04), 0 8px 28px -8px rgb(107 142 90 / 0.1)',
        'lm-raised':
          '0 1px 2px rgb(34 34 34 / 0.05), 0 2px 10px -3px rgb(107 142 90 / 0.08)',
        'lm-nav': '0 -4px 24px -4px rgb(107 142 90 / 0.1)',
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

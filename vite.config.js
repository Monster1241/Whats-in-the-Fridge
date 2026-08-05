import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) return 'firebase';
            if (id.includes('html5-qrcode')) return 'html5-qrcode';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('react-dom') || id.includes('/react/')) return 'react-vendor';
            return undefined;
          }
          if (
            id.includes('productCatalog') ||
            id.includes('recipeCatalog') ||
            id.includes('auStoreProductAliases')
          ) {
            return 'catalog-data';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});

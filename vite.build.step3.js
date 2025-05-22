import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Configuration for third build step - pages and business logic
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'client/dist',
    emptyOutDir: false, // Don't empty the output directory (preserve step 1 & 2 output)
    minify: true,
    sourcemap: false,
    // Focus on pages and business logic in this step
    rollupOptions: {
      input: {
        pages: path.resolve(__dirname, 'src/pages/index.ts'),
      },
      output: {
        manualChunks: {
          'vendor-app': [
            '@tanstack/react-query',
            'axios',
            'i18next',
            'react-i18next'
          ]
        }
      }
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
});
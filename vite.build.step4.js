import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Configuration for fourth build step - icons and remaining assets
export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'client'),
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Don't empty the output directory (preserve previous steps)
    minify: true,
    sourcemap: false,
    // Focus on icons and remaining assets in this step
    rollupOptions: {
      input: {
        icons: path.resolve(__dirname, 'client/src/main.tsx'),
      },
      output: {
        manualChunks: {
          'vendor-icons': [
            'lucide-react',
            'react-icons',
          ]
        }
      }
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
      '@components': path.resolve(__dirname, 'client/src/components'),
      '@lib': path.resolve(__dirname, 'client/src/lib'),
      '@pages': path.resolve(__dirname, 'client/src/pages'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
});
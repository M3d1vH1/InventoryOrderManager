import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Configuration for fourth build step - icons and remaining assets
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'client/dist',
    emptyOutDir: false, // Don't empty the output directory (preserve previous steps)
    minify: true,
    sourcemap: false,
    // Focus on icons and remaining assets in this step
    rollupOptions: {
      input: {
        icons: path.resolve(__dirname, 'src/components/icons/index.ts'),
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
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
});
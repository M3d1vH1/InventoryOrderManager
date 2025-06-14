import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Configuration for second build step - UI components
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'client/dist',
    emptyOutDir: false, // Don't empty the output directory (preserve step 1 output)
    minify: true,
    sourcemap: false,
    // Focus on UI components in this step
    rollupOptions: {
      input: {
        ui: path.resolve(__dirname, 'src/components/ui/index.ts'),
      },
      output: {
        manualChunks: {
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-select',
            '@radix-ui/react-toast',
          ],
          'vendor-form': [
            '@radix-ui/react-checkbox',
            '@radix-ui/react-radio-group'
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
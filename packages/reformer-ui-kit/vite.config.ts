/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import path, { resolve } from 'path';

export default defineConfig({
  plugins: [react(), dts({ insertTypesEntry: true })],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        // 'form-array': resolve(__dirname, 'src/components/form-array/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@reformer/core',
        '@reformer/cdk',
        '@radix-ui/react-select',
        '@radix-ui/react-slot',
        'class-variance-authority',
        'clsx',
        'lucide-react',
        'tailwind-merge',
      ],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

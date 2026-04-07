/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), dts({ insertTypesEntry: true })],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'form-array': resolve(__dirname, 'src/components/form-array/index.ts'),
        'form-wizard': resolve(__dirname, 'src/components/form-wizard/index.ts'),
        'form-field': resolve(__dirname, 'src/components/form-field/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@reformer/core',
        '@reformer/core/validators',
      ],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});

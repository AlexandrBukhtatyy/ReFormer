/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [dts({ insertTypesEntry: true })],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        validators: resolve(__dirname, 'src/core/validation/index.ts'),
        behaviors: resolve(__dirname, 'src/core/behavior/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'uuid'],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});

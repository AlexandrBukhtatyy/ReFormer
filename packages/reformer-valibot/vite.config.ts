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
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['@reformer/core', '@reformer/core/validators', 'valibot'],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});

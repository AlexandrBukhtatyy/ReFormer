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
        // Re-export files that import from index to ensure single module instance
        // This prevents static registry isolation (BehaviorRegistry.contextStack, ValidationRegistry.registryStack)
        validators: resolve(__dirname, 'src/validators.ts'),
        behaviors: resolve(__dirname, 'src/behaviors.ts'),
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

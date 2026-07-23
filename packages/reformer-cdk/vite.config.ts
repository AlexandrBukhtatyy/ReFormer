/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

// Тесты живут рядом с исходниками — в dist их декларации не нужны и уезжают в npm.
const TEST_FILES = ['**/*.test.ts', '**/*.test.tsx'];

export default defineConfig({
  plugins: [react(), dts({ insertTypesEntry: true, exclude: TEST_FILES })],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'async-boundary': resolve(__dirname, 'src/components/async-boundary/index.ts'),
        'form-array': resolve(__dirname, 'src/components/form-array/index.ts'),
        'form-wizard': resolve(__dirname, 'src/components/form-wizard/index.ts'),
        'form-field': resolve(__dirname, 'src/components/form-field/index.ts'),
        'file-upload': resolve(__dirname, 'src/components/file-upload/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@reformer/core',
        '@reformer/core/state',
        '@reformer/core/validators',
      ],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});

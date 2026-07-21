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
        // Отдельная точка входа: тянет ajv, поэтому изолирована от основного бандла
        // (экспортируется как `@reformer/renderer-json/validate`).
        validate: resolve(__dirname, 'src/validate.ts'),
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
        '@reformer/renderer-react',
        '@reformer/ui-kit',
      ],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});

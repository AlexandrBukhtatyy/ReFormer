/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

// Тесты живут рядом с исходниками — в dist их декларации не нужны.
const TEST_FILES = ['**/*.test.ts', '**/*.test.tsx'];

// external — предикат: Rollup сравнивает элементы массива `external` со спецификатором целиком.
const EXTERNAL: RegExp[] = [/^@reformer\//, /^eta($|\/)/];

export default defineConfig({
  plugins: [dts({ insertTypesEntry: true, exclude: TEST_FILES })],
  build: {
    lib: {
      entry: { index: resolve(__dirname, 'src/index.ts') },
      formats: ['es'],
    },
    rollupOptions: {
      external: (id) => EXTERNAL.some((re) => re.test(id)),
      output: { entryFileNames: '[name].js' },
    },
  },
});

/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

// Тесты живут рядом с исходниками — в dist их декларации не нужны.
const TEST_FILES = ['**/*.test.ts', '**/*.test.tsx'];

// external — ПРЕДИКАТ, а не перечисление строк: Rollup сравнивает элементы массива `external`
// со спецификатором ЦЕЛИКОМ, поэтому 'react' не покрывает 'react/jsx-runtime'. Всё внешнее —
// peer-зависимости: вторая копия RJSF или ядра в теме разъехалась бы с копией приложения.
const EXTERNAL: RegExp[] = [/^react($|\/)/, /^@rjsf\//, /^@reformer\//];

export default defineConfig({
  plugins: [dts({ insertTypesEntry: true, exclude: TEST_FILES })],
  esbuild: { jsx: 'automatic' },
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

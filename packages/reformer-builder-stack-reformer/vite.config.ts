/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

// Тесты и фикстуры тестов живут рядом с исходниками — в dist их декларации не нужны.
// Фикстуры, которыми пользуются тесты ПОТРЕБИТЕЛЕЙ, отдаёт вход `./testing`.
const TEST_FILES = ['**/*.test.ts', '**/*.test.tsx'];

// external — ПРЕДИКАТ, а не перечисление строк: Rollup сравнивает элементы массива `external`
// со спецификатором ЦЕЛИКОМ, поэтому '@reformer/core' не покрывает '@reformer/core/signals'.
const EXTERNAL: RegExp[] = [/^@reformer\//, /^eta($|\/)/];

/** Модули стека — по входу на каждый: потребитель импортирует модуль, а не файл. */
const MODULES = [
  'form-model',
  'catalog',
  'kits',
  'codegen',
  'form-mock',
  'form-fixture',
  'form-inspect',
] as const;

export default defineConfig({
  plugins: [dts({ exclude: TEST_FILES })],
  build: {
    lib: {
      entry: {
        ...Object.fromEntries(
          MODULES.map((m) => [`${m}/index`, resolve(__dirname, `src/${m}/index.ts`)])
        ),
        testing: resolve(__dirname, 'src/testing.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: (id) => EXTERNAL.some((re) => re.test(id)),
      output: { entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js' },
    },
  },
});

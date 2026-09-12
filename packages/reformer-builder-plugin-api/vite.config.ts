/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

// Тесты живут рядом с исходниками — в dist их декларации не нужны и уезжали бы в npm.
const TEST_FILES = ['**/*.test.ts', '**/*.test.tsx'];

// external — ПРЕДИКАТ, а не перечисление строк: Rollup сравнивает элементы массива `external`
// со спецификатором ЦЕЛИКОМ, поэтому '@reformer/core' не покрывает '@reformer/core/signals'.
// Здесь зависимостей почти нет, но правило то же, что у соседних пакетов, и по той же причине.
const EXTERNAL: RegExp[] = [/^react($|\/)/, /^react-dom($|\/)/, /^@reformer\//];

export default defineConfig({
  plugins: [dts({ insertTypesEntry: true, exclude: TEST_FILES })],
  build: {
    lib: {
      entry: {
        // Контракт плагина: ровно то, чем плагин пользуется. Растёт по требованию.
        index: resolve(__dirname, 'src/index.ts'),
        // Платформенные примитивы ЦЕЛИКОМ — для оболочки билдера, а не для плагина.
        // Отдельный вход, потому что `.` обязан оставаться поверхностью плагина: попади
        // сюда путевая арифметика и помощники оболочки, «цена платформы видна в одном
        // файле» перестало бы что-либо значить.
        internal: resolve(__dirname, 'src/internal.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: (id) => EXTERNAL.some((re) => re.test(id)),
      output: { entryFileNames: '[name].js' },
    },
  },
});

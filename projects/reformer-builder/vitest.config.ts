/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Отдельный vitest-конфиг — без react/tailwind-плагинов из vite.config.ts.
 *
 * Юниты слоя `src/model/**` — чистые функции над JsonFormSchema, им не нужны ни
 * браузерное окружение, ни плагины сборки, поэтому окружение — `node`. Когда появятся
 * тесты React-компонентов, добавим отдельный проект с `jsdom`.
 *
 * NB: vitest 4 + node 20/24 имеет known hanging-on-exit bug (vitest-dev/vitest#8766);
 * npm-скрипт `test` идёт через `scripts/run-vitest.mjs`, который force-killit процесс.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

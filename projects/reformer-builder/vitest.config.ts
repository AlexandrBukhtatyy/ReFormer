/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Отдельный vitest-конфиг — без react/tailwind-плагинов из vite.config.ts.
 *
 * Ядро v2 (документы, реестры, операции над схемой) — чистые функции, им не нужны ни
 * браузерное окружение, ни плагины сборки, поэтому окружение — `node`.
 *
 * Тесты React-компонентов, вычисленного стиля и конструируемых таблиц живут в отдельном
 * прогоне — [vitest.browser.config.ts](vitest.browser.config.ts), файлы `*.browser.test.tsx`,
 * запуск `npm run test:browser`. Отдельный конфиг, а не проект здесь, ради одного свойства:
 * `npx vitest run` обязан остаться прогоном на 7-8 секунд, а объединение проектов превратило
 * бы каждый быстрый прогон в запуск Chromium. Почему браузер, а не jsdom, — в шапке того файла.
 *
 * NB: vitest 4 + node 20/24 имеет known hanging-on-exit bug (vitest-dev/vitest#8766);
 * npm-скрипт `test` идёт через `scripts/run-vitest.mjs`, который force-killit процесс.
 */
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});

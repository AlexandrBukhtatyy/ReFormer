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
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Порядок значим: подпуть обязан стоять ПЕРЕД корнем, иначе корневой псевдоним
      // съедает '/internal' и оболочка получает поверхность плагина вместо примитивов.
      '@reformer/builder-plugin-api/internal': path.resolve(
        __dirname,
        '../../packages/reformer-builder-plugin-api/src/internal.ts'
      ),
      '@reformer/builder-plugin-api': path.resolve(
        __dirname,
        '../../packages/reformer-builder-plugin-api/src/index.ts'
      ),
      // Пакеты стеков — в исходники тем же доводом. Подпуть стека адресует КАТАЛОГ модуля
      // (`/form-model` → `src/form-model/index.ts`), поэтому псевдоним — префикс, а не файл.
      '@reformer/builder-toolkit': path.resolve(
        __dirname,
        '../../packages/reformer-builder-toolkit/src/index.ts'
      ),
      '@reformer/builder-stack-reformer': path.resolve(
        __dirname,
        '../../packages/reformer-builder-stack-reformer/src'
      ),
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});

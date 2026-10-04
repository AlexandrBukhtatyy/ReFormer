/**
 * Интеграционный прогон домена: плагины домена вместе с НАСТОЯЩЕЙ оболочкой билдера.
 *
 * Такие тесты собирают приложение (`boot`), сессию проекта, вкладки и реестры из исходников
 * билдера и ставят в них плагины домена. Поэтому здесь, и только здесь, у пакета плагинов есть
 * алиас `@` на `projects/reformer-builder/src`: это зависимость теста от оболочки, в которой
 * плагин работает, а не кода плагина от неё. Сами плагины оболочку не импортируют.
 *
 * @module plugins/.shared/vitest.integration
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { sourceAliases } from './vitest';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Исходники оболочки: `.shared` → `plugins` → `.ui_builder` → проект → `projects`. */
const builderSrc = path.resolve(here, '../../../../reformer-builder/src');

const aliases = { '@': builderSrc, ...sourceAliases };

/** Тесты в node: состав, вклады, сессия проекта. */
export function integrationTestConfig() {
  return defineConfig({
    resolve: { alias: aliases },
    test: { environment: 'node', include: ['**/*.test.ts'], exclude: ['**/node_modules/**'] },
  });
}

/** Тесты в Chromium: оболочка рисует вклады плагинов домена. */
export function integrationBrowserTestConfig() {
  return defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom', 'radix-ui', '@preact/signals-core'],
      alias: aliases,
    },
    optimizeDeps: {
      include: [
        'highlight.js/lib/common',
        '@rjsf/core',
        '@rjsf/utils',
        '@rjsf/validator-ajv8',
        'date-fns',
        'react-day-picker',
      ],
    },
    test: {
      name: 'browser',
      include: ['**/*.browser.test.tsx'],
      exclude: ['**/node_modules/**'],
      setupFiles: [path.join(here, 'browser-setup.ts')],
      browser: {
        enabled: true,
        provider: playwright(),
        headless: true,
        instances: [{ browser: 'chromium' }],
        screenshotFailures: false,
      },
    },
  });
}

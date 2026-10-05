/**
 * Браузерный прогон пакета плагина: настоящий Chromium, React и CSS оболочки.
 *
 * Конфиг один на все пакеты — пакет зовёт {@link browserTestConfig} из своего
 * `vitest.browser.config.ts`. Набор тот же, что у браузерного прогона билдера: плагины до
 * переезда проверялись им, и условия проверки не должны были измениться вместе с адресом.
 *
 * @module plugins/.shared/vitest.browser
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { sourceAliases } from './vitest';

const here = path.dirname(fileURLToPath(import.meta.url));

export function browserTestConfig() {
  return defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
      // Одна копия на страницу: вторая копия React или сигналов — два мира, не видящих друг друга.
      dedupe: ['react', 'react-dom', 'radix-ui', '@preact/signals-core'],
      alias: sourceAliases,
    },
    optimizeDeps: {
      // Иначе Vite находит их посреди прогона и перезагружает страницу — тест падает «сам».
      include: [
        '@rjsf/core',
        '@rjsf/utils',
        '@rjsf/validator-ajv8',
        'date-fns',
        'react-day-picker',
      ],
    },
    test: {
      name: 'browser',
      include: ['src/**/*.browser.test.tsx'],
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

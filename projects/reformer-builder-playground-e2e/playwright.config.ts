import { defineConfig, devices } from '@playwright/test';
import { BUILDER_DIR, LAUNCH_CONFIG } from './tests/shared/paths';

/**
 * E2E билдера. Настройка — переменными окружения:
 *
 * - BUILDER_E2E_TARGET: что поднимать.
 *   `dev` (умолчание) — vite dev-сервер билдера: без сборки, правка исходников билдера видна
 *   следующим же прогоном.
 *   `dist` — собранный билдер под лаунчером (`bin/reformer-builder.mjs`), то есть ровно то, что
 *   получает человек из `npx reformer-builder`. Нужен готовый `projects/reformer-builder/dist`
 *   (`npm run build -w @reformer/builder`).
 * - BUILDER_E2E_PORT: порт сервера (умолчание 5184). 5173 занят react-playground, 5174 — dev
 *   билдера с конфигом самого разработчика; свой порт нужен, чтобы `reuseExistingServer`
 *   не подхватил билдер с чужим составом плагинов.
 * - BUILDER_E2E_BASE_URL: адрес уже запущенного билдера. Сервер тогда не поднимается вовсе.
 *
 * Конфиг запуска в обоих режимах один — `builder.launch.json` из playground. Тот же сервер
 * руками: `npm run builder -w reformer-builder-playground` (или `builder:dist`); запущенный
 * заранее, он переиспользуется прогоном.
 */
const TARGET = process.env.BUILDER_E2E_TARGET === 'dist' ? 'dist' : 'dev';
const PORT = parseInt(process.env.BUILDER_E2E_PORT || '5184', 10);
const EXTERNAL_BASE_URL = process.env.BUILDER_E2E_BASE_URL;
const BASE_URL = EXTERNAL_BASE_URL || `http://localhost:${PORT}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Тесты независимы: у каждого свой контекст браузера, а значит свои OPFS и IndexedDB. */
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['list'], ['html', { open: 'never' }]],
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  /* Только Chromium: File System Access, на котором стоит работа с проектом, есть лишь в нём. */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],

  ...(EXTERNAL_BASE_URL
    ? {}
    : {
        webServer: {
          command:
            TARGET === 'dist'
              ? `node bin/reformer-builder.mjs --config "${LAUNCH_CONFIG}" --host localhost --port ${PORT} --no-open`
              : `npm run dev -- --port ${PORT}`,
          cwd: BUILDER_DIR,
          // Лаунчеру конфиг назван флагом; dev-сервер читает его из переменной (vite.config.ts).
          env: TARGET === 'dist' ? {} : { REFORMER_BUILDER_CONFIG: LAUNCH_CONFIG },
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          // `npm run dev` сначала собирает корпус знаний ассистента (predev) — отсюда запас.
          timeout: 180_000,
        },
      }),
});

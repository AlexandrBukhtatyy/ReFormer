import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { BUILDER_DIR, PLAYGROUND_CONFIG, PLAYGROUND_DIR } from './tests/shared/paths';

/**
 * E2E билдера. Настройка — переменными окружения:
 *
 * - BUILDER_E2E_TARGET: что поднимать.
 *   `dev` (умолчание) — vite dev-сервер билдера: без сборки, правка исходников билдера видна
 *   следующим же прогоном.
 *   `dist` — собранный билдер под лаунчером (`bin/reformer-builder.mjs`), то есть ровно то, что
 *   получает человек из `npx reformer-builder`. Нужен готовый `projects/reformer-builder/dist`
 *   (`npm run build -w @reformer/builder`).
 *   `embedded` — билдер, встроенный в приложение: dev-сервер приложения-образца
 *   (`projects/reformer-builder-host-example`) над его копией. Свой набор тестов —
 *   `tests/embedded/`; остальные тесты в этой цели не идут, и наоборот.
 * - BUILDER_E2E_PORT: порт сервера (умолчание 5184, у `embedded` — 5185). 5173 занят
 *   react-playground, 5174 — dev билдера с конфигом самого разработчика; свой порт нужен, чтобы
 *   `reuseExistingServer` не подхватил билдер с чужим составом плагинов.
 * - BUILDER_E2E_BASE_URL: адрес уже запущенного билдера. Сервер тогда не поднимается вовсе.
 *
 * Конфиг запуска в режимах `dev` и `dist` один — `.ui_builder/config.json` playground: тот же
 * файл, что билдер читает ещё раз как конфиг проекта, открыв каталог. Тот же сервер руками:
 * `npm run builder -w reformer-builder-playground` (или `builder:dist`); запущенный заранее,
 * он переиспользуется прогоном.
 */
const TARGET =
  process.env.BUILDER_E2E_TARGET === 'dist'
    ? 'dist'
    : process.env.BUILDER_E2E_TARGET === 'embedded'
      ? 'embedded'
      : 'dev';
const EMBEDDED = TARGET === 'embedded';
const PORT = parseInt(process.env.BUILDER_E2E_PORT || (EMBEDDED ? '5185' : '5184'), 10);
const EXTERNAL_BASE_URL = process.env.BUILDER_E2E_BASE_URL;
const BASE_URL = EXTERNAL_BASE_URL || `http://localhost:${PORT}`;

/** Тесты встроенного билдера — только в своей цели: им нужен другой сервер. */
const EMBEDDED_TESTS = '**/embedded/**';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  ...(EMBEDDED ? { testMatch: `${EMBEDDED_TESTS}/*.spec.ts` } : { testIgnore: EMBEDDED_TESTS }),
  /* Плагины playground — пакеты со сборкой: билдер грузит её, поэтому она делается до тестов.
     Встроенному билдеру плагины раздаёт приложение, и готовит их сам его сервер. */
  globalSetup: EMBEDDED ? undefined : './tests/shared/global-setup.ts',
  /* Тесты независимы: у каждого свой контекст браузера, а значит свои OPFS и IndexedDB.
     У встроенного билдера общее есть — копия приложения на диске под его сервером: тесты
     правят её исходники, поэтому идут по одному. */
  fullyParallel: !EMBEDDED,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI || EMBEDDED ? 1 : undefined,
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
          // Лаунчер запускается В КАТАЛОГЕ playground и сам находит его `.ui_builder/config.json` —
          // раскладка «запустил в корне проекта и его же открыл». Dev-сервер живёт в каталоге
          // билдера, поэтому конфиг ему назван переменной (vite.config.ts).
          ...(TARGET === 'dist'
            ? {
                command: `node "${path.join(BUILDER_DIR, 'bin', 'reformer-builder.mjs')}" --host localhost --port ${PORT} --no-open`,
                cwd: PLAYGROUND_DIR,
              }
            : EMBEDDED
              ? {
                  // Сервер приложения-образца: сам собирает плагины билдера, копирует
                  // приложение и поднимает над копией его dev-сервер.
                  command: `node "${path.join(__dirname, 'tests', 'embedded', 'shared', 'serve-host.mjs')}" --port ${PORT}`,
                  cwd: __dirname,
                }
              : {
                  command: `npm run dev -- --port ${PORT}`,
                  cwd: BUILDER_DIR,
                  env: { REFORMER_BUILDER_CONFIG: PLAYGROUND_CONFIG },
                }),
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          // `npm run dev` сначала собирает корпус знаний ассистента (predev) — отсюда запас.
          // У встроенного билдера перед стартом сервера собираются плагины для поставки.
          timeout: EMBEDDED ? 600_000 : 180_000,
        },
      }),
});

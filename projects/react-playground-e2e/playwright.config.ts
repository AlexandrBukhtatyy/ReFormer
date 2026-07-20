import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * E2E test configuration via environment variables:
 * - E2E_PORT: Port for dev server (default: 5173)
 * - E2E_BASE_URL: Base URL for tests (default: http://localhost:${E2E_PORT})
 * - PERF_ENABLED: 'true' включает замеры производительности в e2e
 *   (POM оборачивает ключевые действия через PerformanceCollector,
 *   результаты пишутся в test-results/perf-summary.json и в консоль).
 *   По умолчанию — выключено, оверхед нулевой.
 * - ITER_MODE: 'on' включает режим итеративного MCP regression-testing
 *   (см. docs/iter-prompts/orchestrator.md). Активирует video recording
 *   и фиксированный viewport 1440×900 для предсказуемых скриншотов.
 *   Не влияет на обычные e2e — если не выставлен, поведение прежнее.
 * - ITER_OUTPUT_DIR: переопределяет outputDir для test-результатов
 *   (видео, traces). Используется sub-agent'ом, чтобы артефакты iter-N
 *   падали в .tmp/iter-artifacts/iter-N/<target>/playwright/ или подобный
 *   изолированный каталог.
 * - MCP_ITER_VERSION: номер итерации для shared abstract test runs против
 *   iter-форм. Активирует 3 dynamic projects (iter-core, iter-renderer-react,
 *   iter-renderer-json) с basePath = /mcp-credit-application-{target}-v${N}.
 *   Проекты используют тот же testDir что и complex-multy-step-form (POM +
 *   abstract specs reused). Запуск: MCP_ITER_VERSION=N npx playwright test
 *   --project=iter-{target}.
 */
const E2E_PORT = parseInt(process.env.E2E_PORT || '5173', 10);
const E2E_BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${E2E_PORT}`;
const PERF_ENABLED = process.env.PERF_ENABLED === 'true';
const ITER_MODE = process.env.ITER_MODE === 'on';
const ITER_OUTPUT_DIR = process.env.ITER_OUTPUT_DIR;
const MCP_ITER_VERSION = process.env.MCP_ITER_VERSION;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ...(process.env.CI
      ? ([
          ['list'],
          ['html', { open: 'never' }],
          ['junit', { outputFile: 'test-results/junit.xml' }],
        ] as const)
      : ([['dot'], ['html']] as const)),
    // Performance reporter — активен только при PERF_ENABLED=true,
    // иначе no-op. Агрегирует NDJSON от воркеров в perf-summary.json.
    ...(PERF_ENABLED ? ([[require.resolve('./tests/shared/performance-reporter')]] as const) : []),
  ],
  /* Expect timeout */
  expect: { timeout: 5000 },
  /* outputDir для артефактов — переопределяется через ITER_OUTPUT_DIR
     для изоляции iter-N runs от обычных e2e. */
  ...(ITER_OUTPUT_DIR ? { outputDir: ITER_OUTPUT_DIR } : {}),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: E2E_BASE_URL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* ITER mode: фиксированный viewport (предсказуемость fullPage скриншотов)
       + видео для walkthrough demo. Активно только при ITER_MODE=on,
       обычные e2e не затронуты. */
    ...(ITER_MODE
      ? {
          video: 'on' as const,
          viewport: { width: 1440, height: 900 },
        }
      : {}),
  },

  /* Configure projects for major browsers */
  projects: [
    // Complex Form - Chromium
    {
      name: 'complex-multy-step-form',
      testDir: './tests/pages/complex-multy-step-form',
      use: { ...devices['Desktop Chrome'] },
      metadata: { basePath: '/examples/complex', variant: 'compound' },
    },
    {
      name: 'complex-multy-step-form-renderer',
      testDir: './tests/pages/complex-multy-step-form',
      use: { ...devices['Desktop Chrome'] },
      metadata: { basePath: '/examples/complex-renderer', variant: 'renderer' },
    },
    // JSON variant - renders form from JSON schema via @reformer/renderer-json
    {
      name: 'complex-multy-step-form-json',
      testDir: './tests/pages/complex-multy-step-form',
      use: { ...devices['Desktop Chrome'] },
      metadata: { basePath: '/examples/json-renderer', variant: 'json' },
    },
    // Cross-browser for @critical
    {
      name: 'complex-form:firefox',
      testDir: './tests/pages/complex-multy-step-form',
      grep: /@critical/,
      use: { ...devices['Desktop Firefox'] },
      metadata: { basePath: '/examples/complex', variant: 'compound' },
    },
    {
      name: 'complex-form:webkit',
      testDir: './tests/pages/complex-multy-step-form',
      grep: /@critical/,
      use: { ...devices['Desktop Safari'] },
      metadata: { basePath: '/examples/complex', variant: 'compound' },
    },
    // Smoke tests — быстрая проверка критических путей
    {
      name: 'smoke',
      testDir: './tests/pages/complex-multy-step-form',
      grep: /@smoke/,
      use: { ...devices['Desktop Chrome'] },
      metadata: { basePath: '/examples/complex', variant: 'compound' },
    },
    // Regression tests — полный регрессионный прогон
    {
      name: 'regression',
      testDir: './tests/pages/complex-multy-step-form',
      grep: /@regression/,
      use: { ...devices['Desktop Chrome'] },
      metadata: { basePath: '/examples/complex', variant: 'compound' },
    },
    // Other pages
    {
      name: 'simple-form',
      testDir: './tests/pages/simple-form',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'validation',
      testDir: './tests/pages/validation',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'behaviors',
      testDir: './tests/pages/behaviors',
      use: { ...devices['Desktop Chrome'] },
    },
    // Императивные handle полей по селектору (schema.node(sel).getRef()).
    // Поведенческое доказательство: unit-тесты идут без DOM, реальные focus/open/toggle — только тут.
    {
      name: 'imperative-handles',
      testDir: './tests/pages/imperative-handles',
      use: { ...devices['Desktop Chrome'] },
    },
    // ITER abstract test projects — переиспользуют POM + spec файлы
    // complex-multy-step-form для прогона против iter-форм. Активны только
    // когда MCP_ITER_VERSION env установлен. См. docs/iter-prompts/orchestrator.md
    // и docs/plans/proud-pondering-jellyfish.md.
    ...(MCP_ITER_VERSION
      ? [
          {
            name: 'iter-core',
            testDir: './tests/pages/complex-multy-step-form',
            use: { ...devices['Desktop Chrome'] },
            metadata: {
              basePath: `/mcp-credit-application-core-v${MCP_ITER_VERSION}`,
              variant: 'compound' as const,
            },
          },
          {
            name: 'iter-renderer-react',
            testDir: './tests/pages/complex-multy-step-form',
            use: { ...devices['Desktop Chrome'] },
            metadata: {
              basePath: `/mcp-credit-application-renderer-react-v${MCP_ITER_VERSION}`,
              variant: 'renderer' as const,
            },
          },
          {
            name: 'iter-renderer-json',
            testDir: './tests/pages/complex-multy-step-form',
            use: { ...devices['Desktop Chrome'] },
            metadata: {
              basePath: `/mcp-credit-application-renderer-json-v${MCP_ITER_VERSION}`,
              variant: 'json' as const,
            },
          },
        ]
      : []),
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: `npm run dev -- --port ${E2E_PORT}`,
    port: E2E_PORT,
    cwd: path.resolve(__dirname, '../react-playground'),
    reuseExistingServer: !process.env.CI,
  },
});

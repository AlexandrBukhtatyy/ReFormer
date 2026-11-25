/**
 * Playwright для бенчмарка форм.
 *
 * - conformance — паритет поведения реализаций (контрольные точки, вызовы API, payload);
 * - calibration — проверка счётчика рендеров на странице с известными числами;
 * - bench — профилирование; зависит от первых двух: без паритета и рабочего счётчика чисел нет.
 *
 * Замеры: один воркер, без ретраев, новый headless Chromium (`channel: 'chromium'`), флаги против
 * фонового троттлинга таймеров и рендерера. Страницы — prod-сборки из forms-benchmark/dist
 * (`npm run bench:build -w forms-benchmark`), сервер — его scripts/serve.mjs.
 */
import { defineConfig } from '@playwright/test';
import { SUITE_ID, suite } from './lib/suite';

const PORT = Number(process.env.BENCH_PORT ?? 4180);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: 'chromium',
    headless: process.env.BENCH_HEADED !== '1',
    // Высокий viewport: шаг формы целиком на экране, скролл не участвует в замерах.
    viewport: { width: 1280, height: 1600 },
    deviceScaleFactor: 1,
    // Локаль и пояс закреплены: от локали зависит путь кода (RJSF выбирает контрол числа по
    // Intl-формату — при ru-RU это текстовое поле), от пояса — даты. Результат не должен зависеть
    // от машины.
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: [
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-extensions',
        '--no-first-run',
      ],
    },
  },
  projects: [
    { name: 'conformance', testDir: './tests/conformance', timeout: 60_000 },
    { name: 'calibration', testDir: './tests/calibration', timeout: 60_000 },
    {
      name: 'bench',
      testDir: './tests/bench',
      testMatch: '**/*.bench.ts',
      // Набор стеков (BENCH_SUITE=frameworks): паритет — сценарии кросс-e2e на тех же prod-сборках
      // (npm run bench:frameworks из корня открытой части), счётчика рендеров нет — зависимостей нет.
      dependencies:
        process.env.BENCH_NO_DEPS === '1' || SUITE_ID !== 'libraries'
          ? []
          : ['conformance', 'calibration'],
      // Один тест на форму идёт десятки минут; прогоны пишутся по ходу, сбой прогона ловится.
      timeout: 0,
    },
  ],
  webServer: {
    command: 'npm run serve',
    cwd: '../forms-benchmark',
    url: `http://127.0.0.1:${PORT}/${suite.buildInfo}`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) },
    timeout: 30_000,
  },
});

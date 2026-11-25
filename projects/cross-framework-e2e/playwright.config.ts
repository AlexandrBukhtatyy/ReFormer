/**
 * Playwright для кросс-фреймворк проверки: одна форма ReFormer в React, Vue и Angular.
 *
 * Проект — пара `<форма>:<стек>`: спек формы один, стеки различаются адресом хоста. Сценарии и POM
 * — те же, что у conformance бенчмарка форм (../forms-benchmark-e2e/scenarios, ../forms-benchmark-e2e/pom):
 * они знают только DOM-контракт (./DOM-CONTRACT.md) и `window.__bench`.
 *
 * Хосты — dev-серверы playground'ов, каждый на своём порту (./stacks.ts); `CROSS_STACKS` оставляет
 * часть стеков. Настройки браузера — как у conformance: тот же viewport, локаль и пояс.
 */
import { defineConfig } from '@playwright/test';
import { pageUrl, selectedStacks, stackOrigin } from './stacks';

const stacks = selectedStacks();

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    channel: 'chromium',
    headless: process.env.CROSS_HEADED !== '1',
    // Высокий viewport: форма целиком на экране, сценарии не скроллят.
    viewport: { width: 1280, height: 1600 },
    deviceScaleFactor: 1,
    // Локаль и пояс закреплены: результат не должен зависеть от машины.
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  projects: stacks.flatMap((stack) =>
    stack.forms.map((form) => ({
      name: `${form}:${stack.id}`,
      testMatch: `${form}.spec.ts`,
      timeout: 60_000,
      metadata: { stack: stack.id },
      use: { baseURL: stackOrigin(stack) },
    }))
  ),
  webServer: stacks.map((stack) => ({
    command: stack.command,
    cwd: stack.host,
    url: pageUrl(stack, stack.forms[0]),
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  })),
});

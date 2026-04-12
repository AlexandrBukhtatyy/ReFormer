import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * E2E test configuration via environment variables:
 * - E2E_PORT: Port for dev server (default: 5173)
 * - E2E_BASE_URL: Base URL for tests (default: http://localhost:${E2E_PORT})
 */
const E2E_PORT = parseInt(process.env.E2E_PORT || '5173', 10);
const E2E_BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${E2E_PORT}`;

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
  reporter: 'html',
  /* Expect timeout */
  expect: { timeout: 5000 },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: E2E_BASE_URL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
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
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: `npm run dev -- --port ${E2E_PORT}`,
    port: E2E_PORT,
    cwd: path.resolve(__dirname, '../react-playground'),
    reuseExistingServer: !process.env.CI,
  },
});

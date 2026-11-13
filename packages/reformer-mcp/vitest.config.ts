import { configDefaults, defineConfig } from 'vitest/config';

/**
 * Прогон в Node. Браузерные тесты (`*.browser.test.ts`) — отдельным прогоном в настоящих
 * браузерах: [vitest.browser.config.ts](vitest.browser.config.ts), `npm run test:browser`.
 */
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/*.browser.test.ts'],
  },
});

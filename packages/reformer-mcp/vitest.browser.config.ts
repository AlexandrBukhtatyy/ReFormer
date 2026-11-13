import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/**
 * Прогон в настоящих браузерах: то, что в Node не проверить, — браузерная песочница Code Mode
 * (Worker в изолированном iframe). Три движка: граница песочницы — origin и CSP, а их каждый
 * браузер проводит сам.
 */
export default defineConfig({
  // `typescript` снимает типы в контрактном тесте и приезжает импортом: без предзаготовки Vite
  // переоптимизирует зависимости посреди прогона.
  optimizeDeps: { include: ['typescript'] },
  test: {
    name: 'browser',
    include: ['tests/**/*.browser.test.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
      screenshotFailures: false,
    },
  },
});

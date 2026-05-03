/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';

/**
 * Отдельный vitest config — без `vite-plugin-dts` из общего vite.config.ts.
 *
 * vite-plugin-dts оставляет fs-watcher активным после прогона; вынос
 * test-config в отдельный файл изолирует vitest от плагинов сборки.
 *
 * NB: Помимо этого, vitest 4 + node 20/24 имеет известный hanging-on-exit bug
 * (vitest-dev/vitest#8766). Use `scripts/run-vitest.mjs` wrapper в package.json
 * "test" script — он force-killit процесс после passing all tests.
 */
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/index.ts', 'src/**/*.d.ts'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});

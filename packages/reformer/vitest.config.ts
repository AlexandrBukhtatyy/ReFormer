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
      // Барели и чисто типовые модули после стирания типов пусты: на итоговый процент они не
      // влияют (0 statements — ни в числителе, ни в знаменателе), но занимают строки в отчёте
      // с нулями. Исключены ради читаемости таблицы.
      exclude: [
        'src/**/index.ts',
        'src/**/*.d.ts',
        'src/form/types/**',
        'src/form/hooks/types.ts',
        'src/state/types.ts',
      ],
      // Пороги = ФАКТИЧЕСКОЕ покрытие на момент включения гейта (79.87 / 71.4 / 80.85 / 81.17)
      // с запасом вниз на дрожание v8, а не целевые 80%. Раньше здесь стояли 80% по всем
      // метрикам, но провайдера @vitest/coverage-v8 не было ни в одном package.json и CI
      // покрытие не гонял — гейт существовал только на бумаге и `vitest --coverage` падал.
      // Задача гейта — ловить РЕГРЕСС. Доведение до 80% отдельно: основной недобор в
      // src/form/hooks (React-хуки почти не покрыты, 44%) и в валидаторах без своих тестов.
      thresholds: {
        statements: 79,
        branches: 71,
        functions: 80,
        lines: 81,
      },
    },
  },
});

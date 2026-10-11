/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';

/**
 * Отдельный vitest config — без `vite-plugin-dts` из общего vite.config.ts.
 *
 * vite-plugin-dts оставляет fs-watcher активным после прогона; вынос
 * test-config в отдельный файл изолирует vitest от плагинов сборки.
 *
 * NB: Помимо этого, vitest 4 + node 20/24 имеет известный hanging-on-exit bug
 * (vitest-dev/vitest#8766). Скрипты `test` и `coverage` в package.json идут через обёртку
 * `scripts/run-vitest.mjs` — она завершает процесс после итогов прогона.
 *
 * Окружение по умолчанию — node. DOM-тесты (React-хуки) включают happy-dom комментарием
 * `// @vitest-environment happy-dom` в первой строке файла — см. tests/README.md.
 */
export default defineConfig({
  test: {
    // `vi.stubEnv` (prod-ветки) откатывается после каждого теста сам.
    unstubEnvs: true,
    // Сценарии на заявке, свойства fast-check и 50 циклов сборки под покрытием идут до 3 с на
    // рабочей машине; на CI-раннере стандартных 5 с не хватает. Зависший тест всё равно упадёт.
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      // json-summary — вход проверки минимума покрытия на файл.
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      // Типовые модули после стирания типов пусты: на итоговый процент они не влияют
      // (0 statements), но занимают строки в отчёте. Барели (`index.ts`) больше не исключены:
      // чистые реэкспорты тоже дают 0 statements, а `locale/index.ts` с логикой попадает в отчёт.
      exclude: [
        'src/**/*.d.ts',
        // Compile-time проверки типов: исполняет их `tsc`, а не vitest.
        'src/**/*.type-test.ts',
        // Тесты рядом с исходником.
        'src/**/*.test.{ts,tsx}',
        'src/form/types/**',
        'src/platforms/react/hooks/types.ts',
        'src/model/types.ts',
      ],
      // Агрегатные пороги — храповик: после каждого этапа плана тестов
      // (docs/plans/core-tests-coverage.md) поднимаются до (замер − 1…2 п.п.). Задача — ловить
      // регресс. Замер до плана: 91.58 / 88.47 / 94.07 / 93.01; после этапа 0 (2026-10-10):
      // 92.25 / 88.73 / 94.67 / 93.79; после этапов 1, 2, 3 и 7: 95.70 / 95.12 / 95.74 / 96.27;
      // после этапов 4, 5, 6, 8 и 10a: 99.92 / 99.63 / 100 / 100; после этапов 9, 10b–10d и 11
      // (2026-10-11): 99.92 / 99.63 / 100 / 100 — не покрыты шесть защитных ветвей из 1642.
      // Минимум на файл — отдельный гейт: coverage.per-file.json.
      thresholds: {
        statements: 98,
        branches: 98,
        functions: 99,
        lines: 99,
      },
    },
  },
});

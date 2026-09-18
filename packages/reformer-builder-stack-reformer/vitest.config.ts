/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';

/**
 * Домен стека — чистые функции без DOM, поэтому окружение `node`.
 *
 * Прогон отдельный от билдера намеренно: пакет обязан проверяться САМ, без приложения
 * вокруг. Соседний `@reformer/builder-toolkit` берётся из его `dist`, как у всех пакетов
 * монорепозитория: CI собирает его раньше (см. `.github/workflows/test.yml`).
 */
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});

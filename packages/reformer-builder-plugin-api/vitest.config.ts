/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';

/**
 * Примитивы контракта — чистые функции без DOM, поэтому окружение `node`.
 *
 * Прогон отдельный от билдера намеренно: пакет обязан проверяться САМ, без приложения вокруг.
 * Иначе «контракт независим от билдера» держалось бы на одном лишь каталоге.
 */
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});

/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';

/**
 * Чистые функции без DOM, поэтому окружение `node`.
 *
 * Прогон отдельный от билдера намеренно: пакет обязан проверяться САМ. Иначе «нейтральный
 * слой не зависит ни от стека, ни от приложения» держалось бы на одном лишь каталоге.
 */
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});

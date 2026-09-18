/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';

/**
 * Чистые функции без DOM, поэтому окружение `node`. Прогон отдельный от билдера: пакет стека
 * обязан проверяться сам, иначе «стек не знает ни ReFormer, ни приложения» держалось бы
 * на одном лишь каталоге.
 */
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});

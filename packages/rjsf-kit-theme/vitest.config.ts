/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';

/**
 * Окружение `node`: тема проверяется разметкой серверного рендера (`react-dom/server`) и прямым
 * вызовом моста — DOM для этого не нужен. Живые события полей кита проверяет браузерный тест
 * поверхности RJSF в билдере.
 */
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
});

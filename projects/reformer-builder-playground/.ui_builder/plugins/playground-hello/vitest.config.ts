import { defineConfig } from 'vitest/config';

// Тесты плагина — в node: они проверяют сам плагин (идентификатор, вклады), а не оболочку.
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});

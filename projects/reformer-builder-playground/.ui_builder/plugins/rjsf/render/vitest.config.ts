import { defineConfig } from 'vitest/config';
import { sourceAliases } from '../../.shared/vitest';

// Тесты плагина — в node: они проверяют вклады плагина, а не отрисовку.
export default defineConfig({
  resolve: { alias: sourceAliases },
  // У плагина пока только браузерные тесты поверхности — пустой прогон не отказ.
  test: { environment: 'node', include: ['src/**/*.test.ts'], passWithNoTests: true },
});

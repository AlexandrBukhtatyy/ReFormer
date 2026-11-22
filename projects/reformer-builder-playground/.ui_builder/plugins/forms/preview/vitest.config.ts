import { defineConfig } from 'vitest/config';
import { sourceAliases } from '../../.shared/vitest';

// Тесты плагина — в node: своего интерфейса у превью-хоста нет.
export default defineConfig({
  resolve: { alias: sourceAliases },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});

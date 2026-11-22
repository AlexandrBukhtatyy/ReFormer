import { defineConfig } from 'vitest/config';
import { sourceAliases } from '../../.shared/vitest';

// Тесты плагина — в node: разбор markdown, пути картинок, состояние вида, состав вкладов.
export default defineConfig({
  resolve: { alias: sourceAliases },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});

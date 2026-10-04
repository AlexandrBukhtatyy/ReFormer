import { defineConfig } from 'vitest/config';
import { sourceAliases } from '../../.shared/vitest';

// Тесты плагина — в node: они проверяют вклады, команды и модель, а не отрисовку.
export default defineConfig({
  resolve: { alias: sourceAliases },
  test: { environment: 'node', include: ['src/**/*.test.ts'], passWithNoTests: true },
});

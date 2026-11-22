import { defineConfig } from 'vitest/config';
import { sourceAliases } from '../../.shared/vitest';

// Тесты плагина — в node: реестр китов, служба, вклады.
export default defineConfig({
  resolve: { alias: sourceAliases },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});

import { defineConfig } from 'vitest/config';
import { sourceAliases } from '../../.shared/vitest';

// Ядро домена — чистые функции: тесты в node.
export default defineConfig({
  resolve: { alias: sourceAliases },
  test: { environment: 'node', include: ['**/*.test.ts'] },
});

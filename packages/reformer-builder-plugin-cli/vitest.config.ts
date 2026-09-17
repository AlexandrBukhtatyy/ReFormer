/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';

/**
 * CLI работает под Node и с файловой системой — окружение `node`, каталоги во временной папке ОС.
 */
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});

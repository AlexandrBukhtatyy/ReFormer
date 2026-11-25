/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

// Тесты в dist не нужны: их декларации уехали бы в npm.
const TEST_FILES = ['**/*.test.ts', 'tests/**'];

export default defineConfig({
  plugins: [dts({ insertTypesEntry: true, include: ['src'], exclude: TEST_FILES })],
  build: {
    lib: {
      entry: { index: resolve(__dirname, 'src/index.ts') },
      formats: ['es'],
    },
    rollupOptions: {
      // Vue и ядро — внешние: вторая копия Vue в приложении рвёт реактивность и provide/inject,
      // вторая копия ядра — реестр нод и сигналы. Подпути ядра — правилом, а не перечислением:
      // rollup сравнивает строки списка со спецификатором точно.
      external: ['vue', /^@reformer\//],
      output: { entryFileNames: '[name].js' },
    },
  },
});

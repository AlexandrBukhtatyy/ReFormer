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
      // Vue, Vuetify и пакеты ReFormer — внешние: вторая копия Vue рвёт реактивность и
      // provide/inject, вторая копия Vuetify — его плагин и настройки по умолчанию, вторая копия
      // ядра — реестр нод и сигналы. Подпути — правилом: rollup сравнивает строки точно.
      external: ['vue', 'vuetify', /^vuetify\//, /^@reformer\//],
      output: { entryFileNames: '[name].js' },
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // Vuetify импортирует свои стили из модулей компонентов: без сборки Vite Node их не загрузит.
    server: { deps: { inline: ['vuetify'] } },
  },
});

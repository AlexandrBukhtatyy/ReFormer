/// <reference types="vitest" />

import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vitest/config';

// Компоненты в тестах компилирует компилятор Angular (плагин Analog): входы-сигналы `input()`
// без него компонент не объявляет. Zone.js в тестах нет — приложение без зоны.
export default defineConfig({
  plugins: [angular({ tsconfig: './tsconfig.spec.json' })],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
  },
});

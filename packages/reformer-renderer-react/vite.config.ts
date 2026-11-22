/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

// Тесты живут рядом с исходниками — в dist их декларации не нужны и уезжают в npm.
const TEST_FILES = ['**/*.test.ts', '**/*.test.tsx'];

export default defineConfig({
  plugins: [react(), dts({ insertTypesEntry: true, exclude: TEST_FILES })],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        // 'form-array': resolve(__dirname, 'src/components/form-array/index.ts'),
        // 'form-wizard': resolve(__dirname, 'src/components/form-wizard/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        // Правило, а не перечисление подпутей (как в cdk, ui-kit и renderer-json): rollup сравнивает
        // строки списка со спецификатором ТОЧНО, и подпуть, которого в списке нет, попадает в dist
        // второй копией модуля. Для `@reformer/core/i18n` это вторая копия React-контекста
        // локализации — провайдер приложения перестал бы доходить до рендерера молча.
        // Страж: scripts/check-i18n-singleton.mjs.
        /^@reformer\//,
      ],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});

/// <reference types="vite/client" />

/**
 * Сборка клиента встраивания — того, что приложение импортирует из `@reformer/builder`.
 *
 * Отдельный конфиг, а не часть `vite.config.ts`: тот собирает SPA билдера (`dist/`, базовый
 * адрес, раскладка чанков, Tailwind, псевдонимы исходников), а клиент — библиотека на React,
 * которую компилирует НЕ приложение: ему достаются готовые ES-модули и объявления типов.
 *
 * Выход — `client/`, а не `dist/`: сборка SPA чистит `dist/` целиком, а лаунчер и плагин
 * dev-сервера раздают его как интерфейс билдера. Объявления пишет `vite-plugin-dts` по своему
 * `tsconfig.client.json` (у `tsconfig.app.json` — `noEmit`).
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Тесты лежат рядом с исходниками — в поставку их объявления не нужны (как в cdk). */
const TEST_FILES = ['**/*.test.ts', '**/*.test.tsx'];

/** Внешнее — только React, включая `react/jsx-runtime`: предикат, а не список (как в form-registry). */
const EXTERNAL: readonly RegExp[] = [/^react($|\/)/, /^react-dom($|\/)/];

export default defineConfig({
  plugins: [
    react(),
    dts({ tsconfigPath: './tsconfig.client.json', entryRoot: 'src/client', exclude: TEST_FILES }),
  ],
  // `public/vite.svg` — иконка SPA; библиотечный режим публичный каталог тоже копирует.
  publicDir: false,
  build: {
    outDir: 'client',
    emptyOutDir: true,
    lib: {
      entry: {
        index: path.resolve(here, 'src/client/index.ts'),
        // Заглушка для прод-сборки приложения — отдельным входом, чтобы псевдоним плагина
        // вёл на модуль без единого байта настоящего клиента.
        noop: path.resolve(here, 'src/client/noop.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: (id) => EXTERNAL.some((pattern) => pattern.test(id)),
      output: { entryFileNames: '[name].js' },
    },
  },
});

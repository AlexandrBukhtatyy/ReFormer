/// <reference types="vite/client" />

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const VIRTUAL_ENTRY = 'virtual:bench-entry';

/**
 * Один HTML-шаблон на все страницы: `index.html` импортирует `virtual:bench-entry`, а модуль за ним
 * выбирается переменной `BENCH_ENTRY` (путь к `main.tsx` от корня проекта). Её выставляет
 * `scripts/build-entries.mjs` перед каждой отдельной сборкой — так у каждой страницы свой
 * tree-shaking и свои чанки. Без переменной (dev-сервер) вход — роутер по URL.
 *
 * Переменная читается в `resolveId`, а не при создании плагина: JS API vite в одном процессе
 * собирает входы по очереди, и значение должно браться на момент сборки.
 */
function benchEntry(): Plugin {
  return {
    name: 'bench-entry',
    resolveId(id) {
      if (id !== VIRTUAL_ENTRY) return null;
      const entry = process.env.BENCH_ENTRY ?? 'src/dev/dev-router.tsx';
      return path.resolve(__dirname, entry);
    },
  };
}

export default defineConfig({
  plugins: [react(), benchEntry()],
  resolve: {
    // Одна копия рантаймов на всё дерево при workspace-линках @reformer/*.
    dedupe: ['react', 'react-dom', '@preact/signals-core'],
  },
  build: {
    // Карты нужны для атрибуции байтов по пакетам; `hidden` — без комментария-ссылки в бандле.
    sourcemap: 'hidden',
    manifest: true,
    reportCompressedSize: false,
  },
});

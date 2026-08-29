/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 5173 занят билдером v1: пока v2 не достиг паритета, оба нужны одновременно —
    // сравнивать поведение приходится бок о бок, а не по очереди.
    port: 5174,
    strictPort: true,
  },
  resolve: {
    // Дедупликация singleton-рантаймов при workspace-линке: одна копия React, Radix и
    // @preact/signals-core на всё дерево (иначе `instanceof Signal` / контекст Radix ломаются).
    dedupe: ['react', 'react-dom', 'radix-ui', '@preact/signals-core'],
    alias: { '@': path.resolve(__dirname, './src') },
  },
});

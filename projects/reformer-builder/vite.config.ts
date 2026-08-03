/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  // Prod-сборка для GitHub Pages идёт в подкаталог /ReFormer/builder/, поэтому base
  // задаётся через env (BUILDER_BASE) в CI. Локально (dev, preview) остаётся `/`.
  base: process.env.BUILDER_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    // Дедупликация singleton-рантаймов при workspace-линке: одна копия React, Radix и
    // @preact/signals-core на всё дерево (иначе `instanceof Signal` / контекст Radix ломаются).
    dedupe: [
      'react',
      'react-dom',
      '@radix-ui/react-select',
      '@radix-ui/react-slot',
      '@preact/signals-core',
    ],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { scopeKitCss } from './vite-plugins/scope-kit-css';

/** Контейнер, которым `KitProvider` кита оборачивает поддерево превью (см. `styles.mode: 'standalone'`). */
const KIT_SCOPE = '.rb-kit-scope';

// https://vite.dev/config/
export default defineConfig({
  // Prod-сборка для GitHub Pages идёт в подкаталог /ReFormer/builder/, поэтому base
  // задаётся через env (BUILDER_BASE) в CI. Локально (dev, preview) остаётся `/`.
  base: process.env.BUILDER_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  css: {
    postcss: {
      plugins: [
        // Киты со своим ресетом (CSS-in-JS дизайн-системы) приносят правила на html/body/*, которые
        // перекрашивают оболочку билдера. Ограничиваем их поддеревом превью; классовые селекторы
        // кита не трогаем — иначе содержимое порталов (выпадашки antd/Radix) останется без стилей.
        scopeKitCss({ scope: KIT_SCOPE, match: /node_modules\/@kaspersky\// }),
      ],
    },
  },
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

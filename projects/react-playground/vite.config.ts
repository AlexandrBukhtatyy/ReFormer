/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { mockServerPlugin } from './src/mocks/vite-plugin-mock-server';
import { swaggerUIPlugin } from './src/mocks/vite-plugin-swagger-ui';

// https://vite.dev/config/
const isStackBlitz = process.env.STACKBLITZ === 'true';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Swagger UI доступен по /api-docs
    swaggerUIPlugin(),
    // В режиме StackBlitz используем MSW middleware вместо Service Worker
    ...(isStackBlitz ? [mockServerPlugin()] : []),
  ],
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

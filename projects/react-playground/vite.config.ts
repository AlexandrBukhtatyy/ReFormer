/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { mockServerPlugin } from './src/mocks/vite-plugin-mock-server';
import { swaggerUIPlugin } from './src/mocks/vite-plugin-swagger-ui';

// https://vite.dev/config/
const isStackBlitz = process.env.STACKBLITZ === 'true';

// В StackBlitz @tailwindcss/vite тянет lightningcss при старте, который падает в WebContainers
// (нет нативных бинарей, а napi-wasm для WASM-фолбэка не установлен).
// В StackBlitz используем @tailwindcss/postcss — он не зависит от lightningcss.
const tailwindPlugin = isStackBlitz ? [] : [(await import('@tailwindcss/vite')).default()];

export default defineConfig({
  plugins: [
    react(),
    ...tailwindPlugin,
    // Swagger UI доступен по /api-docs
    swaggerUIPlugin(),
    // В режиме StackBlitz используем MSW middleware вместо Service Worker
    ...(isStackBlitz ? [mockServerPlugin()] : []),
  ],
  ...(isStackBlitz && {
    css: {
      postcss: { plugins: [(await import('@tailwindcss/postcss')).default()] },
    },
  }),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

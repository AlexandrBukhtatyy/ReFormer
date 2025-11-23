/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { mockServerPlugin } from './src/mocks/vite-plugin-mock-server';

// https://vite.dev/config/
const isStackBlitz = process.env.STACKBLITZ === 'true';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['module:@preact/signals-react-transform']],
      },
    }),
    tailwindcss(),
    // В режиме StackBlitz используем MSW middleware вместо Service Worker
    ...(isStackBlitz ? [mockServerPlugin()] : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

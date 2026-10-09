import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { reformerBuilder } from '@reformer/builder/vite';
import { applicationApi } from './server/application-api';

// https://vite.dev/config/
export default defineConfig({
  // `tailwindcss()` — приложения: его кит форм свёрстан утилитами. Билдеру он не нужен.
  //
  // `reformerBuilder()` — всё, что нужно билдеру от сборки приложения: он отдаёт билдер
  // с этого же dev-сервера, под адресом `/__reformer-builder/`. Приложение билдер
  // не компилирует — тот открывается своим документом, в рамке поверх страницы.
  plugins: [react(), tailwindcss(), applicationApi(), reformerBuilder()],
  server: {
    // 5173 — react-playground, 5174 — билдер в своей вкладке.
    port: 5175,
    strictPort: true,
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { builderHostResolve } from '@reformer/builder/vite/source-resolve.mjs';
import { applicationApi } from './server/application-api';

// https://vite.dev/config/
export default defineConfig({
  // `tailwindcss()` нужен и приложению (кит форм свёрстан утилитами), и билдеру: его стили
  // собирает сборщик приложения.
  plugins: [react(), tailwindcss(), applicationApi()],
  server: {
    // 5173 — react-playground, 5174 — билдер в своей вкладке.
    port: 5175,
    strictPort: true,
  },
  // Билдер собирается из исходников — библиотечной сборки у него пока нет. Всё, что для этого
  // нужно сборщику (псевдонимы исходников, вход под именем пакета, одна копия React), билдер
  // отдаёт сам. Своего псевдонима `@` у приложения поэтому нет: он занят билдером.
  resolve: builderHostResolve(),
});

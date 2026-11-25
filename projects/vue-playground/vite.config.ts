import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Компоненты здесь — `defineComponent` и `h()` в чистом TS, без SFC: плагин Vue не нужен. Флаги
// сборки Vue, которые обычно задаёт плагин, объявлены явно.
export default defineConfig({
  define: {
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
  resolve: {
    // Одна копия на всё дерево при workspace-линке: вторая копия Vue рвёт `provide` / `inject` и
    // реактивность, вторая копия сигналов — `instanceof Signal` и подписки ядра.
    dedupe: ['vue', '@preact/signals-core'],
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        registration: resolve(__dirname, 'cross/registration/index.html'),
        credit: resolve(__dirname, 'cross/credit/index.html'),
      },
    },
  },
});

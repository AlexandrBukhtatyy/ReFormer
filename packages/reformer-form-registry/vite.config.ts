/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

// Тесты живут рядом с исходниками — в dist их декларации не нужны и уезжают в npm.
const TEST_FILES = ['**/*.test.ts', '**/*.test.tsx'];

// external — ПРЕДИКАТ, а не перечисление строк.
//
// Rollup сравнивает элементы массива `external` со спецификатором ЦЕЛИКОМ, поэтому
// '@reformer/core' НЕ покрывает '@reformer/core/signals'. Именно так в renderer-json
// однажды уехала вторая копия рантайма @preact/signals-core со своим классом Signal:
// проверки `v instanceof Signal` сравнивались с чужим классом и всегда давали false,
// причём тесты этого не видели — ломался только собранный артефакт.
// Регулярка покрывает любой существующий и будущий subpath.
const EXTERNAL: RegExp[] = [
  /^react($|\/)/,
  /^react-dom($|\/)/,
  /^@reformer\//,
  /^@preact\/signals-core$/,
];

export default defineConfig({
  plugins: [react(), dts({ insertTypesEntry: true, exclude: TEST_FILES })],
  build: {
    lib: {
      entry: {
        // React-free ядро: типы, разрешение, реестр. Работает в vanilla-микрофронте.
        index: resolve(__dirname, 'src/index.ts'),
        // React-слой: провайдер, FormOutlet/FormSlot/FormRoute.
        react: resolve(__dirname, 'src/react/index.ts'),
        // Персистентный кэш: стратегии хранения. React-free, браузерные API — под фича-детектом.
        storage: resolve(__dirname, 'src/storage/index.ts'),
        // Валидация мета-схемой. ajv живёт ТОЛЬКО здесь — см. check-ajv-isolation.mjs.
        manifest: resolve(__dirname, 'src/manifest/index.ts'),
        // Guard от двойного рантайма. Нулевые зависимости — грузится раньше всего остального.
        guard: resolve(__dirname, 'src/guard/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: (id) => EXTERNAL.some((re) => re.test(id)),
      output: { entryFileNames: '[name].js' },
    },
  },
});

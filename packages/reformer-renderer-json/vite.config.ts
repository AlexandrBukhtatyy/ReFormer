/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

// Тесты живут рядом с исходниками — в dist их декларации не нужны и уезжают в npm.
const TEST_FILES = ['**/*.test.ts', '**/*.test.tsx'];

// external — ПРЕДИКАТ, а не перечисление строк (тот же приём, что в @reformer/ui-kit).
//
// Почему именно так: rollup сравнивает элементы массива `external` со спецификатором
// ТОЧНО, поэтому '@reformer/core' НЕ покрывает '@reformer/core/signals'. Пока список был
// перечислением, subpath `/signals` в нём отсутствовал — и rollup инлайнил в dist/index.js
// вторую копию рантайма @preact/signals-core вместе с собственным классом `Signal`.
// Проверки `v instanceof Signal` в locale/use-signal-value.ts сравнивались с ЧУЖИМ классом
// и всегда давали false: <I18n> с `$model(...)` рендерил объект вместо значения и терял
// реактивность. Тесты этого не видели (vitest резолвит один инстанс модуля), ломался
// только собранный артефакт.
//
// Регулярка /^@reformer\// покрывает любой существующий и будущий subpath любого пакета.
// @preact/signals-core здесь же — чтобы случайный прямой импорт стал внешним и его поймал
// `npm run check:dist-deps` (он не объявлен в манифесте), а не превратился в тихий дубль.
// ajv намеренно НЕ в списке: он бандлится в изолированную точку входа `validate`.
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
        index: resolve(__dirname, 'src/index.ts'),
        // Отдельная точка входа: тянет ajv, поэтому изолирована от основного бандла
        // (экспортируется как `@reformer/renderer-json/validate`).
        validate: resolve(__dirname, 'src/validate.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: (id) => EXTERNAL.some((re) => re.test(id)),
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});

/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

// Тесты живут рядом с исходниками — в dist их декларации не нужны и уезжают в npm.
const TEST_FILES = ['**/*.test.ts', '**/*.test.tsx'];

export default defineConfig({
  plugins: [dts({ insertTypesEntry: true, exclude: TEST_FILES })],
  // NB: конфиг тестов (включая coverage) живёт в vitest.config.ts — `scripts/run-vitest.mjs`
  // спавнит `vitest run` без --config, и штатное разрешение отдаёт победу ему. Дубль `test:`
  // здесь ни на что не влиял: правка порогов в этом файле не давала эффекта.
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        // Единая точка владения реактивным рантаймом (@preact/signals-core).
        // renderer-react и др. пакеты импортируют Signal отсюда → одна копия рантайма,
        // единая идентичность класса Signal через границы пакетов.
        signals: resolve(__dirname, 'src/signals.ts'),
        // Низкоуровневый state-субстрат (M1): createModel + сигналы + value-операции +
        // headless-валидация + producer-флаг. Импортирует из тех же core-файлов, что и index →
        // общий chunk (один derived-WeakMap, единая идентичность Signal). Основа доменных модулей.
        model: resolve(__dirname, 'src/model/index.ts'),
        // Декларативный контракт схемы поведения. Импортирует примитивы из index → общий chunk
        // (единый реестр сигнал→нода и единый ambient-сток).
        behaviors: resolve(__dirname, 'src/form/behaviors/index.ts'),
        // Декларативный контракт СХЕМЫ ВАЛИДАЦИИ (validateModel + операторы). Импортирует из index →
        // общий chunk (тот же реестр сигнал→нода, что и у форм/поведения).
        validation: resolve(__dirname, 'src/form/validation/index.ts'),
        // Barrel каталога validators/: полный набор правил одним импортом.
        validators: resolve(__dirname, 'src/form/validators/index.ts'),
        // Granular validator exports for tree-shaking
        'validators/required': resolve(__dirname, 'src/form/validators/required.ts'),
        'validators/email': resolve(__dirname, 'src/form/validators/email.ts'),
        'validators/min': resolve(__dirname, 'src/form/validators/min.ts'),
        'validators/max': resolve(__dirname, 'src/form/validators/max.ts'),
        'validators/min-length': resolve(__dirname, 'src/form/validators/min-length.ts'),
        'validators/max-length': resolve(__dirname, 'src/form/validators/max-length.ts'),
        'validators/pattern': resolve(__dirname, 'src/form/validators/pattern.ts'),
        'validators/url': resolve(__dirname, 'src/form/validators/url.ts'),
        'validators/phone': resolve(__dirname, 'src/form/validators/phone.ts'),
        // Number validators (atomic)
        'validators/is-number': resolve(__dirname, 'src/form/validators/is-number.ts'),
        'validators/integer': resolve(__dirname, 'src/form/validators/integer.ts'),
        'validators/multiple-of': resolve(__dirname, 'src/form/validators/multiple-of.ts'),
        'validators/non-negative': resolve(__dirname, 'src/form/validators/non-negative.ts'),
        'validators/non-zero': resolve(__dirname, 'src/form/validators/non-zero.ts'),
        // Date validators (atomic)
        'validators/is-date': resolve(__dirname, 'src/form/validators/is-date.ts'),
        'validators/min-date': resolve(__dirname, 'src/form/validators/min-date.ts'),
        'validators/max-date': resolve(__dirname, 'src/form/validators/max-date.ts'),
        'validators/past-date': resolve(__dirname, 'src/form/validators/past-date.ts'),
        'validators/future-date': resolve(__dirname, 'src/form/validators/future-date.ts'),
        'validators/min-age': resolve(__dirname, 'src/form/validators/min-age.ts'),
        'validators/max-age': resolve(__dirname, 'src/form/validators/max-age.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', '@preact/signals-core'],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});

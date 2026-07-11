/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [dts({ insertTypesEntry: true })],
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/index.ts', 'src/**/*.d.ts'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
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
        state: resolve(__dirname, 'src/state/index.ts'),
        // Декларативный контракт схемы поведения. Импортирует примитивы из index → общий chunk
        // (единый реестр сигнал→нода и единый ambient-сток).
        behaviors: resolve(__dirname, 'src/form/behaviors.ts'),
        // Re-export file that imports from index to ensure single module instance.
        validators: resolve(__dirname, 'src/form/validators.ts'),
        // Granular validator exports for tree-shaking
        'validators/required': resolve(__dirname, 'src/form/validation/validators/required.ts'),
        'validators/email': resolve(__dirname, 'src/form/validation/validators/email.ts'),
        'validators/min': resolve(__dirname, 'src/form/validation/validators/min.ts'),
        'validators/max': resolve(__dirname, 'src/form/validation/validators/max.ts'),
        'validators/min-length': resolve(__dirname, 'src/form/validation/validators/min-length.ts'),
        'validators/max-length': resolve(__dirname, 'src/form/validation/validators/max-length.ts'),
        'validators/pattern': resolve(__dirname, 'src/form/validation/validators/pattern.ts'),
        'validators/url': resolve(__dirname, 'src/form/validation/validators/url.ts'),
        'validators/phone': resolve(__dirname, 'src/form/validation/validators/phone.ts'),
        // Number validators (atomic)
        'validators/is-number': resolve(__dirname, 'src/form/validation/validators/is-number.ts'),
        'validators/integer': resolve(__dirname, 'src/form/validation/validators/integer.ts'),
        'validators/multiple-of': resolve(
          __dirname,
          'src/form/validation/validators/multiple-of.ts'
        ),
        'validators/non-negative': resolve(
          __dirname,
          'src/form/validation/validators/non-negative.ts'
        ),
        'validators/non-zero': resolve(__dirname, 'src/form/validation/validators/non-zero.ts'),
        // Date validators (atomic)
        'validators/is-date': resolve(__dirname, 'src/form/validation/validators/is-date.ts'),
        'validators/min-date': resolve(__dirname, 'src/form/validation/validators/min-date.ts'),
        'validators/max-date': resolve(__dirname, 'src/form/validation/validators/max-date.ts'),
        'validators/past-date': resolve(__dirname, 'src/form/validation/validators/past-date.ts'),
        'validators/future-date': resolve(
          __dirname,
          'src/form/validation/validators/future-date.ts'
        ),
        'validators/min-age': resolve(__dirname, 'src/form/validation/validators/min-age.ts'),
        'validators/max-age': resolve(__dirname, 'src/form/validation/validators/max-age.ts'),
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

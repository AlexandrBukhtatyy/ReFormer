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
        // Re-export files that import from index to ensure single module instance
        // This prevents static registry isolation (BehaviorRegistry.contextStack, ValidationRegistry.registryStack)
        validators: resolve(__dirname, 'src/validators.ts'),
        behaviors: resolve(__dirname, 'src/behaviors.ts'),
        // Granular validator exports for tree-shaking
        'validators/required': resolve(__dirname, 'src/core/validation/validators/required.ts'),
        'validators/email': resolve(__dirname, 'src/core/validation/validators/email.ts'),
        'validators/min': resolve(__dirname, 'src/core/validation/validators/min.ts'),
        'validators/max': resolve(__dirname, 'src/core/validation/validators/max.ts'),
        'validators/min-length': resolve(__dirname, 'src/core/validation/validators/min-length.ts'),
        'validators/max-length': resolve(__dirname, 'src/core/validation/validators/max-length.ts'),
        'validators/pattern': resolve(__dirname, 'src/core/validation/validators/pattern.ts'),
        'validators/url': resolve(__dirname, 'src/core/validation/validators/url.ts'),
        'validators/phone': resolve(__dirname, 'src/core/validation/validators/phone.ts'),
        'validators/number': resolve(__dirname, 'src/core/validation/validators/number.ts'),
        // Date validators (atomic)
        'validators/is-date': resolve(__dirname, 'src/core/validation/validators/is-date.ts'),
        'validators/min-date': resolve(__dirname, 'src/core/validation/validators/min-date.ts'),
        'validators/max-date': resolve(__dirname, 'src/core/validation/validators/max-date.ts'),
        'validators/past-date': resolve(__dirname, 'src/core/validation/validators/past-date.ts'),
        'validators/future-date': resolve(
          __dirname,
          'src/core/validation/validators/future-date.ts'
        ),
        'validators/min-age': resolve(__dirname, 'src/core/validation/validators/min-age.ts'),
        'validators/max-age': resolve(__dirname, 'src/core/validation/validators/max-age.ts'),
        // Granular behavior exports for tree-shaking
        'behaviors/copy-from': resolve(__dirname, 'src/core/behavior/behaviors/copy-from.ts'),
        'behaviors/enable-when': resolve(__dirname, 'src/core/behavior/behaviors/enable-when.ts'),
        'behaviors/compute-from': resolve(__dirname, 'src/core/behavior/behaviors/compute-from.ts'),
        'behaviors/watch-field': resolve(__dirname, 'src/core/behavior/behaviors/watch-field.ts'),
        'behaviors/revalidate-when': resolve(
          __dirname,
          'src/core/behavior/behaviors/revalidate-when.ts'
        ),
        'behaviors/sync-fields': resolve(__dirname, 'src/core/behavior/behaviors/sync-fields.ts'),
        'behaviors/reset-when': resolve(__dirname, 'src/core/behavior/behaviors/reset-when.ts'),
        'behaviors/transform-value': resolve(
          __dirname,
          'src/core/behavior/behaviors/transform-value.ts'
        ),
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

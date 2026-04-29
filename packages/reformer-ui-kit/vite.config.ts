/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import path, { resolve } from 'path';

export default defineConfig({
  plugins: [react(), dts({ insertTypesEntry: true })],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'ui/input': resolve(__dirname, 'src/components/ui/input.tsx'),
        'ui/select': resolve(__dirname, 'src/components/ui/select.tsx'),
        'ui/checkbox': resolve(__dirname, 'src/components/ui/checkbox.tsx'),
        'ui/textarea': resolve(__dirname, 'src/components/ui/textarea.tsx'),
        'ui/radio-group': resolve(__dirname, 'src/components/ui/radio-group.tsx'),
        'ui/button': resolve(__dirname, 'src/components/ui/button.tsx'),
        'ui/box': resolve(__dirname, 'src/components/ui/box.tsx'),
        'ui/section': resolve(__dirname, 'src/components/ui/section.tsx'),
        'ui/form-field': resolve(__dirname, 'src/components/ui/form-field.tsx'),
        'ui/input-mask': resolve(__dirname, 'src/components/ui/input-mask.tsx'),
        'ui/input-password': resolve(__dirname, 'src/components/ui/input-password.tsx'),
        'ui/collapsible': resolve(__dirname, 'src/components/ui/collapsible.tsx'),
        'ui/async-boundary': resolve(__dirname, 'src/components/ui/async-boundary.tsx'),
        'form-wizard': resolve(__dirname, 'src/components/form-wizard/index.ts'),
        'form-array': resolve(__dirname, 'src/components/form-array/index.ts'),
        state: resolve(__dirname, 'src/components/state/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@reformer/core',
        '@reformer/cdk',
        '@reformer/cdk/form-wizard',
        '@reformer/cdk/form-array',
        '@reformer/renderer-react',
        '@radix-ui/react-select',
        '@radix-ui/react-slot',
        'lucide-react',
      ],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

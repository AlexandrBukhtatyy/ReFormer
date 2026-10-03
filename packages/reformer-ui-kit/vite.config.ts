/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import path, { resolve } from 'path';
import { readdirSync, existsSync } from 'node:fs';
import { localeAssets } from '../../scripts/vite-locale-assets.mjs';

const componentsDir = resolve(__dirname, 'src/components');

/** Glob: по одному entry на каждый src/components/<name>/index.ts (subpath = его barrel). */
function componentEntries(): Record<string, string> {
  const entries: Record<string, string> = {};
  if (!existsSync(componentsDir)) return entries;
  for (const d of readdirSync(componentsDir, { withFileTypes: true })) {
    const idx = resolve(componentsDir, d.name, 'index.ts');
    if (d.isDirectory() && existsSync(idx)) entries[d.name] = idx;
  }
  return entries;
}

const entry: Record<string, string> = {
  index: resolve(__dirname, 'src/index.ts'),
  ...(existsSync(resolve(__dirname, 'src/meta.ts'))
    ? { meta: resolve(__dirname, 'src/meta.ts') }
    : {}),
  // Слой создания своих полей — отдельный вход под subpath `./fields`.
  ...(existsSync(resolve(__dirname, 'src/fields/index.ts'))
    ? { fields: resolve(__dirname, 'src/fields/index.ts') }
    : {}),
  // Встроенные локали кита: загрузчик (чанк на язык) и синхронные модули по языкам.
  locale: resolve(__dirname, 'src/locale/index.ts'),
  'locale/en': resolve(__dirname, 'src/locale/en.ts'),
  'locale/ru': resolve(__dirname, 'src/locale/ru.ts'),
  ...componentEntries(),
};

// external — ПРЕДИКАТ (не перечисление): любой @radix-ui/* и heavy-dep не бандлится.
// clsx / tailwind-merge / class-variance-authority / tslib НЕ здесь → бандлятся (utils-чанк).
const EXTERNAL: RegExp[] = [
  /^react($|\/)/,
  /^react-dom($|\/)/,
  /^@reformer\//,
  /^radix-ui$/,
  /^@radix-ui\//,
  /^lucide-react$/,
  // heavy recipe deps (optional peers, только свой subpath)
  /^recharts$/,
  /^@tanstack\/react-table$/,
  /^embla-carousel-react$/,
  /^react-day-picker$/,
  /^date-fns$/,
  /^cmdk$/,
  /^vaul$/,
  /^sonner$/,
  /^input-otp$/,
  /^react-resizable-panels$/,
  /^@shadcn\/react/,
];

// Тесты живут рядом с исходниками — в dist их декларации не нужны и уезжают в npm.
const TEST_FILES = ['**/*.test.ts', '**/*.test.tsx'];

export default defineConfig({
  plugins: [
    react(),
    dts({ insertTypesEntry: true, exclude: TEST_FILES }),
    // JSON-копии локалей (`./locale/<язык>.json`) — из собранных синхронных модулей: словари
    // ядра и cdk плюс подписи кита. Ядро и cdk должны быть собраны раньше.
    localeAssets({ dist: resolve(__dirname, 'dist'), codes: ['en', 'ru'] }),
  ],
  build: {
    lib: {
      entry,
      formats: ['es'],
    },
    rollupOptions: {
      external: (id) => EXTERNAL.some((re) => re.test(id)),
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

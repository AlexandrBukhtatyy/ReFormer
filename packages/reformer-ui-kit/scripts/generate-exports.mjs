#!/usr/bin/env node
/**
 * Генерирует package.json#exports и src/index.ts глобом src/components/*&#47;index.ts.
 *
 * - `exports`: фиксированные точки (`.`, `./meta`, `./styles`) + subpath на каждый компонент.
 * - `src/index.ts`: главный barrel — реэкспорт **лёгких** компонентов + их field (тяжёлые НЕ в barrel,
 *   доступны только своим subpath, чтобы не тащить recharts/tanstack/... в основной бандл).
 */
import { readdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const componentsDir = join(pkgRoot, 'src', 'components');

// Тяжёлые компоненты — только subpath, вне главного barrel (external heavy-deps).
const HEAVY = new Set([
  'chart',
  'table',
  'carousel',
  'calendar',
  'date-picker',
  'command',
  'combobox',
  'sidebar',
  'resizable',
  'drawer',
  'sonner',
  'input-otp',
  'message-scroller',
]);

const components = existsSync(componentsDir)
  ? readdirSync(componentsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(componentsDir, d.name, 'index.ts')))
      .map((d) => d.name)
      .sort()
  : [];

// ── package.json#exports ──────────────────────────────────────────────────
const exportsMap = {
  '.': { types: './dist/index.d.ts', import: './dist/index.js' },
  './meta': { types: './dist/meta.d.ts', import: './dist/meta.js' },
  './styles': './src/styles/theme.css',
};
for (const name of components) {
  exportsMap[`./${name}`] = {
    types: `./dist/${name}.d.ts`,
    import: `./dist/${name}.js`,
  };
}

const pkgPath = join(pkgRoot, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
delete pkg['//exports-note'];
pkg.exports = exportsMap;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// ── src/index.ts (главный barrel лёгких компонентов) ───────────────────────
const light = components.filter((c) => !HEAVY.has(c));
const barrel = [
  '// СГЕНЕРИРОВАНО scripts/generate-exports.mjs — не редактировать вручную.',
  "export { cn } from './lib/utils';",
  // Базовый императивный контракт полей: нужен потребителям для schema.node(sel).getRef<FieldHandle>().
  // Rich-handle композитов (SelectAsyncHandle и т.п.) уходят через барели своих компонентов.
  "export type { FieldHandle } from './fields/field-handle';",
  ...light.map((c) => `export * from './components/${c}';`),
  '',
].join('\n');
writeFileSync(join(pkgRoot, 'src', 'index.ts'), barrel);

console.log(
  `generate-exports: ${components.length} компонент(ов) → exports; ${light.length} в barrel (тяжёлых вне barrel: ${components.length - light.length})`
);

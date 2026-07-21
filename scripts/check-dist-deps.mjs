#!/usr/bin/env node
// Guard: каждый внешний импорт собранного dist/ должен быть объявлен в манифесте.
//
// Зачем: vite не бандлит пакеты, попавшие в `external` (см. vite.config.ts) — они
// остаются `import "..."` в dist и должны прийти к потребителю из node_modules.
// Если такой пакет числится только в devDependencies, локально и в CI всё зелёное
// (devDeps установлены), а у потребителя `import "@reformer/ui-kit/<subpath>"`
// падает с ERR_MODULE_NOT_FOUND. Именно так разъехались 11 heavy-deps до v11.
//
// Скрипт обходит dist/**/*.js, вынимает спецификаторы модулей (es-module-lexer —
// настоящий парсер ESM, а не регексп по `from "..."`, который ловит ложные
// срабатывания на строковых литералах внутри кода), нормализует до имени пакета
// и вычитает dependencies + peerDependencies + optionalDependencies.
// Непустой остаток → exit 1.

import { readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { init, parse } from 'es-module-lexer';

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(pkgDir, 'dist');

/** Спецификатор пакета: `name`, `@scope/name` и любой их subpath. */
const PACKAGE_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

/** `@scope/name/deep/path` → `@scope/name`; `name/deep` → `name`. */
function toPackageName(specifier) {
  const parts = specifier.split('/');
  const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  return PACKAGE_NAME.test(name) ? name : null;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

await init;

const pkg = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {}),
]);

let files;
try {
  files = walk(distDir);
} catch {
  console.error(`✗ ${distDir} не найден — сначала соберите пакет (npm run build).`);
  process.exit(1);
}
if (files.length === 0) {
  console.error(`✗ в ${distDir} нет .js — сначала соберите пакет (npm run build).`);
  process.exit(1);
}

/** package name → Set<файл dist, где встретился> */
const external = new Map();

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const [imports] = parse(source, path.basename(file));
  for (const imp of imports) {
    const specifier = imp.n; // undefined для динамического импорта с вычисляемым путём
    if (!specifier) continue;
    if (specifier.startsWith('.') || specifier.startsWith('/')) continue;
    if (specifier.startsWith('node:') || builtinModules.includes(specifier)) continue;
    const name = toPackageName(specifier);
    if (!name || name === pkg.name) continue;
    if (!external.has(name)) external.set(name, new Set());
    external.get(name).add(path.relative(pkgDir, file));
  }
}

const missing = [...external.keys()].filter((name) => !declared.has(name)).sort();

if (missing.length > 0) {
  console.error(
    `✗ ${pkg.name}: ${missing.length} внешн. зависимост(ь/и) есть в dist, но не объявлены в package.json:\n`
  );
  for (const name of missing) {
    const where = [...external.get(name)].sort();
    const shown = where.slice(0, 5).join(', ');
    console.error(`  ${name}`);
    console.error(`    ← ${shown}${where.length > 5 ? ` (+${where.length - 5})` : ''}`);
  }
  console.error(
    '\n  Heavy-зависимость одного subpath → опциональный peer (peerDependencies +\n' +
      '  peerDependenciesMeta.optional), чтобы её не тянули потребители остальных\n' +
      '  компонентов. Зависимость, нужную всем → dependencies. devDependencies\n' +
      '  до потребителя не доезжают.'
  );
  process.exit(1);
}

console.log(
  `✓ ${pkg.name}: все ${external.size} внешних импорта dist/ (${files.length} файлов) объявлены в манифесте.`
);

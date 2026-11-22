#!/usr/bin/env node
// Guard: каждый внешний импорт собранного dist/ должен быть объявлен в манифесте пакета.
//
// Зачем: vite не бандлит пакеты, попавшие в `external` (см. vite.config.ts каждого
// пакета) — они остаются `import "..."` в dist и должны прийти к потребителю из
// node_modules. Если такой пакет числится только в devDependencies, локально и в CI
// всё зелёное (devDeps установлены), а у потребителя `import "@reformer/<pkg>/<subpath>"`
// падает с ERR_MODULE_NOT_FOUND. Именно так разъехались 11 heavy-deps @reformer/ui-kit.
//
// Скрипт обходит dist/**/*.js, вынимает спецификаторы модулей (es-module-lexer —
// настоящий парсер ESM, а не регексп по `from "..."`, который ловит ложные
// срабатывания на строковых литералах внутри кода), нормализует до имени пакета
// и вычитает dependencies + peerDependencies + optionalDependencies.
// Непустой остаток → exit 1.
//
// Использование:
//   node scripts/check-dist-deps.mjs                          # все packages/* с dist
//   node scripts/check-dist-deps.mjs packages/reformer-ui-kit  # конкретные пакеты
//   node scripts/check-dist-deps.mjs .                         # из каталога пакета

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { init, parse } from 'es-module-lexer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

/** Каталоги пакетов: аргументы CLI либо все packages/* с package.json. */
function targetDirs() {
  const args = process.argv.slice(2);
  if (args.length > 0) return args.map((arg) => path.resolve(arg));
  const packagesDir = path.join(repoRoot, 'packages');
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(packagesDir, d.name, 'package.json')))
    .map((d) => path.join(packagesDir, d.name));
}

/** @returns {{ ok: boolean, name: string, message: string }} */
function checkPackage(pkgDir) {
  const pkg = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  const distDir = path.join(pkgDir, 'dist');

  if (!existsSync(distDir)) {
    return { ok: false, name: pkg.name, message: 'нет dist/ — сначала соберите пакет' };
  }
  const files = walk(distDir);
  if (files.length === 0) {
    return { ok: false, name: pkg.name, message: 'в dist/ нет .js — сначала соберите пакет' };
  }

  const declared = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
  ]);

  /** имя пакета → Set<файл dist, где встретился> */
  const external = new Map();

  for (const file of files) {
    const [imports] = parse(readFileSync(file, 'utf8'), path.basename(file));
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
  if (missing.length === 0) {
    return {
      ok: true,
      name: pkg.name,
      message: `${external.size} внешних импортов dist/ (${files.length} файлов) объявлены`,
    };
  }

  const details = missing
    .map((name) => {
      const where = [...external.get(name)].sort();
      const shown = where.slice(0, 5).join(', ');
      return `  ${name}\n    ← ${shown}${where.length > 5 ? ` (+${where.length - 5})` : ''}`;
    })
    .join('\n');
  return {
    ok: false,
    name: pkg.name,
    message: `${missing.length} внешн. зависимост(ь/и) есть в dist, но не объявлены:\n${details}`,
  };
}

await init;

const results = targetDirs().map(checkPackage);
for (const { ok, name, message } of results) {
  console[ok ? 'log' : 'error'](`${ok ? '✓' : '✗'} ${name}: ${message}`);
}

if (results.some((r) => !r.ok)) {
  console.error(
    '\n  Heavy-зависимость одного subpath → опциональный peer (peerDependencies +\n' +
      '  peerDependenciesMeta.optional), чтобы её не тянули потребители остальных\n' +
      '  компонентов. Зависимость, нужную всем → dependencies. devDependencies\n' +
      '  до потребителя не доезжают.'
  );
  process.exit(1);
}

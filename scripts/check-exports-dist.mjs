#!/usr/bin/env node
// Guard: карта `exports` в package.json и фактически собранный dist/ не должны расходиться.
//
// Зачем: `exports` и список `entry` в vite.config.ts — два РУЧНЫХ списка, которые ведутся
// независимо. Когда один правят, а второй забывают, ломается ровно то, ради чего subpath
// заводили. Реальный случай: коммит «split date validator into atomic validators» удалил
// src/.../validators/date.ts, добавил 7 атомарных entry в vite.config.ts — но exports не
// тронул. В итоге объявленный `./validators/date` не резолвился (ERR_MODULE_NOT_FOUND),
// а 7 собранных валидаторов были недоступны потребителю: при strict exports всё, чего нет
// в карте, для импорта не существует, даже если файл лежит в тарболе.
//
// Дополняет соседей с третьей стороны:
//   check-dist-deps.mjs  — «внешний импорт dist объявлен в манифесте?»
//   check-subpaths.mjs   — «subpath реально импортируется у потребителя?» (npm pack, только ui-kit)
//   этот скрипт          — «exports и dist описывают одно и то же?» (статически, без сборки тарбола)
//
// Проверяет три вещи:
//   (а) фантом  — ключ есть в exports, файла в dist нет;
//   (б) сирота  — entry собирается vite, ключа в exports нет;
//   (в) React   — вход, которому React не положен, не тянет его ни прямо, ни через свои чанки.
//
// Направление (б) требует, чтобы `lib.entry` в vite.config.ts был литеральным объектом.
// Там, где entry генерируется (ui-kit строит его глобом), проверка (б) пропускается —
// у такого пакета список по построению не может разъехаться, и его уже страхует
// check-subpaths.mjs.
//
// Про (в). Корень `@reformer/core` и его сабпаты обязаны работать без React — на сервере и с
// другим слоем представления; React отдаёт единственный вход `@reformer/core/react`. Линтер
// стережёт исходники (границы слоёв в eslint.config.js), но не сборку: общий чанк, в который
// rollup сложил бы хук вместе с нодой формы, вернул бы `import 'react'` в корень при чистых
// исходниках. Поэтому замыкание импортов считается по собранному dist.
//
// Использование:
//   node scripts/check-exports-dist.mjs                     # все packages/*
//   node scripts/check-exports-dist.mjs packages/reformer   # конкретные пакеты

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Каталоги пакетов: аргументы CLI либо все packages/* с package.json. */
function targetDirs() {
  const args = process.argv.slice(2);
  if (args.length > 0) return args.map((arg) => path.resolve(arg));
  const packagesDir = path.join(repoRoot, 'packages');
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(packagesDir, d.name, 'package.json')))
    .map((d) => path.join(packagesDir, d.name));
}

/** Все файловые цели условного экспорта: { types, import, default, ... } либо строка. */
function exportTargets(value) {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(exportTargets);
  return [];
}

/**
 * Ключи `lib.entry` из vite.config.ts, если он записан литеральным объектом.
 *
 * @returns Set ключей, либо null — если entry вычисляется и статически не читается.
 */
function viteEntryKeys(pkgDir) {
  const configPath = path.join(pkgDir, 'vite.config.ts');
  if (!existsSync(configPath)) return null;
  const src = readFileSync(configPath, 'utf8');

  // Границы блока `entry: { ... }` внутри lib — берём до строки, закрывающей объект.
  const start = src.search(/\bentry:\s*\{/);
  if (start === -1) return null;

  const keys = new Set();
  // 'validators/min-date': resolve(...)   |   index: resolve(...)
  const RE = /^\s*'?([A-Za-z0-9_@./-]+)'?:\s*resolve\(/gm;
  for (const m of src.slice(start).matchAll(RE)) keys.add(m[1]);
  return keys.size > 0 ? keys : null;
}

/**
 * Пакеты с входами без React: имя пакета → ключи `exports`, которым React разрешён.
 * Всем остальным входам такого пакета он запрещён во всём замыкании импортов.
 */
const REACT_ALLOWED_ENTRIES = new Map([['@reformer/core', new Set(['./react'])]]);

/** Спецификаторы, означающие зависимость от React. */
const REACT_SPECIFIER = /^(react|react-dom|use-sync-external-store)(\/|$)/;

/** Спецификаторы модуля: `from '…'`, `import '…'` и `import('…')`. */
function importSpecifiers(file) {
  const src = readFileSync(file, 'utf8');
  return [...src.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
}

/**
 * Цепочка импортов от входа до React, если она есть.
 *
 * @returns Массив «вход → чанк → … → react» либо null, когда замыкание от React свободно.
 */
function reactImportChain(entryFile) {
  const queue = [[entryFile]];
  const seen = new Set([entryFile]);
  while (queue.length > 0) {
    const chain = queue.shift();
    const file = chain[chain.length - 1];
    for (const specifier of importSpecifiers(file)) {
      if (REACT_SPECIFIER.test(specifier)) return [...chain, specifier];
      if (!specifier.startsWith('.')) continue; // прочие внешние зависимости
      const next = path.resolve(path.dirname(file), specifier);
      if (seen.has(next) || !next.endsWith('.js') || !existsSync(next)) continue;
      seen.add(next);
      queue.push([...chain, next]);
    }
  }
  return null;
}

/** @returns {{ ok: boolean, name: string, message: string }} */
function checkPackage(pkgDir) {
  const pkg = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  if (!pkg.exports) return { ok: true, name: pkg.name, message: 'нет карты exports — пропуск' };
  if (!existsSync(path.join(pkgDir, 'dist'))) {
    return { ok: false, name: pkg.name, message: 'нет dist/ — сначала соберите пакет' };
  }

  const problems = [];

  // (а) фантомы: объявлено в exports, файла нет.
  const phantoms = [];
  for (const [key, value] of Object.entries(pkg.exports)) {
    // Subpath patterns (`"./*": "./*"`) — не путь к файлу, а правило подстановки: проверять его
    // на существование бессмысленно, файла с именем `*` не бывает. Node резолвит такой ключ
    // подстановкой, и «фантомом» он выглядит только для наивной проверки.
    if (key.includes('*')) continue;
    for (const target of exportTargets(value)) {
      if (typeof target !== 'string' || !target.startsWith('./')) continue;
      if (!existsSync(path.join(pkgDir, target))) phantoms.push(`${key} → ${target}`);
    }
  }
  if (phantoms.length > 0) {
    problems.push(
      `${phantoms.length} экспорт(ов) указывают на несуществующий файл:\n` +
        phantoms.map((p) => `    ${p}`).join('\n')
    );
  }

  // (б) сироты: собирается vite, в exports не объявлено.
  const entries = viteEntryKeys(pkgDir);
  let skipped = '';
  if (entries === null) {
    skipped = ' (entry вычисляется — сверка «сирот» пропущена)';
  } else {
    const declared = new Set(Object.keys(pkg.exports).map((k) => k.replace(/^\.\/?/, '')));
    const orphans = [...entries].filter((k) => k !== 'index' && !declared.has(k));
    if (orphans.length > 0) {
      problems.push(
        `${orphans.length} entry собирается, но не объявлен(ы) в exports — недоступны потребителю:\n` +
          orphans.map((o) => `    ${o}`).join('\n')
      );
    }
  }

  // (в) React в замыкании входа, которому он не положен.
  const reactAllowed = REACT_ALLOWED_ENTRIES.get(pkg.name);
  let reactNote = '';
  if (reactAllowed) {
    const leaks = [];
    let checked = 0;
    for (const [key, value] of Object.entries(pkg.exports)) {
      if (reactAllowed.has(key) || key.includes('*')) continue;
      const target = exportTargets(value).find((t) => typeof t === 'string' && t.endsWith('.js'));
      if (!target) continue; // не модуль: JSON-копия локали
      const entryFile = path.join(pkgDir, target);
      if (!existsSync(entryFile)) continue; // фантом уже отмечен в (а)
      checked++;
      const chain = reactImportChain(entryFile);
      if (chain) {
        const shown = chain.map((step) =>
          path.isAbsolute(step) ? path.relative(pkgDir, step).replaceAll('\\', '/') : `'${step}'`
        );
        leaks.push(`${key}: ${shown.join(' → ')}`);
      }
    }
    if (leaks.length > 0) {
      problems.push(
        `${leaks.length} вход(ов) тянут React, хотя он разрешён только в ` +
          `${[...reactAllowed].join(', ')}:\n` +
          leaks.map((leak) => `    ${leak}`).join('\n')
      );
    }
    reactNote = `; ${checked} вход(ов) без React`;
  }

  if (problems.length > 0) {
    return { ok: false, name: pkg.name, message: problems.join('\n  ') };
  }
  const count = Object.keys(pkg.exports).length;
  return {
    ok: true,
    name: pkg.name,
    message: `${count} экспортов сходятся с dist/${skipped}${reactNote}`,
  };
}

const results = targetDirs().map(checkPackage);
for (const { ok, name, message } of results) {
  console[ok ? 'log' : 'error'](`${ok ? '✓' : '✗'} ${name}: ${message}`);
}

if (results.some((r) => !r.ok)) {
  console.error(
    '\n  Правьте карту `exports` и `lib.entry` в vite.config.ts вместе — это два ручных\n' +
      '  списка одного и того же. Всё, чего нет в exports, для потребителя не существует,\n' +
      '  даже если файл собран и лежит в тарболе.'
  );
  process.exit(1);
}

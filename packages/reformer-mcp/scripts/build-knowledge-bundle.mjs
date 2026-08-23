#!/usr/bin/env node
/**
 * Собрать корпус знаний в два артефакта для сред без файловой системы.
 *
 * Живёт здесь, а не у потребителя: формат артефакта — контракт ядра (`core/bundle.ts`), и
 * второй генератор рядом с ним разъехался бы первым же изменением схемы. Потребитель говорит
 * только КУДА положить.
 *
 *   node scripts/build-knowledge-bundle.mjs --out <dir> [--packages a,b] [--no-docs]
 *
 * Выход: `<dir>/knowledge-index.json` (обязательный) и `<dir>/knowledge-docs.json`.
 * Разделены намеренно — см. докстринг `core/bundle.ts`.
 *
 * Детерминизм. `builtAt` берётся из максимального mtime источников, а не из текущего времени:
 * артефакт коммитится, и метка «сейчас» давала бы новый диф на каждой сборке — шум, в котором
 * настоящее изменение корпуса не разглядеть.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(pkgDir, '../..');

function flag(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
}
const has = (name) => process.argv.includes(`--${name}`);

const outDir = path.resolve(flag('out') ?? path.join(pkgDir, 'bundle'));
const withDocs = !has('no-docs');

// Список пакетов и раскладку каталогов берём из ядра, а не дублируем: разъехавшись, они
// собрали бы артефакт не из тех файлов, и заметить это можно было бы только по выдаче.
const coreEntry = path.join(pkgDir, 'dist', 'core', 'docs', 'packages.js');
if (!existsSync(coreEntry)) {
  console.error('✗ dist/core не собран — сначала: npm run build -w @reformer/mcp');
  process.exit(1);
}
const { KNOWN_PACKAGES, packageDirName } = await import(pathToFileURL(coreEntry).href);
const { BUNDLE_SCHEMA_VERSION } = await import(
  pathToFileURL(path.join(pkgDir, 'dist', 'core', 'bundle.js')).href
);

const only = flag('packages');
const targets = only ? only.split(',').map((s) => s.trim()) : [...KNOWN_PACKAGES];

const indexPackages = {};
const docsPackages = {};
let newest = 0;
const missing = [];

for (const pkg of targets) {
  const dir = path.join(repoRoot, 'packages', packageDirName(pkg));
  const indexFile = path.join(dir, 'llms-index.json');
  const docsFile = path.join(dir, 'llms.txt');

  if (existsSync(indexFile)) {
    indexPackages[pkg] = JSON.parse(readFileSync(indexFile, 'utf8'));
    newest = Math.max(newest, statSync(indexFile).mtimeMs);
  } else {
    missing.push(`${pkg}: llms-index.json`);
  }

  if (withDocs && existsSync(docsFile)) {
    docsPackages[pkg] = readFileSync(docsFile, 'utf8');
    newest = Math.max(newest, statSync(docsFile).mtimeMs);
  } else if (withDocs) {
    missing.push(`${pkg}: llms.txt`);
  }
}

if (Object.keys(indexPackages).length === 0) {
  console.error('✗ ни одного llms-index.json — сначала: npm run generate:llms');
  process.exit(1);
}

// Отсутствие источника — не тихая мелочь: у потребителя это будет выглядеть как «в библиотеке
// нет такого API», и искать причину он начнёт не там.
if (missing.length > 0) {
  console.error(`✗ не найдены источники (${missing.length}):`);
  for (const m of missing) console.error(`    ${m}`);
  console.error('    Соберите пакеты: npm run generate:llms --workspaces --if-present');
  process.exit(1);
}

const builtAt = new Date(newest).toISOString();
mkdirSync(outDir, { recursive: true });

const write = (name, value) => {
  const file = path.join(outDir, name);
  writeFileSync(file, JSON.stringify(value) + '\n', 'utf8');
  const kb = (statSync(file).size / 1024).toFixed(0);
  console.log(`  ${path.relative(repoRoot, file).split(path.sep).join('/')} — ${kb} kB`);
  return file;
};

console.log(`корпус знаний → ${path.relative(repoRoot, outDir).split(path.sep).join('/')}`);
write('knowledge-index.json', {
  schemaVersion: BUNDLE_SCHEMA_VERSION,
  builtAt,
  packages: indexPackages,
});
if (withDocs) {
  write('knowledge-docs.json', {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    builtAt,
    packages: docsPackages,
  });
}

const symbols = Object.values(indexPackages).reduce((n, p) => n + p.symbols.length, 0);
const topics = Object.values(indexPackages).reduce((n, p) => n + p.topics.length, 0);
console.log(
  `✓ ${Object.keys(indexPackages).length} пакет(ов), ${symbols} символ(ов), ${topics} тем(ы), собрано ${builtAt}`
);

#!/usr/bin/env node
/**
 * Собрать корпус знаний в два артефакта для сред без файловой системы.
 *
 * Живёт здесь, а не у потребителя: формат артефакта — контракт ядра (`core/bundle.ts`), и
 * второй генератор рядом с ним разъехался бы первым же изменением схемы. Потребитель говорит
 * только КУДА положить.
 *
 *   node scripts/build-knowledge-bundle.mjs [--out <dir>] [--packages a,b] [--no-docs]
 *
 * Место по умолчанию — `dist/knowledge`: корпус собирается ОДИН раз, при сборке пакета, а воркер
 * (`build-worker.mjs`) и справка конструктора (`copy-knowledge.mjs`) берут его оттуда. Две
 * сборки корпуса в разное время давали копии из разных текстов, и снаружи этого не было видно.
 *
 * Пакеты по умолчанию — `BROWSER_PACKAGES` ядра: артефакт читают только среды без диска (воркер,
 * справка конструктора), а там форму собирает хост, и документация MCP о `form_build` была бы
 * советом, которому не последовать.
 *
 * Выход: `<dir>/knowledge-index.json` (обязательный), `<dir>/knowledge-docs.json` и манифест
 * `<dir>/knowledge-manifest.json` — `{ version, buildId, corpusHash, builtAt, packages }`: метка
 * сборки кода и хэш содержимого (`./lib/corpus.mjs`).
 * Разделены намеренно — см. докстринг `core/bundle.ts`.
 *
 * Детерминизм. `builtAt` берётся из максимального mtime источников, а не из текущего времени:
 * артефакт коммитится, и метка «сейчас» давала бы новый диф на каждой сборке — шум, в котором
 * настоящее изменение корпуса не разглядеть.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { KNOWLEDGE_DIR, MANIFEST_FILE, readBuildId } from './lib/build-stamp.mjs';
import { corpusHash, readCorpusSources } from './lib/corpus.mjs';

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

const outDir = path.resolve(flag('out') ?? path.join(pkgDir, 'dist', KNOWLEDGE_DIR));
const { version } = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
const withDocs = !has('no-docs');

// Список пакетов и раскладку каталогов берём из ядра, а не дублируем: разъехавшись, они
// собрали бы артефакт не из тех файлов, и заметить это можно было бы только по выдаче.
const coreEntry = path.join(pkgDir, 'dist', 'core', 'docs', 'packages.js');
if (!existsSync(coreEntry)) {
  console.error('✗ dist/core не собран — сначала: npm run build -w @reformer/mcp');
  process.exit(1);
}
const { BROWSER_PACKAGES, packageDirName } = await import(pathToFileURL(coreEntry).href);
const { BUNDLE_SCHEMA_VERSION } = await import(
  pathToFileURL(path.join(pkgDir, 'dist', 'core', 'bundle.js')).href
);

const only = flag('packages');
// По умолчанию — корпус браузера: без документации самого MCP, его путь через `form_build` там
// недоступен (`BROWSER_PACKAGES`).
const targets = only ? only.split(',').map((s) => s.trim()) : [...BROWSER_PACKAGES];

const { indexPackages, docsPackages, newest, missing } = readCorpusSources({
  repoRoot,
  packages: targets,
  packageDirName,
  withDocs,
});

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
// Манифест: по нему копии корпуса сверяются между собой и со своими источниками.
const manifest = {
  schemaVersion: BUNDLE_SCHEMA_VERSION,
  version,
  buildId: readBuildId(pkgDir),
  corpusHash: corpusHash({ indexPackages, docsPackages }),
  builtAt,
  withDocs,
  packages: Object.keys(indexPackages),
};
write(MANIFEST_FILE, manifest);

const symbols = Object.values(indexPackages).reduce((n, p) => n + p.symbols.length, 0);
const topics = Object.values(indexPackages).reduce((n, p) => n + p.topics.length, 0);
console.log(
  `✓ ${Object.keys(indexPackages).length} пакет(ов), ${symbols} символ(ов), ${topics} тем(ы), собрано ${builtAt}`
);

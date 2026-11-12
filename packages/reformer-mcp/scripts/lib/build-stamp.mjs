/**
 * Метка сборки `@reformer/mcp` и свежесть `dist`.
 *
 * Метка (`BUILD_ID`) — хэш исходников `src/` и версии пакета, записанный в `dist/build-info.js`
 * после `tsc`. Одинаковые исходники дают одинаковую метку на любой машине: время сборки в ней не
 * участвует, а переводы строк приводятся к `\n`.
 *
 * Зачем. Копии кода и корпуса MCP живут в нескольких местах: бандл воркера в проекте конструктора
 * (`mcp:build`), `@reformer/mcp/intent` и корпус в плагинах (`plugins:build`). Собранные из разных
 * состояний `dist`, они судят одну форму по-разному, и снаружи этого не видно. Метка делает
 * расхождение видимым, а проверка свежести не даёт собрать копию из устаревшего `dist`
 * (фаза 5 аудита, ReFormer-11oe.6).
 *
 * @module reformer-mcp/scripts/lib/build-stamp
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { corpusHash, readCorpusSources } from './corpus.mjs';

/** Файл метки в `dist`. */
export const BUILD_INFO_FILE = 'build-info.js';
/** Каталог корпуса в `dist` и его манифест. */
export const KNOWLEDGE_DIR = 'knowledge';
export const MANIFEST_FILE = 'knowledge-manifest.json';

/** Хэш исходников пакета: `src/**` и версия из `package.json`. */
export function sourceHash(pkgDir) {
  const root = path.join(pkgDir, 'src');
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(root);
  const relative = (file) => path.relative(root, file).split(path.sep).join('/');
  files.sort((a, b) => (relative(a) < relative(b) ? -1 : 1));

  const { version } = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  const hash = createHash('sha256').update(`version\0${version}\0`);
  for (const file of files) {
    hash.update(`${relative(file)}\0`);
    hash.update(readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

/** Метка собранного `dist`; `null` — `dist` не собран или собран без метки. */
export function readBuildId(pkgDir) {
  const file = path.join(pkgDir, 'dist', BUILD_INFO_FILE);
  if (!existsSync(file)) return null;
  const match = readFileSync(file, 'utf8').match(/BUILD_ID = '([^']+)'/);
  return match ? match[1] : null;
}

/** Манифест корпуса в `dist`; `null` — корпус не собран. */
export function readManifest(pkgDir) {
  const file = path.join(pkgDir, 'dist', KNOWLEDGE_DIR, MANIFEST_FILE);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

/**
 * Что устарело в `dist` относительно исходников.
 *
 * @returns Пустой массив — `dist` свежий; иначе — по строке на причину.
 */
export async function staleness(pkgDir, repoRoot) {
  const problems = [];
  const built = readBuildId(pkgDir);
  if (built === null) {
    problems.push('dist не собран или собран без метки');
    return problems;
  }
  if (built === 'dev') {
    // `tsc` (или `npm run dev`) перезаписывает метку заглушкой: код свежий, но сборка не полная —
    // нет метки, а корпус и бандл воркера могли остаться от прежней.
    problems.push('dist пересобран tsc без метки (npm run dev или tsc), а не npm run build');
  } else if (built !== sourceHash(pkgDir)) {
    problems.push(`исходники @reformer/mcp изменились после сборки (dist ${built})`);
  }

  const manifest = readManifest(pkgDir);
  if (manifest === null) {
    problems.push(`нет корпуса dist/${KNOWLEDGE_DIR}/${MANIFEST_FILE}`);
    return problems;
  }
  const { packageDirName } = await import(
    pathToFileURL(path.join(pkgDir, 'dist', 'core', 'docs', 'packages.js')).href
  );
  const sources = readCorpusSources({
    repoRoot,
    packages: manifest.packages,
    packageDirName,
    withDocs: manifest.withDocs !== false,
  });
  if (sources.missing.length > 0) {
    problems.push(`источники корпуса не найдены: ${sources.missing.join(', ')}`);
  } else if (corpusHash(sources) !== manifest.corpusHash) {
    problems.push(
      'документация пакетов (llms.txt, llms-index.json) изменилась после сборки корпуса'
    );
  }
  return problems;
}

/**
 * Остановить сборку копии, если `dist` устарел: копия из него судила бы формы не так, как исходники.
 *
 * @param consumer - Кто проверяет — для сообщения.
 */
export async function assertFresh(pkgDir, repoRoot, consumer) {
  const problems = await staleness(pkgDir, repoRoot);
  if (problems.length === 0) return;
  console.error(`✗ ${consumer}: dist @reformer/mcp устарел —`);
  for (const problem of problems) console.error(`    ${problem}`);
  console.error('    Соберите его: npm run build -w @reformer/mcp');
  process.exit(1);
}

#!/usr/bin/env node
/**
 * Собрать MCP-сервер ReFormer в один файл для Web Worker: `dist/worker/server.js`.
 *
 *   node scripts/build-worker.mjs [--out <dir>]
 *
 * Бандл самодостаточный: код сервера (`dist/platform/worker/server.js` поверх SDK) плюс корпус
 * знаний — тот же артефакт, что собирает `build-knowledge-bundle.mjs`, вшитый строкой. Хост
 * кладёт файл в `.ui_builder/mcp/<имя>/server.js` проекта и запускает его воркером из Blob;
 * соседних файлов и своего протокола загрузки нет — их не знал бы ни один другой MCP-хост.
 *
 * JSON вшивается ТЕКСТОМ (`loader: text`), а не объектом: разбор откладывается до первого вызова
 * инструмента, которому нужно знание, и `initialize` с `tools/list` отвечают сразу — хост будит
 * воркер на вызов и усыпляет по простою.
 *
 * `--out <dir>` — положить копию ещё и туда (playground: `.ui_builder/mcp/reformer`).
 *
 * Требует собранный `dist` (tsc): сервер воркера и ядро, которое читает генератор корпуса.
 */

import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(pkgDir, '../..');
const { version } = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));

function flag(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : null;
}

/** Путь для импорта в коде входа: прямые слэши — на Windows обратные esbuild читает как экранирование. */
const importPath = (file) => file.split(path.sep).join('/');
const shown = (file) => path.relative(repoRoot, file).split(path.sep).join('/');

const serverModule = path.join(pkgDir, 'dist', 'platform', 'worker', 'server.js');
if (!existsSync(serverModule)) {
  console.error('✗ dist/platform/worker не собран — сначала: npm run build -w @reformer/mcp');
  process.exit(1);
}

// Корпус — во временный каталог ВНЕ репозитория: это промежуточный файл сборки, а не артефакт.
const corpusDir = mkdtempSync(path.join(os.tmpdir(), 'reformer-mcp-worker-'));
try {
  const corpus = spawnSync(
    process.execPath,
    [path.join(pkgDir, 'scripts', 'build-knowledge-bundle.mjs'), '--out', corpusDir],
    { stdio: 'inherit' }
  );
  // Не `process.exit`: он не дал бы `finally` убрать временный каталог.
  if (corpus.status !== 0) throw new Error('корпус знаний не собран — см. сообщение выше');

  // Корпус вшивается ТЕКСТОМ, поэтому файлы получают расширение `.txt` — его esbuild и так грузит
  // строкой. Загрузчик `text` для всех `.json` не годится: под ним строками стали бы и мета-схемы
  // ajv внутри SDK, и `new Server()` упал бы на «schema must be object or boolean».
  const asText = (name) => {
    const file = path.join(corpusDir, `${name}.txt`);
    renameSync(path.join(corpusDir, `${name}.json`), file);
    return file;
  };
  const indexFile = asText('knowledge-index');
  const docsFile = asText('knowledge-docs');
  const entry = [
    `import { startWorkerServer } from ${JSON.stringify(importPath(serverModule))};`,
    `import indexText from ${JSON.stringify(importPath(indexFile))};`,
    `import docsText from ${JSON.stringify(importPath(docsFile))};`,
    'startWorkerServer({',
    '  port: self,',
    `  version: ${JSON.stringify(version)},`,
    '  corpus: () => ({ index: JSON.parse(indexText), docs: JSON.parse(docsText) }),',
    '});',
  ].join('\n');

  const outfile = path.join(pkgDir, 'dist', 'worker', 'server.js');
  await esbuild.build({
    stdin: { contents: entry, resolveDir: pkgDir, loader: 'js', sourcefile: 'worker-entry.js' },
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    charset: 'utf8',
    legalComments: 'none',
    // SDK и его зависимости различают окружение по `process.env.NODE_ENV`; в воркере `process`
    // нет, и без подстановки первая же такая проверка упала бы ReferenceError.
    define: { 'process.env.NODE_ENV': '"production"' },
    banner: { js: `/* @reformer/mcp ${version} — MCP-сервер ReFormer для Web Worker. */` },
    outfile,
    logLevel: 'warning',
  });
  const megabytes = (statSync(outfile).size / 1024 / 1024).toFixed(2);
  console.log(`✓ ${shown(outfile)} — ${megabytes} МБ`);

  const out = flag('out');
  if (out) {
    const target = path.resolve(out);
    mkdirSync(target, { recursive: true });
    copyFileSync(outfile, path.join(target, 'server.js'));
    console.log(`  → ${shown(path.join(target, 'server.js'))}`);
  }
} catch (error) {
  console.error(`✗ бандл воркера не собран: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  rmSync(corpusDir, { recursive: true, force: true });
}

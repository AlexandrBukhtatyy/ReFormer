#!/usr/bin/env node
/**
 * Скопировать корпус знаний из `dist/knowledge` потребителю — справке `ask_reformer` конструктора.
 *
 *   node scripts/copy-knowledge.mjs --out <dir>
 *
 * Корпус собирается один раз, в `npm run build` пакета (`build-knowledge-bundle.mjs`), а копии —
 * воркер и справка — берут его оттуда: та же копия, тот же `corpusHash`. Раньше каждый потребитель
 * собирал корпус сам, в своё время, и копии расходились без следа.
 *
 * Перед копированием — проверка свежести `dist` (`./lib/build-stamp.mjs`): копия из устаревшего
 * `dist` останавливает сборку плагинов с командой, которой его обновить.
 */

import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertFresh, KNOWLEDGE_DIR, MANIFEST_FILE, readManifest } from './lib/build-stamp.mjs';

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(pkgDir, '../..');

const i = process.argv.indexOf('--out');
const out = i >= 0 ? process.argv[i + 1] : undefined;
if (!out || out.startsWith('--')) {
  console.error('✗ укажите --out <dir>');
  process.exit(1);
}

await assertFresh(pkgDir, repoRoot, 'корпус справки');
const source = path.join(pkgDir, 'dist', KNOWLEDGE_DIR);
const target = path.resolve(out);
mkdirSync(target, { recursive: true });
for (const name of ['knowledge-index.json', 'knowledge-docs.json', MANIFEST_FILE]) {
  copyFileSync(path.join(source, name), path.join(target, name));
}
const { corpusHash, buildId } = readManifest(pkgDir);
console.log(
  `✓ корпус ${corpusHash} (сборка ${buildId}) → ${path.relative(repoRoot, target).split(path.sep).join('/')}`
);

#!/usr/bin/env node
/**
 * Записать метку сборки в `dist/build-info.js` — после `tsc`, который положил туда заглушку `dev`.
 *
 *   node scripts/stamp-build.mjs
 *
 * Метка — хэш исходников `src/` и версии пакета (`./lib/build-stamp.mjs`).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_INFO_FILE, sourceHash } from './lib/build-stamp.mjs';

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(pkgDir, 'dist', BUILD_INFO_FILE);
if (!existsSync(file)) {
  console.error(`✗ dist/${BUILD_INFO_FILE} нет — сначала tsc`);
  process.exit(1);
}

// Меняется только литерал заглушки: функции модуля (`versionWithBuild`, `buildIdOf`) остаются.
const id = sourceHash(pkgDir);
const emitted = readFileSync(file, 'utf8');
const placeholder = "BUILD_ID = 'dev'";
if (!emitted.includes(placeholder)) {
  console.error(`✗ в dist/${BUILD_INFO_FILE} нет заглушки ${placeholder}`);
  process.exit(1);
}
writeFileSync(file, emitted.replace(placeholder, `BUILD_ID = '${id}'`));
console.log(`✓ метка сборки ${id}`);

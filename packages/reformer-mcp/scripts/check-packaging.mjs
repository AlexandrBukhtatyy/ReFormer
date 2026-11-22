#!/usr/bin/env node
/**
 * Проверка упаковки тонкого клиента: что уходит в npm и что пакет запускается.
 *
 *   node scripts/check-packaging.mjs
 *
 * 1. В архиве `npm pack` только `dist`, `README.md` и `package.json` — ни корпуса знаний (`llms*`,
 *    `docs/llms`, `knowledge`), ни промптов, ни бандла воркера: всё это — сервис.
 * 2. Ни один файл `dist` не импортирует ничего, кроме своих модулей, SDK MCP и встроенных модулей
 *    Node (`typescript` — по требованию, компилятор проекта).
 * 3. Бин без ключа облака честно отказывает, а не висит на stdio.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

// 1. Состав архива.
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const packed = JSON.parse(
  execFileSync(npm, ['pack', '--dry-run', '--json'], {
    cwd: pkgDir,
    encoding: 'utf-8',
    shell: true,
  })
);
const files = packed[0].files.map((file) => file.path.replace(/\\/g, '/'));
const allowed = (file) =>
  file === 'package.json' || file === 'README.md' || file.startsWith('dist/');
for (const file of files.filter((file) => !allowed(file)))
  failures.push(`лишний файл в архиве: ${file}`);
const closed = /(llms|knowledge|prompts|worker|templates)/i;
for (const file of files.filter((file) => closed.test(file))) {
  failures.push(`в архиве файл сервиса: ${file}`);
}

// 2. Импорты собранного кода.
const NODE = new Set(['fs', 'path', 'url', 'os', 'module', 'crypto', 'http', 'https', 'net']);
const allowedImport = (spec) =>
  spec.startsWith('.') ||
  spec.startsWith('node:') ||
  NODE.has(spec) ||
  spec === 'typescript' ||
  spec.startsWith('@modelcontextprotocol/sdk/');
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.js') ? [full] : [];
  });
}
for (const file of walk(path.join(pkgDir, 'dist'))) {
  const text = readFileSync(file, 'utf-8');
  for (const match of text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    if (!allowedImport(match[1])) {
      failures.push(`${path.relative(pkgDir, file)}: импорт «${match[1]}»`);
    }
  }
}

// 3. Бин без ключа.
const run = spawnSync(process.execPath, [path.join(pkgDir, 'dist', 'index.js')], {
  env: { ...process.env, REFORMER_API_KEY: '', REFORMER_SERVICE_URL: '' },
  encoding: 'utf-8',
  timeout: 15_000,
});
if (run.status !== 1 || !run.stderr.includes('REFORMER_API_KEY')) {
  failures.push(`бин без ключа: код ${run.status}, stderr: ${run.stderr.trim().slice(0, 200)}`);
}

if (failures.length > 0) {
  console.error(`✗ @reformer/mcp: ${failures.length} проблем(ы) упаковки:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ @reformer/mcp: ${files.length} файлов в архиве, импорты — только свои, SDK и Node`);

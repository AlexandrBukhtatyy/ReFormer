#!/usr/bin/env node
/**
 * Гард: открытая часть не ссылается на закрытый сервер MCP.
 *
 * Сервер MCP живёт в закрытом репозитории; открытая часть — его подмодуль и о нём не знает. Ссылка из открытого файла на закрытый пакет — манифест, импорт, путь в
 * документации или в комментарии — значит, что открытое дерево либо не собирается без закрытого,
 * либо выдаёт его устройство. Ищутся имя пакета и имя его каталога во всех файлах git (и в новых,
 * ещё не добавленных).
 *
 * `CLOSED_PATHS_FILE` — список путей закрытой части (по строке, каталог — с `/` в конце, `#` —
 * комментарий): их файлы не сканируются. Нужен там, где закрытое лежит рядом с открытым; в
 * публичном репозитории закрытого нет, и переменная не задаётся.
 *
 * Использование: node scripts/check-no-closed-refs.mjs
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Имя закрытого пакета собрано из частей: целиком оно не встречается и в самом гарде.
const CLOSED_NAME = ['mcp', 'server'].join('-');
const CLOSED_RE = new RegExp(`@reformer/${CLOSED_NAME}|reformer-${CLOSED_NAME}`);
/** Файл блокировки открытое дерево собирает заново (`npm install` при разделе репозиториев). */
const SKIP = new Set(['package-lock.json']);
const BINARY =
  /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|pdf|zip|gz|tgz|br|mp3|mp4|webm|wasm)$/i;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REPORTED = 60;

function closedPaths() {
  const file = process.env.CLOSED_PATHS_FILE?.trim();
  if (!file) return [];
  return readFileSync(path.resolve(repoRoot, file), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

const closed = closedPaths();
const isClosed = (rel) =>
  closed.some((entry) => (entry.endsWith('/') ? rel.startsWith(entry) : rel === entry));

const files = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  }
)
  .split('\0')
  .filter(Boolean);

const hits = [];
let scanned = 0;
for (const rel of new Set(files)) {
  if (SKIP.has(rel) || BINARY.test(rel) || isClosed(rel)) continue;
  const full = path.join(repoRoot, rel);
  // В индексе, но удалён из рабочего дерева — проверять нечего.
  if (!existsSync(full) || statSync(full).size > MAX_BYTES) continue;
  scanned += 1;
  const lines = readFileSync(full, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (CLOSED_RE.test(line)) hits.push(`${rel}:${index + 1}: ${line.trim().slice(0, 140)}`);
  });
}

if (hits.length > 0) {
  console.error(`✗ открытая часть ссылается на закрытый сервер MCP (${hits.length}):\n`);
  for (const hit of hits.slice(0, MAX_REPORTED)) console.error(`  ${hit}`);
  if (hits.length > MAX_REPORTED) console.error(`  … и ещё ${hits.length - MAX_REPORTED}`);
  console.error(
    '\n  Открытый код и документация называют сервис ReFormer и клиент `@reformer/mcp`, но не\n' +
      '  закрытый пакет: перепишите ссылку или перенесите файл в закрытую часть.'
  );
  process.exit(1);
}

console.log(
  `✓ открытая часть без ссылок на закрытый сервер MCP: ${scanned} файл(ов)` +
    (closed.length ? `, закрытых путей пропущено — ${closed.length}` : '')
);

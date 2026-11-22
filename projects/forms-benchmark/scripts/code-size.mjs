#!/usr/bin/env node
/**
 * Объём кода реализаций — «сколько написать руками для этой страницы».
 *
 * Какие файлы считать, решает сборка, а не список каталогов: берутся исходники из `src/libs/**`,
 * попавшие в бандл страницы (sources из sourcemap после scripts/build-entries.mjs). Так обвязка,
 * общая для форм, считается каждой странице, которая её использует, а код другой формы — нет.
 * Файлы только с типами в бандл не попадают и не считаются. `src/shared/**` одинаков у всех и не
 * считается.
 *
 * Метрики: строки без пустых и комментариев после prettier (одинаковый стиль переноса), раздельно
 * TS/TSX и JSON; файлы; gzip исходника без комментариев (объём, не зависящий от переносов).
 * «Форма» — файлы в `src/libs/<impl>/<form>/`, «обвязка» — остальные файлы `src/libs/**` страницы.
 *
 * Результат: dist/code-report.json + таблица в консоль.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const libsDir = path.join(root, 'src/libs') + path.sep;
const manifest = JSON.parse(readFileSync(path.join(root, 'entries.json'), 'utf8'));

/** Удаляет комментарии JS/TS, не трогая строки и шаблоны. */
function stripComments(code) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < code.length) {
    const c = code[i];
    const n = code[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += n ?? '';
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
    } else if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += c;
      i++;
    } else if (c === '/' && n === '/') {
      while (i < code.length && code[i] !== '\n') i++;
    } else if (c === '/' && n === '*') {
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i += 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const prettierConfig = (await prettier.resolveConfig(path.join(root, 'src/x.ts'))) ?? {};
const fileCache = new Map();

async function measureFile(file) {
  if (fileCache.has(file)) return fileCache.get(file);
  const ext = path.extname(file);
  const text = readFileSync(file, 'utf8');
  const formatted = await prettier.format(text, { ...prettierConfig, filepath: file });
  const code = ext === '.json' ? formatted : stripComments(formatted);
  const lines = code.split('\n').filter((l) => l.trim() !== '').length;
  const out = { ext, lines, code: code.replace(/^\s*\n/gm, '') };
  fileCache.set(file, out);
  return out;
}

async function measure(files) {
  const acc = { files: files.length, ts: 0, json: 0, gzip: 0 };
  let corpus = '';
  for (const file of [...files].sort()) {
    const m = await measureFile(file);
    if (m.ext === '.json') acc.json += m.lines;
    else acc.ts += m.lines;
    corpus += m.code;
  }
  acc.gzip = corpus ? gzipSync(Buffer.from(corpus), { level: 9 }).length : 0;
  return acc;
}

/** Исходники `src/libs/**`, попавшие в статическое замыкание входа. */
function bundledLibFiles(entryDir) {
  const assets = path.join(entryDir, 'assets');
  const files = new Set();
  for (const name of readdirSync(assets).filter((f) => f.endsWith('.js.map'))) {
    const map = JSON.parse(readFileSync(path.join(assets, name), 'utf8'));
    for (const source of map.sources) {
      const abs = path.resolve(assets, source);
      if (abs.startsWith(libsDir) && /\.(tsx?|json)$/.test(abs)) files.add(abs);
    }
  }
  // JSON-модули vite встраивает без sourcemap — добавляем JSON, импортированный попавшими исходниками.
  for (const file of [...files]) {
    if (!/\.tsx?$/.test(file)) continue;
    for (const m of readFileSync(file, 'utf8').matchAll(/from\s+['"](\.{1,2}\/[^'"]+\.json)['"]/g)) {
      const json = path.resolve(path.dirname(file), m[1]);
      if (json.startsWith(libsDir) && existsSync(json)) files.add(json);
    }
  }
  return files;
}

const report = {};
for (const entry of manifest.entries) {
  if (entry.role === 'control') continue; // A/A-копия — тот же код
  for (const form of manifest.forms) {
    const entryDir = path.join(dist, entry.id, form);
    if (!existsSync(path.join(entryDir, 'build-entry.json'))) continue;
    const files = bundledLibFiles(entryDir);
    const formDir = path.join(libsDir, entry.impl, form) + path.sep;
    const own = [...files].filter((f) => f.startsWith(formDir));
    const kit = [...files].filter((f) => !f.startsWith(formDir));
    report[entry.impl] ??= {};
    report[entry.impl][form] = {
      form: await measure(own),
      kit: await measure(kit),
      total: await measure([...files]),
      kitFiles: kit.map((f) => path.relative(libsDir, f)).sort(),
    };
  }
}

writeFileSync(
  path.join(dist, 'code-report.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), basis: 'bundled sources', report }, null, 2)
);

console.log('реализация/форма'.padEnd(28), 'форма TS JSON', '| обвязка TS JSON', '| итого TS+JSON  gzip');
for (const [impl, forms] of Object.entries(report)) {
  for (const [form, r] of Object.entries(forms)) {
    console.log(
      `${impl}/${form}`.padEnd(28),
      String(r.form.ts).padStart(8),
      String(r.form.json).padStart(4),
      '|',
      String(r.kit.ts).padStart(10),
      String(r.kit.json).padStart(4),
      '|',
      String(r.total.ts + r.total.json).padStart(7),
      String(r.total.gzip).padStart(6)
    );
  }
}

// Защита от тихого нуля: страница реализации без единого файла реализации — ошибка сборки отчёта.
for (const [impl, forms] of Object.entries(report)) {
  for (const [form, r] of Object.entries(forms)) {
    if (impl !== 'baseline' && r.total.files === 0) {
      throw new Error(`${impl}/${form}: в бандле нет исходников src/libs — нет sourcemap?`);
    }
  }
}
void statSync;

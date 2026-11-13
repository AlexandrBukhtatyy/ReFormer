#!/usr/bin/env node
/**
 * Размер бандла каждой страницы бенчмарка (после scripts/build-entries.mjs).
 *
 * - Статическое замыкание входа (vite-манифест: entry + imports) и динамические чанки отдельно.
 * - raw / gzip (zlib 9) / brotli (11) — только на вход целиком: сжатие на пакеты не делится.
 * - Атрибуция минифицированных байтов по пакетам — по sourcemap (source-map-explorer).
 * - Прирост над baseline той же формы — «стоимость» библиотеки и реализации.
 *
 * Результат: dist/bundle-report.json + таблица в консоль.
 */
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { explore } from 'source-map-explorer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

function packageOf(source) {
  const s = source.replace(/\\/g, '/');
  let m = s.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/g);
  if (m) return m[m.length - 1].replace('node_modules/', '');
  m = s.match(/packages\/(reformer[^/]*)\//);
  if (m) {
    const dir = m[1];
    const map = {
      reformer: '@reformer/core',
      'reformer-cdk': '@reformer/cdk',
      'reformer-renderer-react': '@reformer/renderer-react',
      'reformer-renderer-json': '@reformer/renderer-json',
    };
    return map[dir] ?? `@reformer/${dir}`;
  }
  if (s.includes('/src/shared/')) return 'bench: shared';
  if (s.includes('/src/libs/')) return 'implementation';
  if (s.includes('/src/')) return 'bench: harness';
  return s.startsWith('[') ? s : 'other';
}

async function attribute(file) {
  const map = `${file}.map`;
  if (!existsSync(map)) return {};
  const result = await explore({ code: file, map }, { output: { format: 'json' }, noBorderChecks: true });
  const out = {};
  for (const [source, info] of Object.entries(result.bundles[0].files)) {
    const pkg = packageOf(source);
    out[pkg] = (out[pkg] ?? 0) + info.size;
  }
  return out;
}

const compress = (buf) => ({
  raw: buf.length,
  gzip: gzipSync(buf, { level: 9 }).length,
  brotli: brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
});

const entries = [];
for (const id of readdirSync(dist)) {
  const idDir = path.join(dist, id);
  if (!statSync(idDir).isDirectory()) continue;
  for (const form of readdirSync(idDir)) {
    const dir = path.join(idDir, form);
    if (!existsSync(path.join(dir, 'build-entry.json'))) continue;
    const manifest = JSON.parse(readFileSync(path.join(dir, '.vite/manifest.json'), 'utf8'));
    const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
    const staticFiles = new Set();
    const dynamicFiles = new Set();
    const walk = (key, dynamic) => {
      const chunk = manifest[key];
      if (!chunk) return;
      const set = dynamic ? dynamicFiles : staticFiles;
      if (set.has(chunk.file) || staticFiles.has(chunk.file)) return;
      set.add(chunk.file);
      for (const imp of chunk.imports ?? []) walk(imp, dynamic);
      for (const imp of chunk.dynamicImports ?? []) walk(imp, true);
    };
    walk(entryKey, false);
    const read = (files) => Buffer.concat([...files].map((f) => readFileSync(path.join(dir, f))));
    const packages = {};
    for (const f of staticFiles) {
      for (const [pkg, size] of Object.entries(await attribute(path.join(dir, f)))) {
        packages[pkg] = (packages[pkg] ?? 0) + size;
      }
    }
    const css = (manifest[entryKey].css ?? []).map((f) => readFileSync(path.join(dir, f)).length);
    entries.push({
      id,
      form,
      js: compress(read(staticFiles)),
      jsDynamic: dynamicFiles.size ? compress(read(dynamicFiles)) : null,
      cssRaw: css.reduce((a, b) => a + b, 0),
      chunks: staticFiles.size,
      packages,
    });
  }
}

for (const e of entries) {
  const base = entries.find((b) => b.id === 'baseline' && b.form === e.form);
  e.overBaseline = base
    ? {
        raw: e.js.raw - base.js.raw,
        gzip: e.js.gzip - base.js.gzip,
        brotli: e.js.brotli - base.js.brotli,
      }
    : null;
}

writeFileSync(path.join(dist, 'bundle-report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2));

const kb = (n) => (n === null || n === undefined ? '—' : `${(n / 1024).toFixed(1)}`);
console.log('вход'.padEnd(34), 'raw КБ', 'gzip', 'brotli', '+gzip над baseline');
for (const e of entries.sort((a, b) => a.form.localeCompare(b.form) || a.js.gzip - b.js.gzip)) {
  console.log(
    `${e.id}/${e.form}`.padEnd(34),
    kb(e.js.raw).padStart(6),
    kb(e.js.gzip).padStart(5),
    kb(e.js.brotli).padStart(6),
    kb(e.overBaseline?.gzip).padStart(8)
  );
}

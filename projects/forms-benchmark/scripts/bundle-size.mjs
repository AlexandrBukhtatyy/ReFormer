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
 *
 * `--frameworks` — страницы стеков набора «ReFormer в React, Vue и Angular»
 * (scripts/build-frameworks.mjs, маркер frameworks-entry.json): замыкание — от модулей HTML-страницы
 * по `import … from` чанков (у Angular нет манифеста Vite; правило одинаково для Rollup и esbuild),
 * свои корзины пакетов (общий код формы и код хоста), без baseline. Результат —
 * dist/frameworks-bundle-report.json.
 */
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { explore } from 'source-map-explorer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const FRAMEWORKS = process.argv.includes('--frameworks');

function packageOf(source) {
  const s = source.replace(/\\/g, '/');
  if (FRAMEWORKS) {
    const own = frameworksBucket(s);
    if (own) return own;
  }
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

/**
 * Корзины страниц стеков: пакеты ReFormer — по имени из их package.json (каталог пакета ≠ имя),
 * общий код формы (документ, правила, поведение, API, харнесс — forms-benchmark/src) и код хоста
 * (реестр кита, вход страницы, компоненты приложения — <хост>/src).
 *
 * Пакеты Angular, Taiga UI и ng-web-apis публикуют карты с путями своих репозиториев, а не
 * `node_modules/<пакет>`: `…/bin/packages/<имя>/` и `…/bin/src/cdk/` — `@angular/*`,
 * `node_modules/projects/<имя>/` — `@taiga-ui/*`, `node_modules/libs/<имя>/` — `@ng-web-apis/*`.
 */
const packageNames = new Map();
function frameworksBucket(s) {
  const angular = s.match(/\/bin\/packages\/([^/]+)\//);
  if (angular) return `@angular/${angular[1]}`;
  if (s.includes('/bin/src/cdk/')) return '@angular/cdk';
  const taiga = s.match(/node_modules\/projects\/([^/]+)\//);
  if (taiga) return `@taiga-ui/${taiga[1]}`;
  const webApis = s.match(/node_modules\/libs\/([^/]+)\//);
  if (webApis) return `@ng-web-apis/${webApis[1]}`;
  const pkg = s.match(/packages\/(reformer[^/]*)\//);
  if (pkg && !s.includes('node_modules/')) {
    if (!packageNames.has(pkg[1])) {
      const manifest = path.join(root, '../../packages', pkg[1], 'package.json');
      packageNames.set(
        pkg[1],
        existsSync(manifest)
          ? JSON.parse(readFileSync(manifest, 'utf8')).name
          : `@reformer/${pkg[1]}`
      );
    }
    return packageNames.get(pkg[1]);
  }
  if (s.includes('forms-benchmark/src/')) return 'форма: общий код';
  if (/(react|vue|angular)-playground\/src\//.test(s)) return 'хост';
  return null;
}

/**
 * @param sourceRoot - от чего отсчитаны пути карты (страницы стеков): у Vite — каталог карты, у
 *   Angular CLI — каталог приложения. Без него путь берётся как есть (страницы библиотек).
 */
async function attribute(file, sourceRoot = null) {
  const map = `${file}.map`;
  if (!existsSync(map)) return {};
  const result = await explore(
    { code: file, map },
    { output: { format: 'json' }, noBorderChecks: true }
  );
  const out = {};
  for (const [source, info] of Object.entries(result.bundles[0].files)) {
    const pkg = packageOf(
      sourceRoot ? path.resolve(sourceRoot, source).replace(/\\/g, '/') : source
    );
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

/** Модули страницы: `<script type="module" src>` и `<link rel="modulepreload">` HTML. */
function pageModules(dir, base) {
  const html = readFileSync(path.join(dir, 'index.html'), 'utf8');
  const local = (url) =>
    url.startsWith(base) ? url.slice(base.length) : url.replace(/^\.?\//, '');
  // Атрибуты тега — в любом порядке: у Vite `type` перед `src`, у Angular CLI — после.
  const tags = (name) =>
    [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'g'))].map((m) => m[1]);
  const attr = (attrs, key) => attrs.match(new RegExp(`\\b${key}="([^"]+)"`))?.[1] ?? null;
  const scripts = tags('script')
    .filter((a) => attr(a, 'type') === 'module' && attr(a, 'src'))
    .map((a) => attr(a, 'src'));
  const links = tags('link');
  const preloads = links
    .filter((a) => attr(a, 'rel') === 'modulepreload')
    .map((a) => attr(a, 'href'));
  const css = links.filter((a) => attr(a, 'rel') === 'stylesheet').map((a) => attr(a, 'href'));
  return { js: [...scripts, ...preloads].map(local), css: css.map(local) };
}

/** Статическое и динамическое замыкание от модулей страницы по импортам чанков. */
function closure(dir, starts) {
  const staticFiles = new Set();
  const dynamicFiles = new Set();
  const walk = (file, dynamic) => {
    const set = dynamic ? dynamicFiles : staticFiles;
    if (set.has(file) || staticFiles.has(file) || !existsSync(path.join(dir, file))) return;
    set.add(file);
    const code = readFileSync(path.join(dir, file), 'utf8');
    const near = (spec) => path.posix.join(path.posix.dirname(file), spec);
    const imports =
      /(?:^|[;}\s])(?:import|export)\s*(?:[\w$*{}\s,]*?from\s*)?["'](\.\.?\/[^"']+\.m?js)["']/g;
    for (const m of code.matchAll(imports)) walk(near(m[1]), dynamic);
    for (const m of code.matchAll(/import\(\s*["'](\.\.?\/[^"']+\.m?js)["']\s*\)/g)) {
      walk(near(m[1]), true);
    }
  };
  for (const start of starts) walk(start, false);
  return { staticFiles, dynamicFiles };
}

if (FRAMEWORKS) {
  for (const id of readdirSync(dist)) {
    const idDir = path.join(dist, id);
    if (!statSync(idDir).isDirectory()) continue;
    for (const form of readdirSync(idDir)) {
      const dir = path.join(idDir, form);
      const marker = path.join(dir, 'frameworks-entry.json');
      if (!existsSync(marker)) continue;
      const { base, bundler, host } = JSON.parse(readFileSync(marker, 'utf8'));
      const modules = pageModules(dir, base);
      const { staticFiles, dynamicFiles } = closure(dir, modules.js);
      const read = (files) =>
        Buffer.concat([...files].map((file) => readFileSync(path.join(dir, file))));
      const packages = {};
      for (const file of staticFiles) {
        const full = path.join(dir, file);
        // Пути карт: у Vite — от каталога карты, у Angular CLI — от каталога приложения.
        const sourceRoot = bundler === 'angular' ? path.join(root, '..', host) : path.dirname(full);
        for (const [pkg, size] of Object.entries(await attribute(full, sourceRoot))) {
          packages[pkg] = (packages[pkg] ?? 0) + size;
        }
      }
      entries.push({
        id,
        form,
        js: compress(read(staticFiles)),
        jsDynamic: dynamicFiles.size ? compress(read(dynamicFiles)) : null,
        cssRaw: modules.css.reduce((a, file) => a + readFileSync(path.join(dir, file)).length, 0),
        chunks: staticFiles.size,
        packages,
      });
    }
  }
}

for (const id of FRAMEWORKS ? [] : readdirSync(dist)) {
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

writeFileSync(
  path.join(dist, FRAMEWORKS ? 'frameworks-bundle-report.json' : 'bundle-report.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2)
);

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

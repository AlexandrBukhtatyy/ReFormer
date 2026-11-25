#!/usr/bin/env node
/**
 * Страницы трёх стеков для замеров «ReFormer в React, Vue и Angular»: регистрация и кредит хостов
 * кросс-e2e — React + `@reformer/ui-kit` (react-playground), Vue + Vuetify (vue-playground),
 * Angular + Taiga UI (angular-playground). Prod-сборка на стек × форму → `dist/<stack>/<form>/`, рядом
 * со страницами библиотек и с того же сервера (`scripts/serve.mjs`): условия загрузки одни.
 *
 * - React и Vue — JS-API Vite с конфигом самого хоста, один вход на сборку (как `build-entries.mjs`:
 *   отдельная сборка — точные байты без чужих чанков).
 * - Angular — `ng build` конфигурацией `bench-<form>` (статический вход формы без ленивого чанка,
 *   без встраивания критичного CSS) по адресу `--base-href`.
 *
 * Маркер входа — `frameworks-entry.json`, не `build-entry.json`: страницы стеков — не участники
 * набора библиотек, их не видят `build-info.json` и размеры бандлов библиотек. Сведения о сборке —
 * `dist/frameworks-info.json`.
 *
 * Опции: --only <stack>[,<stack>]; --form <form>.
 */
import { build } from 'vite';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkReformerPackages } from './lib/reformer-packages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projects = path.resolve(root, '..');
const repo = path.resolve(root, '../..');
const dist = path.join(root, 'dist');

/** Стеки: id — как `StackId` кросс-e2e (`cross-framework-e2e/stacks.ts`). */
const STACKS = [
  { id: 'react', host: 'react-playground', bundler: 'vite' },
  { id: 'vue', host: 'vue-playground', bundler: 'vite' },
  { id: 'angular', host: 'angular-playground', bundler: 'angular' },
];
const FORMS = ['registration', 'credit'];
const ENTRY_FILE = 'frameworks-entry.json';
const INFO_FILE = 'frameworks-info.json';

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const only = argValue('--only')?.split(',');
const onlyForm = argValue('--form');

// ── Пакеты @reformer/* — из dist: устаревшая сборка дала бы чужие числа ──────────
const packages = checkReformerPackages(
  repo,
  [
    'reformer',
    'reformer-cdk',
    'reformer-renderer-json',
    'reformer-renderer-react',
    'reformer-ui-kit',
    'reformer-renderer-vue',
    'reformer-kit-vuetify',
    'reformer-renderer-angular',
    'reformer-kit-taiga',
  ],
  'core → cdk → renderer-json → renderer-react, ui-kit, renderer-vue, kit-vuetify, ' +
    'renderer-angular, kit-taiga'
);

// ── Сборка ───────────────────────────────────────────────────────────────────
async function buildWithVite(stack, form, outDir) {
  const hostDir = path.join(projects, stack.host);
  await build({
    root: hostDir,
    configFile: path.join(hostDir, 'vite.config.ts'),
    mode: 'production',
    base: `/${stack.id}/${form}/`,
    publicDir: false,
    logLevel: 'warn',
    build: {
      outDir,
      emptyOutDir: true,
      manifest: true,
      sourcemap: 'hidden',
      reportCompressedSize: false,
      // Строкой: объект слился бы с входами из конфига хоста (у Vue — все его страницы).
      rollupOptions: { input: path.join(hostDir, 'cross', form, 'index.html') },
    },
  });
  // Vite кладёт страницу по её пути от корня хоста; ресурсы адресуются от `base`, поэтому страницу
  // можно поднять в корень каталога.
  renameSync(path.join(outDir, 'cross', form, 'index.html'), path.join(outDir, 'index.html'));
  rmSync(path.join(outDir, 'cross'), { recursive: true, force: true });
}

function buildWithAngular(stack, form, outDir) {
  const hostDir = path.join(projects, stack.host);
  const out = mkdtempSync(path.join(tmpdir(), `bench-${stack.id}-${form}-`));
  try {
    execFileSync(
      'npx',
      [
        'ng',
        'build',
        '--configuration',
        `bench-${form}`,
        '--base-href',
        `/${stack.id}/${form}/`,
        '--output-path',
        out,
      ],
      { cwd: hostDir, stdio: 'inherit', shell: process.platform === 'win32' }
    );
    rmSync(outDir, { recursive: true, force: true });
    cpSync(path.join(out, 'browser'), outDir, { recursive: true });
    // Граф чанков сборки (esbuild metafile): по нему размер бандла считает статическое замыкание.
    cpSync(path.join(out, 'stats.json'), path.join(outDir, 'stats.json'));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

/** Все `.map` каталога — исходники бандла для проверок. */
function sourcesOf(dir) {
  const sources = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = path.join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.js.map'))
        sources.push(...JSON.parse(readFileSync(p, 'utf8')).sources);
    }
  };
  walk(dir);
  return sources;
}

// Prod-код без отладочного и чужого: сборка разработки React, моки сети и роутер playground'а.
const FORBIDDEN = [
  ['development-сборка', /\.development\.js$/],
  ['моки сети (msw)', /node_modules\/msw\/|\/src\/mocks\//],
  ['роутер playground', /node_modules\/react-router/],
];

const targets = STACKS.filter((stack) => !only || only.includes(stack.id)).flatMap((stack) =>
  FORMS.filter((form) => !onlyForm || form === onlyForm).map((form) => ({ stack, form }))
);

for (const { stack, form } of targets) {
  const outDir = path.join(dist, stack.id, form);
  const started = Date.now();
  if (stack.bundler === 'vite') await buildWithVite(stack, form, outDir);
  else buildWithAngular(stack, form, outDir);

  const html = readFileSync(path.join(outDir, 'index.html'), 'utf8');
  if (!html.includes("performance.mark('bench:html')")) {
    throw new Error(`${stack.id}/${form}: в странице нет метки bench:html`);
  }
  const sources = sourcesOf(outDir);
  if (sources.length === 0) throw new Error(`${stack.id}/${form}: нет карт исходников`);
  for (const [label, re] of FORBIDDEN) {
    const hit = sources.find((source) => re.test(source));
    if (hit) throw new Error(`${stack.id}/${form}: в бандле ${label}: ${hit}`);
  }
  writeFileSync(
    path.join(outDir, ENTRY_FILE),
    JSON.stringify({
      id: stack.id,
      form,
      base: `/${stack.id}/${form}/`,
      bundler: stack.bundler,
      host: stack.host,
      builtAt: new Date().toISOString(),
    })
  );
  console.log(`✓ ${stack.id}/${form} — ${Date.now() - started} мс`);
}

// ── Сведения о сборке ────────────────────────────────────────────────────────
const git = (...a) => {
  try {
    return execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};

/** Версия пакета, которую видит хост: подъём по `node_modules` от его каталога. */
function versionFrom(dir, name) {
  for (let d = dir; ; d = path.dirname(d)) {
    const manifest = path.join(d, 'node_modules', name, 'package.json');
    if (existsSync(manifest)) return JSON.parse(readFileSync(manifest, 'utf8')).version;
    if (path.dirname(d) === d) return null;
  }
}

const VERSIONS = {
  react: ['react', 'react-dom'],
  vue: ['vue', 'vuetify'],
  angular: ['@angular/core', '@taiga-ui/core'],
};
// Пакеты ReFormer — из их каталогов (страницы берут их dist), фреймворки и киты — как их видит хост.
const versions = Object.fromEntries(
  Object.entries(packages).map(([name, { version }]) => [name, version])
);
for (const stack of STACKS) {
  for (const name of VERSIONS[stack.id]) {
    versions[name] = versionFrom(path.join(projects, stack.host), name);
  }
}

const entries = [];
for (const stack of STACKS) {
  for (const form of FORMS) {
    if (existsSync(path.join(dist, stack.id, form, ENTRY_FILE)))
      entries.push({ id: stack.id, form });
  }
}
const info = {
  builtAt: new Date().toISOString(),
  git: { sha: git('rev-parse', 'HEAD'), dirty: Boolean(git('status', '--porcelain')) },
  reformerPackages: packages,
  versions,
  entries,
};
writeFileSync(path.join(dist, INFO_FILE), JSON.stringify(info, null, 2));
console.log(`${INFO_FILE} → ${entries.length} страниц`);

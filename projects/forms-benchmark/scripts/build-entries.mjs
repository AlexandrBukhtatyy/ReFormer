#!/usr/bin/env node
/**
 * Сборка бенчмарка: ОТДЕЛЬНЫЙ `vite build` на каждый вход (участник × форма) → dist/<id>/<form>/.
 *
 * Почему не один MPA-билд: Rollup делает tree-shaking по бандлу, а не по входу, и общий чанк
 * (`@reformer/core`, общий UI) нёс бы код, нужный только соседней странице; границы чанков ещё и
 * сдвигаются от набора входов. Отдельная сборка даёт точные байты и честную холодную загрузку.
 *
 * Перед сборкой — защита от устаревшего dist пакетов @reformer/* (они потребляются из dist), после —
 * ассерты содержимого бандлов (prod-сборка, нет ui-kit/Radix/tailwind).
 *
 * Опции: --only <id>[,<id>] — собрать только этих участников; --form <form>.
 */
import { build } from 'vite';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(root, '../..');
const dist = path.join(root, 'dist');
const manifest = JSON.parse(readFileSync(path.join(root, 'entries.json'), 'utf8'));

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const only = argValue('--only')?.split(',');
const onlyForm = argValue('--form');

// ── Защита от устаревшего dist @reformer/* ───────────────────────────────────
const REFORMER_PACKAGES = ['reformer', 'reformer-cdk', 'reformer-renderer-react', 'reformer-renderer-json'];

function newestMtime(dir) {
  let newest = 0;
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = path.join(d, name);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else newest = Math.max(newest, s.mtimeMs);
    }
  };
  walk(dir);
  return newest;
}

function hashDir(dir) {
  const h = createHash('sha256');
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const p = path.join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else h.update(name).update(readFileSync(p));
    }
  };
  walk(dir);
  return h.digest('hex').slice(0, 16);
}

const packages = {};
for (const pkg of REFORMER_PACKAGES) {
  const pkgDir = path.join(repo, 'packages', pkg);
  const pkgDist = path.join(pkgDir, 'dist');
  if (!existsSync(pkgDist)) {
    throw new Error(`packages/${pkg}/dist отсутствует — соберите пакеты: npm run build:stackblitz -w <пакет>`);
  }
  const srcTime = newestMtime(path.join(pkgDir, 'src'));
  const distTime = newestMtime(pkgDist);
  if (srcTime > distTime) {
    throw new Error(
      `packages/${pkg}/dist старее src — пересоберите (core → cdk → renderer-react → renderer-json)`
    );
  }
  const { name, version } = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  packages[name] = { version, distHash: hashDir(pkgDist) };
}

// ── Список входов ────────────────────────────────────────────────────────────
const targets = [];
for (const entry of manifest.entries) {
  if (only && !only.includes(entry.id)) continue;
  for (const form of manifest.forms) {
    if (onlyForm && form !== onlyForm) continue;
    const main = `src/libs/${entry.impl}/${form}/main.tsx`;
    if (!existsSync(path.join(root, main))) {
      console.log(`· пропуск ${entry.id}/${form}: нет ${main}`);
      continue;
    }
    targets.push({ id: entry.id, form, main, outDir: path.join(dist, entry.id, form), base: `/${entry.id}/${form}/` });
  }
}
for (const page of manifest.pages ?? []) {
  if (only && !only.includes(page.id)) continue;
  if (onlyForm) continue;
  targets.push({ id: page.id, form: null, main: page.entry, outDir: path.join(dist, page.id), base: `/${page.id}/` });
}

// ── Сборка ───────────────────────────────────────────────────────────────────
// Проверка по МОДУЛЯМ бандла (sources из sourcemap), а не по тексту: в тексте встречаются строки
// предупреждений вроде «…from @reformer/ui-kit», это не подключённый код.
const FORBIDDEN = [
  ['@reformer/ui-kit', /packages\/reformer-ui-kit\/|node_modules\/@reformer\/ui-kit\//],
  ['Radix', /node_modules\/@radix-ui\//],
  ['tailwind', /node_modules\/tailwindcss\//],
];

const built = [];
for (const t of targets) {
  process.env.BENCH_ENTRY = t.main;
  rmSync(t.outDir, { recursive: true, force: true });
  const started = Date.now();
  await build({
    root,
    configFile: path.join(root, 'vite.config.ts'),
    mode: 'production',
    base: t.base,
    logLevel: 'warn',
    build: { outDir: t.outDir, emptyOutDir: true },
  });

  const assets = path.join(t.outDir, 'assets');
  const jsFiles = readdirSync(assets).filter((f) => f.endsWith('.js'));
  const sources = jsFiles.flatMap((file) => {
    const map = path.join(assets, `${file}.map`);
    return existsSync(map) ? JSON.parse(readFileSync(map, 'utf8')).sources : [];
  });
  for (const [label, re] of FORBIDDEN) {
    const hit = sources.find((s) => re.test(s));
    if (hit) throw new Error(`${t.id}/${t.form ?? ''}: в бандле модуль ${label}: ${hit}`);
  }
  if (sources.some((s) => /\.development\.js$/.test(s))) {
    throw new Error(`${t.id}/${t.form ?? ''}: в бандле development-сборка React`);
  }
  if (t.id.startsWith('reformer-json') && sources.some((s) => /node_modules\/ajv\//.test(s))) {
    // validateFormSchema (ajv) у renderer-json должен оставаться dev-only.
    throw new Error(`${t.id}/${t.form}: в бандле renderer-json оказался ajv`);
  }
  built.push({ id: t.id, form: t.form, base: t.base });
  console.log(`✓ ${t.id}/${t.form ?? ''} — ${Date.now() - started} мс`);
}

// ── Сведения о сборке ────────────────────────────────────────────────────────
const git = (...a) => {
  try {
    return execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};
const dependencies = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).dependencies;
const resolved = {};
for (const name of Object.keys(dependencies)) {
  for (const base of [path.join(root, 'node_modules'), path.join(repo, 'node_modules')]) {
    const p = path.join(base, name, 'package.json');
    if (existsSync(p)) {
      resolved[name] = JSON.parse(readFileSync(p, 'utf8')).version;
      break;
    }
  }
}
// Список входов — сканированием dist/, а не слиянием с прежним файлом: параллельные частичные
// сборки (--only) не теряют чужие входы.
for (const t of built) {
  const dir = t.form ? path.join(dist, t.id, t.form) : path.join(dist, t.id);
  writeFileSync(path.join(dir, 'build-entry.json'), JSON.stringify({ ...t, builtAt: new Date().toISOString() }));
}
const entries = [];
for (const id of readdirSync(dist)) {
  const idDir = path.join(dist, id);
  if (!statSync(idDir).isDirectory()) continue;
  if (existsSync(path.join(idDir, 'build-entry.json'))) entries.push({ id, form: null });
  for (const form of readdirSync(idDir)) {
    if (existsSync(path.join(idDir, form, 'build-entry.json'))) entries.push({ id, form });
  }
}
const info = {
  builtAt: new Date().toISOString(),
  git: { sha: git('rev-parse', 'HEAD'), dirty: Boolean(git('status', '--porcelain')) },
  reformerPackages: packages,
  versions: resolved,
  entries,
};
const infoPath = path.join(dist, 'build-info.json');
writeFileSync(infoPath, JSON.stringify(info, null, 2));
console.log(`build-info → ${path.relative(root, infoPath)} (${info.entries.length} входов)`);

/**
 * Общее для быстрого замера «до/после» (`ab.mjs`) и профиля (`profile.mjs`).
 *
 * Вариант — сборка страниц бенча, в которой `@reformer/core` и `@reformer/cdk` взяты из ИСХОДНИКОВ:
 * рабочего дерева либо git-ревизии (исходники ревизии выгружаются `git archive` в
 * `results/_ab/src-<sha>`). Поэтому `dist` пакетов пересобирать не нужно и защита устаревшего `dist`
 * здесь не участвует. Остальные пакеты `@reformer/*` берутся из своего `dist`, а их импорты ядра и
 * cdk попадают в те же исходники. Сборка — без минификации и с картами: имена функций в профиле.
 *
 * Это инструмент разработки ядра, а не замер для отчёта: числа отчёта снимает `npm run bench` по
 * prod-сборкам из `dist`.
 */
/* global window -- функции, переданные в page.waitForFunction, исполняются на странице */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const E2E = path.resolve(here, '../..');
export const REPO = path.resolve(E2E, '../..');
export const APP = path.join(REPO, 'projects/forms-benchmark');
export const AB_DIR = path.join(E2E, 'results/_ab');

/** Пакеты, которые вариант берёт из исходников. */
const SOURCE_PACKAGES = ['reformer', 'reformer-cdk'];

/** Аргументы `--ключ значение` и флаги `--ключ`. */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[token.slice(2)] = true;
    else args[token.slice(2)] = argv[++i];
  }
  return args;
}

const git = (...args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim();

/**
 * Алиасы подпутей пакета на его исходники под `srcRoot`. Входы берутся из `build.lib.entry`
 * vite-конфига пакета — того же, что собирает `dist`, — поэтому новый подпуть подхватывается сам.
 */
async function packageAliases(vite, srcRoot) {
  const aliases = [];
  for (const dir of SOURCE_PACKAGES) {
    const pkgDir = path.join(REPO, 'packages', dir);
    const { name } = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
    const loaded = await vite.loadConfigFromFile(
      { command: 'build', mode: 'production' },
      path.join(pkgDir, 'vite.config.ts'),
      pkgDir,
      'silent'
    );
    const entry = loaded?.config.build?.lib?.entry;
    if (entry === undefined || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`bench:ab: у ${name} не найден объект build.lib.entry в vite.config.ts`);
    }
    for (const [key, file] of Object.entries(entry)) {
      const sub = key === 'index' ? '' : `/${key}`;
      const escaped = `${name}${sub}`.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
      aliases.push({
        find: new RegExp(`^${escaped}$`),
        replacement: path.join(srcRoot, path.relative(REPO, file)),
      });
    }
  }
  return aliases;
}

/** Исходники пакетов ревизии — в `results/_ab/src-<sha>`; повторно не выгружаются. */
function sourcesOf(sha) {
  const dir = path.join(AB_DIR, `src-${sha}`);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    const paths = SOURCE_PACKAGES.map((pkg) => `packages/${pkg}/src`);
    const tar = execFileSync('git', ['archive', sha, ...paths], {
      cwd: REPO,
      maxBuffer: 256 * 1024 * 1024,
    });
    execFileSync('tar', ['-x', '-C', dir], { input: tar });
  }
  return dir;
}

/** Участники бенча: id → каталог реализации. */
function implOf(lib) {
  const { entries } = JSON.parse(fs.readFileSync(path.join(APP, 'entries.json'), 'utf8'));
  const entry = entries.find((item) => item.id === lib);
  if (!entry) throw new Error(`bench:ab: участника «${lib}» нет в entries.json`);
  return entry.impl;
}

/**
 * Собрать вариант. `rev` — git-ревизия либо `work` (рабочее дерево).
 * Сборка ревизии неизменна и переиспользуется; рабочее дерево собирается заново каждый раз.
 *
 * @returns каталог сборки: `<dir>/<участник>/<форма>/index.html`.
 */
export async function buildVariant({ rev, libs, forms, rebuild = false }) {
  const vite = await import('vite');
  const work = rev === 'work';
  const sha = work ? 'work' : git('rev-parse', '--short', rev);
  const srcRoot = work ? REPO : sourcesOf(sha);
  const out = path.join(AB_DIR, `dist-${sha}`);
  const alias = await packageAliases(vite, srcRoot);
  for (const lib of libs) {
    const impl = implOf(lib);
    for (const form of forms) {
      const outDir = path.join(out, lib, form);
      if (!work && !rebuild && fs.existsSync(path.join(outDir, 'index.html'))) continue;
      process.env.BENCH_ENTRY = `src/libs/${impl}/${form}/main.tsx`;
      await vite.build({
        root: APP,
        configFile: path.join(APP, 'vite.config.ts'),
        mode: 'production',
        resolve: { alias },
        base: `/${lib}/${form}/`,
        logLevel: 'warn',
        build: { outDir, emptyOutDir: true, minify: false, sourcemap: true },
      });
      console.log(`собрано: ${sha} ${lib}/${form}`);
    }
  }
  return out;
}

const CONTENT_TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/** Страница участника из каталога сборки, готовая к замеру, с троттлингом CPU. */
export async function openPage(browser, { dist, lib, form, cpu }) {
  const context = await browser.newContext();
  await context.route('http://bench.local/**', (route) => {
    const url = new URL(route.request().url());
    let file = path.join(dist, decodeURIComponent(url.pathname));
    if (file.endsWith(path.sep)) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({
      path: file,
      contentType: CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream',
    });
  });
  const page = await context.newPage();
  await page.goto(`http://bench.local/${lib}/${form}/`);
  await page.waitForFunction(() => window.__bench?.readyAt != null, null, { timeout: 30_000 });
  const cdp = await context.newCDPSession(page);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  return { context, page, cdp };
}

/** Поле для сценария ввода по умолчанию: видно сразу после монтирования формы. */
export const DEFAULT_FIELD = { registration: 'fullName', credit: 'loanPurpose' };

/** Кнопка, которая переводит форму в живую фазу проверки. */
export const LIVE_BUTTON = { registration: 'btn-submit', credit: 'btn-next' };

export const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
}

/** Среднее без 10 % самых малых и 10 % самых больших значений. */
export function trimmedMean(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const cut = Math.floor(sorted.length * 0.1);
  return mean(sorted.slice(cut, sorted.length - cut));
}

/** Стандартная ошибка среднего. */
export function standardError(values) {
  if (values.length < 2) return NaN;
  const m = mean(values);
  const variance = values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance / values.length);
}

/**
 * Воркспейсы монорепозитория для графа зависимостей.
 *
 * Список берётся из `workspaces` корневого package.json, а не задаётся в скрипте:
 * новый пакет попадает в граф без правки инструмента.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Posix-разделители: пути в графе одинаковы на Windows и в CI. */
export function toPosix(p) {
  return p.split(path.sep).join('/');
}

/** Лежит ли `file` внутри каталога `dir` (сам `dir` тоже считается). */
export function isInside(dir, file) {
  const rel = path.relative(dir, file);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Раскрывает маску `каталог/*` — другой формы в корневом package.json нет. */
function expand(pattern) {
  if (!pattern.endsWith('/*')) return [pattern];
  const base = pattern.slice(0, -2);
  const abs = path.join(ROOT, base);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${base}/${entry.name}`);
}

/** Выходные каталоги: сборка, отчёты, зависимости — в обход не попадают. */
const OUTPUT_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  'playwright-report',
  'test-results',
  'screenshots',
  'videos',
]);

/** Каталоги тестов рядом с `src` — обходятся только с `--with-tests`. */
const TEST_DIRS = ['tests', 'test', '__tests__', 'e2e'];

/**
 * Что обходить: `src`, а если его нет — верхние каталоги и файлы кода воркспейса,
 * кроме выходных и скрытых.
 */
function pickRoots(dir) {
  if (fs.existsSync(path.join(dir, 'src'))) return ['src'];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.') && !OUTPUT_DIRS.has(entry.name))
    .filter((entry) => entry.isDirectory() || /\.[cm]?[jt]sx?$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

/**
 * tsconfig, по которому резолвятся алиасы (`@/…`, `@builder-src/…`). У Vite-проектов
 * это `tsconfig.app.json`: их `tsconfig.json` — только ссылки на подпроекты.
 */
function pickTsConfig(dir) {
  return (
    ['tsconfig.app.json', 'tsconfig.json']
      .map((name) => path.join(dir, name))
      .find((file) => fs.existsSync(file)) ?? null
  );
}

/**
 * @typedef {object} Workspace
 * @property {string} name     имя пакета (`@reformer/builder`)
 * @property {string} rel      путь от корня (`projects/reformer-builder`)
 * @property {string} dir      абсолютный путь
 * @property {string} slug     имя каталога — так называется каталог с результатом
 * @property {string[]} roots  что обходить: `src`, если он есть, иначе верх воркспейса
 * @property {string[]} testRoots  тесты рядом с `src` (`tests/`) — для `--with-tests`
 * @property {string | null} tsConfig
 */

/**
 * Корни обхода с учётом тестов.
 *
 * @param {Workspace} ws
 * @param {{ withTests: boolean }} options
 */
export function rootsOf(ws, { withTests }) {
  return withTests ? [...ws.roots, ...ws.testRoots] : ws.roots;
}

/** @returns {Workspace[]} */
export function listWorkspaces() {
  const { workspaces = [] } = readJson(path.join(ROOT, 'package.json'));
  const patterns = Array.isArray(workspaces) ? workspaces : (workspaces.packages ?? []);
  return patterns
    .flatMap(expand)
    .filter((rel) => fs.existsSync(path.join(ROOT, rel, 'package.json')))
    .map((rel) => {
      const dir = path.join(ROOT, rel);
      return {
        name: readJson(path.join(dir, 'package.json')).name,
        rel,
        dir,
        slug: path.basename(dir),
        roots: pickRoots(dir),
        testRoots: fs.existsSync(path.join(dir, 'src'))
          ? TEST_DIRS.filter((name) => fs.existsSync(path.join(dir, name)))
          : [],
        tsConfig: pickTsConfig(dir),
      };
    })
    .sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * Воркспейс по имени пакета (`@reformer/builder`), пути (`projects/reformer-builder` —
 * от каталога запуска или от корня) или имени каталога (`reformer-builder`).
 *
 * @param {Workspace[]} workspaces
 * @param {string} query
 * @param {string} cwd
 */
export function findWorkspace(workspaces, query, cwd) {
  const byName = workspaces.find((ws) => ws.name === query);
  if (byName) return byName;
  for (const base of [cwd, ROOT]) {
    const abs = path.resolve(base, query);
    const byPath = workspaces.find((ws) => path.relative(ws.dir, abs) === '');
    if (byPath) return byPath;
  }
  const bySlug = workspaces.filter((ws) => ws.slug === query);
  return bySlug.length === 1 ? bySlug[0] : null;
}

/**
 * Воркспейс, в каталоге которого лежит файл; при вложенности — самый глубокий.
 *
 * @param {Workspace[]} workspaces
 * @param {string} file абсолютный путь
 */
export function ownerOf(workspaces, file) {
  return (
    workspaces
      .filter((ws) => isInside(ws.dir, file))
      .sort((a, b) => b.dir.length - a.dir.length)[0] ?? null
  );
}

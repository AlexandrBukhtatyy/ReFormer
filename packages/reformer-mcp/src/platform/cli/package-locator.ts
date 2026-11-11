/**
 * Поиск установленных пакетов `@reformer/*` на диске — в обход `exports`.
 *
 * Прежний поиск резолвил `<pkg>/package.json` через `require.resolve`. У библиотечных пакетов в
 * `exports` нет `./package.json`, поэтому резолв падал с `ERR_PACKAGE_PATH_NOT_EXPORTED` у всех
 * шести, и справка держалась на зашитом пути монорепо от `dist` сервера. Вне монорепо (снимок
 * сервера, проект с поднятыми зависимостями) индексы не находились, справка была пуста, а
 * проверка импортов объявляла несуществующим код самого генератора (аудит 2026-11, C1).
 *
 * Здесь пакет ищется так, как его нашёл бы сборщик, но без резолва `exports`:
 *
 * 1. подъём от каждой базы по `node_modules/<pkg>/package.json` (и сама база, если это и есть
 *    пакет) — npm, pnpm (ссылки разворачиваются), поднятые зависимости;
 * 2. участники `workspaces` ближайшего корня монорепо — когда ссылок в `node_modules` нет;
 * 3. главный вход пакета через `import.meta.resolve` модуля сервера и подъём до его `package.json`
 *    — сервер под npx, где пакеты стоят рядом с ним.
 *
 * Базы по умолчанию — {@link defaultPackageBases}: рабочий каталог, `REFORMER_TYPECHECK_ROOT` и
 * каталог сервера. Совпадение имени в `package.json` обязательно: каталог с тем же именем, но
 * чужим пакетом не считается найденным.
 *
 * @module reformer-mcp/platform/cli/package-locator
 */

import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

/** Каталог, от которого резолвить пакеты, если в проекте их нет (стенд сценариев, снимки). */
export const TYPECHECK_ROOT_ENV = 'REFORMER_TYPECHECK_ROOT';

/** Как найден пакет. */
export type PackageVia = 'node_modules' | 'self' | 'workspace' | 'resolve';

export interface PackageLocation {
  readonly name: string;
  /** Корень пакета после разворота ссылок. */
  readonly root: string;
  readonly version: string | null;
  readonly via: PackageVia;
  /** База, от которой он найден. */
  readonly base: string;
}

const SERVER_DIRECTORY = dirname(fileURLToPath(import.meta.url));

/** Каталог модуля сервера — последняя база поиска. */
export function serverDirectory(): string {
  return SERVER_DIRECTORY;
}

interface Manifest {
  name?: unknown;
  version?: unknown;
  workspaces?: unknown;
}

function readManifest(dir: string): Manifest | null {
  const path = join(dir, 'package.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Manifest;
  } catch {
    return null;
  }
}

function canonical(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

function locationAt(
  dir: string,
  manifest: Manifest,
  via: PackageVia,
  base: string
): PackageLocation {
  return {
    name: String(manifest.name),
    root: canonical(dir),
    version: typeof manifest.version === 'string' ? manifest.version : null,
    via,
    base,
  };
}

/**
 * Базы поиска по умолчанию, по порядку: явные (каталог формы), рабочий каталог, `REFORMER_TYPECHECK_ROOT`,
 * каталог сервера. Повторы убираются.
 */
export function defaultPackageBases(first: readonly string[] = []): string[] {
  const bases = [...first, process.cwd()];
  const fallback = process.env[TYPECHECK_ROOT_ENV]?.trim();
  if (fallback) bases.push(fallback);
  bases.push(SERVER_DIRECTORY);
  return [...new Set(bases.map((base) => resolve(base)))];
}

/** Подъём от базы: сама база-пакет или `node_modules/<pkg>` на любом уровне. */
function fromNodeModules(pkg: string, base: string): PackageLocation | null {
  for (let dir = base; ; dir = dirname(dir)) {
    const own = readManifest(dir);
    if (own?.name === pkg) return locationAt(dir, own, 'self', base);
    const candidate = join(dir, 'node_modules', ...pkg.split('/'));
    const installed = readManifest(candidate);
    if (installed?.name === pkg) return locationAt(candidate, installed, 'node_modules', base);
    if (dirname(dir) === dir) return null;
  }
}

/** Шаблоны `workspaces` манифеста: массив или `{ packages: [...] }`. */
function workspacePatterns(manifest: Manifest): string[] {
  const value = manifest.workspaces;
  const list = Array.isArray(value)
    ? value
    : Array.isArray((value as { packages?: unknown } | undefined)?.packages)
      ? (value as { packages: unknown[] }).packages
      : [];
  return list.filter((item): item is string => typeof item === 'string');
}

/** Каталоги по шаблону workspaces: поддержаны точный путь и сегменты `*`. */
function expandPattern(root: string, pattern: string): string[] {
  let dirs = [root];
  for (const segment of pattern.replace(/\/+$/, '').split('/')) {
    if (!segment || segment === '.') continue;
    const next: string[] = [];
    for (const dir of dirs) {
      if (segment === '*') {
        let entries: string[] = [];
        try {
          entries = readdirSync(dir);
        } catch {
          entries = [];
        }
        for (const entry of entries) {
          const path = join(dir, entry);
          try {
            if (statSync(path).isDirectory()) next.push(path);
          } catch {
            // недоступный каталог — пропустить
          }
        }
      } else if (!segment.includes('*')) {
        next.push(join(dir, segment));
      }
    }
    dirs = next;
  }
  return dirs;
}

/** Участник `workspaces` ближайшего корня монорепо над базой. */
function fromWorkspaces(pkg: string, base: string): PackageLocation | null {
  for (let dir = base; ; dir = dirname(dir)) {
    const manifest = readManifest(dir);
    const patterns = manifest ? workspacePatterns(manifest) : [];
    if (patterns.length > 0) {
      for (const pattern of patterns) {
        for (const member of expandPattern(dir, pattern)) {
          const own = readManifest(member);
          if (own?.name === pkg) return locationAt(member, own, 'workspace', base);
        }
      }
      return null;
    }
    if (dirname(dir) === dir) return null;
  }
}

/** Главный вход пакета, как его резолвит модуль сервера, и подъём до `package.json`. */
function fromResolve(pkg: string): PackageLocation | null {
  let entry: string;
  try {
    entry = fileURLToPath(import.meta.resolve(pkg));
  } catch {
    return null;
  }
  for (let dir = dirname(entry); ; dir = dirname(dir)) {
    const own = readManifest(dir);
    if (own?.name === pkg) return locationAt(dir, own, 'resolve', SERVER_DIRECTORY);
    if (dirname(dir) === dir) return null;
  }
}

/**
 * Все места, где найден пакет, по убыванию приоритета, без повторов корня.
 *
 * Несколько мест нужны источникам артефактов: битый `llms-index.json` первой установки не должен
 * прятать исправный у следующей.
 */
export function locatePackages(
  pkg: string,
  bases: readonly string[] = defaultPackageBases()
): PackageLocation[] {
  const found: PackageLocation[] = [];
  const seen = new Set<string>();
  const add = (location: PackageLocation | null): void => {
    if (!location || seen.has(location.root)) return;
    seen.add(location.root);
    found.push(location);
  };
  for (const base of bases) add(fromNodeModules(pkg, base));
  for (const base of bases) add(fromWorkspaces(pkg, base));
  add(fromResolve(pkg));
  return found;
}

/** Первое место пакета или `null`. */
export function locatePackage(
  pkg: string,
  bases: readonly string[] = defaultPackageBases()
): PackageLocation | null {
  return locatePackages(pkg, bases)[0] ?? null;
}

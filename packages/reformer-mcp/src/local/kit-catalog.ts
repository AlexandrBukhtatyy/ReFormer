/**
 * Каталог кита приложения (`component-catalog.json`) для генератора форм.
 *
 * Кит — любая зависимость приложения, которая отдаёт каталог входом `./catalog`: `@reformer/ui-kit`,
 * `@reformer/kit-vuetify`, `@reformer/kit-taiga` или сторонний кит со своим каталогом. Генератор
 * знает кит только по каталогу: имена и пропсы компонентов, пакет для импорта, обёртку поля,
 * адаптеры визарда и фреймворк (`kit.framework`, по умолчанию `react`).
 *
 * Какой кит взять, если их у приложения несколько: тот, чей фреймворк совпадает с фреймворком
 * приложения (`@angular/core` в зависимостях — Angular, `vue` — Vue, иначе React), из них —
 * `@reformer/ui-kit`, иначе первый по имени пакета. Кита у приложения нет (или приложение не
 * нашлось) — как прежде: `@reformer/ui-kit`, где его найдёт поиск пакетов.
 *
 * Файлы читаются с диска, а не через `require`: кэш модулей держал бы старый JSON после пересборки
 * кита посреди сессии. Кэш здесь — по состоянию файлов: каталог — пока у файла те же время изменения
 * и размер (тот же объект: по нему клиент и сервер запоминают отпечаток и справочники), список китов
 * приложения — пока не менялись его `package.json` и метки установки в `node_modules` выше. Кит,
 * поставленный посреди сессии, виден со следующего вызова, а вызов не ищет заново каждую зависимость.
 *
 * @module @reformer/mcp/local/kit-catalog
 */

import { existsSync, readFileSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { defaultPackageBases, locatePackage, locatePackages } from './package-locator.js';
import { reportKnowledgeProblem } from './problems.js';
import { detectProjectStack, type KitFramework } from './project-detector.js';

export { frameworkOfDependencies, type KitFramework } from './project-detector.js';

/** Кит, найденный у приложения. */
export interface KitCatalogLocation {
  /** Имя пакета кита. */
  readonly package: string;
  /** Файл каталога. */
  readonly path: string;
  /** `kit.framework` каталога; нет поля — `react`. */
  readonly framework: KitFramework;
}

const UI_KIT = '@reformer/ui-kit';
const CATALOG_EXPORT = './catalog';
const CATALOG_FILE = 'component-catalog.json';
const FRAMEWORKS: readonly KitFramework[] = ['react', 'vue', 'angular'];

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8')) as unknown;
}

/** Время изменения и размер файла или каталога; нет его — `-`. */
function stampOf(path: string): string {
  try {
    const stat = statSync(path);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return '-';
  }
}

const catalogs = new Map<string, { readonly stamp: string; readonly json: unknown }>();

/**
 * Каталог из файла: тот же объект, пока файл не менялся. Объект общий — его не меняют. Файл не
 * читается — исключение, как у `JSON.parse`.
 */
function readCatalog(path: string): unknown {
  const stamp = stampOf(path);
  const cached = catalogs.get(path);
  if (cached && cached.stamp === stamp) return cached.json;
  const json = readJson(path);
  catalogs.set(path, { stamp, json });
  return json;
}

/** Метки установки пакетов: npm, pnpm, yarn переписывают их при каждой установке. */
const INSTALL_MARKERS = ['.package-lock.json', '.modules.yaml', '.yarn-state.yml'];

/** Состояние установки для приложения: его `package.json` и `node_modules` по пути вверх. */
function installStamp(projectRoot: string): string {
  const parts = [stampOf(join(projectRoot, 'package.json'))];
  for (let dir = projectRoot; ; dir = dirname(dir)) {
    const modules = join(dir, 'node_modules');
    if (existsSync(modules)) {
      parts.push(
        stampOf(modules),
        ...INSTALL_MARKERS.map((marker) => stampOf(join(modules, marker)))
      );
    }
    if (dirname(dir) === dir) break;
  }
  return parts.join('|');
}

const kitsByProject = new Map<
  string,
  { readonly stamp: string; readonly kits: KitCatalogLocation[] }
>();

/** Цель входа `./catalog` в `exports` пакета; входа нет — `null`. */
function catalogExportOf(root: string): string | null {
  try {
    const manifest = readJson(join(root, 'package.json')) as { exports?: Record<string, unknown> };
    const target = manifest.exports?.[CATALOG_EXPORT];
    const relative =
      typeof target === 'string'
        ? target
        : (((target as Record<string, unknown> | undefined)?.import ??
            (target as Record<string, unknown> | undefined)?.default) as string | undefined);
    return typeof relative === 'string' ? join(root, relative) : null;
  } catch {
    return null;
  }
}

/** Путь файла каталога в пакете кита: по `exports["./catalog"]`, иначе имя по умолчанию. */
export function catalogPathIn(root: string): string {
  return catalogExportOf(root) ?? join(root, CATALOG_FILE);
}

/** `kit.framework` каталога; поля нет или файл не читается — `react`. */
function frameworkOf(path: string): KitFramework {
  try {
    const framework = (readCatalog(path) as { kit?: { framework?: unknown } }).kit?.framework;
    return FRAMEWORKS.includes(framework as KitFramework) ? (framework as KitFramework) : 'react';
  } catch {
    return 'react';
  }
}

/**
 * Киты среди зависимостей приложения: пакеты со входом `./catalog`, по имени пакета.
 *
 * @param projectDir - Каталог, от которого искать приложение (по умолчанию — рабочий).
 */
export function projectKits(projectDir?: string): KitCatalogLocation[] {
  return kitsOf(detectProjectStack(projectDir));
}

function kitsOf(stack: ReturnType<typeof detectProjectStack>): KitCatalogLocation[] {
  if (!stack.projectRoot) return [];
  const stamp = installStamp(stack.projectRoot);
  const cached = kitsByProject.get(stack.projectRoot);
  if (cached && cached.stamp === stamp) return cached.kits;
  const kits: KitCatalogLocation[] = [];
  for (const name of Object.keys(stack.allDependencies).sort()) {
    const location = locatePackage(name, [stack.projectRoot]);
    if (!location) continue;
    const path = catalogExportOf(location.root);
    if (!path || !existsSync(path)) continue;
    kits.push({ package: name, path, framework: frameworkOf(path) });
  }
  kitsByProject.set(stack.projectRoot, { stamp, kits });
  return kits;
}

/**
 * Кит приложения из найденных: того же фреймворка, что приложение, `@reformer/ui-kit` первым.
 * Нескольких китов одного фреймворка — первый по имени пакета, о выборе пишет статус.
 */
export function chooseKit(
  kits: readonly KitCatalogLocation[],
  framework: KitFramework
): KitCatalogLocation | null {
  const matching = kits.filter((kit) => kit.framework === framework);
  if (matching.length === 0) return null;
  const chosen = matching.find((kit) => kit.package === UI_KIT) ?? matching[0];
  if (matching.length > 1) {
    reportKnowledgeProblem(
      'kit-catalog',
      `у приложения несколько китов на ${framework}: ${matching.map((kit) => kit.package).join(', ')}; взят ${chosen.package}`
    );
  }
  return chosen;
}

/** Кит приложения: найденный в зависимостях либо `null`. */
export function projectKit(projectDir?: string): KitCatalogLocation | null {
  const stack = detectProjectStack(projectDir);
  return chooseKit(kitsOf(stack), stack.framework);
}

/**
 * Файлы каталога по приоритету: кит приложения, затем `@reformer/ui-kit` по базам поиска пакетов
 * (проект, `REFORMER_TYPECHECK_ROOT`, рядом с сервером).
 */
export function kitCatalogPaths(
  projectDir?: string,
  bases: readonly string[] = defaultPackageBases()
): string[] {
  const own = projectKit(projectDir);
  const fallback = locatePackages(UI_KIT, bases).map((location) => catalogPathIn(location.root));
  return [...new Set([...(own ? [own.path] : []), ...fallback])];
}

/** Каталог из первого места, где он читается; нигде — `undefined`. */
export function loadKitCatalog(paths: readonly string[] = kitCatalogPaths()): unknown {
  for (const path of paths) {
    if (!existsSync(path)) continue;
    try {
      return readCatalog(path);
    } catch (error) {
      reportKnowledgeProblem('kit-catalog', `${path}: ${String(error)}`);
    }
  }
  return undefined;
}

/** Где лежит каталог, который прочитается, чей он и сколько в нём компонентов — для статуса. */
export function kitCatalogSummary(paths: readonly string[] = kitCatalogPaths()): {
  path: string | null;
  package: string | null;
  framework: KitFramework | null;
  components: number;
} {
  for (const path of paths) {
    if (!existsSync(path)) continue;
    try {
      const json = readCatalog(path) as {
        components?: unknown;
        kit?: { package?: unknown; framework?: unknown };
      };
      return {
        path,
        package: typeof json.kit?.package === 'string' ? json.kit.package : null,
        framework: frameworkOf(path),
        components: Array.isArray(json.components) ? json.components.length : 0,
      };
    } catch {
      // проблему запишет loadKitCatalog
    }
  }
  return { path: null, package: null, framework: null, components: 0 };
}

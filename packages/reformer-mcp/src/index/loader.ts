/**
 * Загрузка и слияние `llms-index.json` установленных пакетов `@reformer/*`.
 *
 * Почему индекс читается У ПАКЕТА, а не берётся из собственного `dist/`: сервер публикуется
 * отдельно от библиотек, которые описывает. Снапшот, запечённый в `@reformer/mcp`, разъехался
 * бы по версиям с тем, что реально установлено у потребителя — и это была бы регрессия:
 * прежний рантайм-парсер читал `node_modules/@reformer/core`, то есть ровно установленную
 * версию. Индекс рядом с `llms.txt` сохраняет это свойство и вдобавок снимает разбор
 * TypeScript-AST со старта сервера.
 *
 * Деградация обязательна и продумана: пакет старой версии индекса не имеет, поэтому загрузчик
 * помечает его в `withoutIndex`, а потребитель докладывает недостающее прежним путём
 * (`symbols-parser`). Никакая функциональность от отсутствия индекса не пропадает — меняется
 * только цена.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { KNOWN_PACKAGES, packageRoot, type ReformerPackage } from '../utils/docs-parser.js';
import {
  SUPPORTED_INDEX_SCHEMA,
  type MergedIndex,
  type PackageIndex,
  type IndexedSymbol,
} from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const INDEX_FILE = 'llms-index.json';

/** `@reformer/<name>` → каталог в `packages/` монорепо. */
function packageDirName(pkg: string): string {
  const tail = pkg.replace(/^@reformer\//, '');
  return tail === 'core' ? 'reformer' : `reformer-${tail}`;
}

/**
 * Возможные пути к индексу пакета — тот же порядок, что у `docs-parser.getDocsPaths`:
 * резолв через `package.json` (работает под npx/pnpm/hoisting), затем плоский node_modules,
 * затем монорепо и CWD.
 */
function indexPaths(pkg: string): string[] {
  const dir = packageDirName(pkg);
  const paths: string[] = [];
  const root = packageRoot(pkg);
  if (root) paths.push(resolve(root, INDEX_FILE));
  paths.push(
    resolve(process.cwd(), 'node_modules', pkg, INDEX_FILE),
    // Монорепо: этот файл лежит в `<pkg>/{src,dist}/index/`, поэтому до `packages/` — ровно
    // три уровня вверх (та же арифметика, что в docs-parser). Путь не декоративный: у
    // `@reformer/core` и `@reformer/cdk` в `exports` нет `./package.json`, поэтому
    // `packageRoot()` для них возвращает null, и резолв держится именно на этой ветке.
    resolve(__dirname, '../../../', dir, INDEX_FILE),
    resolve(process.cwd(), 'packages', dir, INDEX_FILE)
  );
  return paths;
}

/** Прочитать индекс одного пакета. `null` — нет файла, битый JSON или чужая версия схемы. */
export function loadPackageIndex(pkg: string): PackageIndex | null {
  for (const p of indexPaths(pkg)) {
    if (!existsSync(p)) continue;
    try {
      const parsed = JSON.parse(readFileSync(p, 'utf-8')) as PackageIndex;
      // Индекс более новой мажорной схемы читать нельзя: поля могли поменять смысл.
      // Тихо игнорируем и уходим в фолбэк, а не догадываемся.
      if (parsed?.schemaVersion !== SUPPORTED_INDEX_SCHEMA) return null;
      if (!Array.isArray(parsed.symbols) || !Array.isArray(parsed.topics)) return null;
      return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

let cached: MergedIndex | null = null;

/**
 * Слитый индекс всех установленных пакетов. Кэшируется на время жизни процесса: файлы на
 * диске не меняются, а слияние 1073 символов не бесплатно.
 *
 * Порядок символов следует `KNOWN_PACKAGES` (core → cdk → ui-kit → renderers), поэтому при
 * коллизии имён (`FormField` есть и в cdk, и в ui-kit) первым идёт тот же вариант, который
 * возвращал прежний `findSymbol` — поведение для потребителя не меняется.
 */
export function getMergedIndex(): MergedIndex {
  if (cached) return cached;

  const packages = new Map<string, string>();
  const withoutIndex: string[] = [];
  const symbols: IndexedSymbol[] = [];
  const topics: MergedIndex['topics'] = [];

  for (const pkg of KNOWN_PACKAGES) {
    const idx = loadPackageIndex(pkg);
    if (!idx) {
      withoutIndex.push(pkg);
      continue;
    }
    packages.set(pkg, idx.version);
    for (const s of idx.symbols) symbols.push({ ...s, package: idx.package });
    for (const t of idx.topics) topics.push({ ...t, package: idx.package });
  }

  const byName = new Map<string, IndexedSymbol[]>();
  for (const s of symbols) {
    const list = byName.get(s.name);
    if (list) list.push(s);
    else byName.set(s.name, [s]);
  }

  cached = { packages, withoutIndex, symbols, topics, byName };
  return cached;
}

/**
 * Символы одного пакета из индекса. Пустой массив означает «индекса нет» — вызывающий обязан
 * решить, падать ли на прежний разбор AST.
 */
export function indexedSymbolsOf(pkg: ReformerPackage): IndexedSymbol[] {
  return getMergedIndex().symbols.filter((s) => s.package === pkg);
}

/** Все варианты символа по имени (по одному на пакет), в порядке `KNOWN_PACKAGES`. */
export function indexedSymbol(name: string, pkg = '*'): IndexedSymbol[] {
  const all = getMergedIndex().byName.get(name) ?? [];
  return pkg === '*' ? all : all.filter((s) => s.package === pkg);
}

/** Только для тестов — сбросить кэш слияния. */
export function __resetIndexCache(): void {
  cached = null;
}

/**
 * Слияние `llms-index.json` установленных пакетов в один индекс.
 *
 * Порт {@link IndexSource} отдаёт УЖЕ разобранное значение, а не текст: в браузере артефакт
 * приходит из `import()` объектом, и заставлять его сериализоваться обратно ради `JSON.parse`
 * здесь было бы работой ради симметрии. Проверка формы и версии схемы остаётся тут — это
 * знание ядра о собственном контракте, а не платформы о своём носителе.
 *
 * Почему индекс читается У ПАКЕТА, а не берётся из собственного `dist`: сервер публикуется
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
 *
 * @module reformer-mcp/core/index/merge
 */

import { KNOWN_PACKAGES, type ReformerPackage } from '../docs/packages.js';
import {
  SUPPORTED_INDEX_SCHEMA,
  type IndexedSymbol,
  type MergedIndex,
  type PackageIndex,
} from './types.js';

/** Откуда берутся индексы пакетов. Значение — разобранный JSON либо `null`. */
export interface IndexSource {
  read(pkg: string): unknown;
}

/**
 * Проверить, что значение — индекс поддерживаемой схемы.
 *
 * Индекс более новой мажорной схемы читать нельзя: поля могли поменять смысл. Тихо игнорируем
 * и уходим в фолбэк, а не догадываемся.
 */
export function asPackageIndex(value: unknown): PackageIndex | null {
  const parsed = value as PackageIndex | null;
  if (!parsed || typeof parsed !== 'object') return null;
  if (parsed.schemaVersion !== SUPPORTED_INDEX_SCHEMA) return null;
  if (!Array.isArray(parsed.symbols) || !Array.isArray(parsed.topics)) return null;
  return parsed;
}

/**
 * Слить индексы всех известных пакетов.
 *
 * Порядок символов следует {@link KNOWN_PACKAGES} (core → cdk → ui-kit → renderers), поэтому при
 * коллизии имён (`FormField` есть и в cdk, и в ui-kit) первым идёт тот же вариант, который
 * возвращал прежний `findSymbol` — поведение для потребителя не меняется.
 */
export function mergeIndex(source: IndexSource): MergedIndex {
  const packages = new Map<string, string>();
  const withoutIndex: string[] = [];
  const symbols: IndexedSymbol[] = [];
  const topics: MergedIndex['topics'] = [];

  for (const pkg of KNOWN_PACKAGES) {
    let idx: PackageIndex | null = null;
    try {
      idx = asPackageIndex(source.read(pkg));
    } catch {
      idx = null;
    }
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

  return { packages, withoutIndex, symbols, topics, byName };
}

/**
 * Символы одного пакета. Пустой массив означает «индекса нет» — вызывающий обязан решить,
 * падать ли на прежний разбор AST.
 */
export function symbolsOfPackage(index: MergedIndex, pkg: ReformerPackage): IndexedSymbol[] {
  return index.symbols.filter((s) => s.package === pkg);
}

/** Все варианты символа по имени (по одному на пакет), в порядке {@link KNOWN_PACKAGES}. */
export function symbolsByName(index: MergedIndex, name: string, pkg = '*'): IndexedSymbol[] {
  const all = index.byName.get(name) ?? [];
  return pkg === '*' ? all : all.filter((s) => s.package === pkg);
}

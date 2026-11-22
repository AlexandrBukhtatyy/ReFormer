/**
 * Структурное сравнение каталогов — для `reformer-plugin catalog --check`.
 *
 * Сравнивается разобранный JSON, а не текст: форматирование (prettier, отступы, перенос
 * массивов) на результат не влияет, порядок ключей объекта — тоже. Порядок элементов массива
 * значим (порядок enum — порядок опций в инспекторе). Записи `components` сопоставляются по
 * имени: дифф говорит «у Input пропал проп placeholder», а не «изменился элемент 17».
 *
 * @module @reformer/builder-plugin-cli/catalog/drift
 */

import { compareCodePoints } from './policy.js';

/** Одно расхождение: путь и что с ним. `before` — в файле, `after` — по типам. */
export interface CatalogDiffEntry {
  readonly path: string;
  readonly kind: 'added' | 'removed' | 'changed';
  readonly before?: unknown;
  readonly after?: unknown;
}

type JsonObject = { readonly [key: string]: unknown };

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Глубокое равенство JSON-значений; порядок ключей объекта не значим. */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => jsonEqual(item, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every((key) => Object.hasOwn(b, key) && jsonEqual(a[key], b[key]));
  }
  return false;
}

/** Сегмент пути: `.key` или `["ключ с точкой"]`. */
function segment(key: string): string {
  return /^[\w$-]+$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
}

/** Массив записей с уникальными строковыми `name` — сопоставляется по имени. */
function namedItems(value: readonly unknown[]): Map<string, unknown> | undefined {
  const out = new Map<string, unknown>();
  for (const item of value) {
    if (!isObject(item) || typeof item.name !== 'string' || out.has(item.name)) return undefined;
    out.set(item.name, item);
  }
  return out;
}

function walk(path: string, before: unknown, after: unknown, out: CatalogDiffEntry[]): void {
  if (jsonEqual(before, after)) return;
  if (isObject(before) && isObject(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort(
      compareCodePoints
    );
    for (const key of keys) {
      const next = `${path}${segment(key)}`;
      if (!Object.hasOwn(after, key))
        out.push({ path: next, kind: 'removed', before: before[key] });
      else if (!Object.hasOwn(before, key))
        out.push({ path: next, kind: 'added', after: after[key] });
      else walk(next, before[key], after[key], out);
    }
    return;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const left = namedItems(before);
    const right = namedItems(after);
    if (left !== undefined && right !== undefined && left.size > 0 && right.size > 0) {
      const names = [...new Set([...left.keys(), ...right.keys()])].sort(compareCodePoints);
      for (const name of names) {
        const next = `${path}[${name}]`;
        if (!right.has(name)) out.push({ path: next, kind: 'removed', before: left.get(name) });
        else if (!left.has(name)) out.push({ path: next, kind: 'added', after: right.get(name) });
        else walk(next, left.get(name), right.get(name), out);
      }
      return;
    }
  }
  out.push({ path, kind: 'changed', before, after });
}

/**
 * Расхождения каталога в файле (`before`) с каталогом по типам (`after`). Пусто — совпадают.
 */
export function diffCatalogs(before: unknown, after: unknown): CatalogDiffEntry[] {
  const out: CatalogDiffEntry[] = [];
  walk('', before, after, out);
  return out.map((entry) => ({ ...entry, path: entry.path.replace(/^\./, '') || '(корень)' }));
}

/** Короткое представление значения для строки диффа. */
function preview(value: unknown): string {
  const text = JSON.stringify(value) ?? 'undefined';
  return text.length > 80 ? `${text.slice(0, 79)}…` : text;
}

/** Строки диффа для терминала: `+` есть по типам, нет в файле; `-` наоборот; `~` изменилось. */
export function formatCatalogDiff(entries: readonly CatalogDiffEntry[], limit = 40): string[] {
  const lines = entries.slice(0, limit).map((entry) => {
    if (entry.kind === 'added') return `+ ${entry.path} = ${preview(entry.after)}`;
    if (entry.kind === 'removed') return `- ${entry.path} (было ${preview(entry.before)})`;
    return `~ ${entry.path}: ${preview(entry.before)} → ${preview(entry.after)}`;
  });
  if (entries.length > limit) lines.push(`… и ещё ${String(entries.length - limit)}`);
  return lines;
}

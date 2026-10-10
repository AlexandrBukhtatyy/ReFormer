/**
 * Детерминированное описание скомпилированной схемы — для снапшотов и сравнения компиляций.
 *
 * {@link CompiledSchema} держит живые объекты: ручки модели, компоненты, авторские узлы, схемы
 * строк с ключом из глобального счётчика (`rowKeyOf`). Напрямую в снапшот он не годится: ссылки
 * не сериализуются, а ключ строки зависит от того, сколько строк создали тесты до этого.
 * `describeCompiled` превращает компиляцию в простые данные:
 *
 * - узел — вид, `id`, позиционный `path` (только если он отличается от `id`, то есть у узла есть
 *   `selector`), `selector`, `scope`, `component` и `props`; поле — ещё ручка и `disabled`, массив —
 *   ручка, `initialValue` и описания строк, подформа — описание содержимого, контейнер — дети;
 * - `component` — строка как есть (HTML-тег), иначе `displayName` либо имя функции;
 * - значения (`props`, `initialValue`, части текста): функция → `'[function]'` (самих функций в
 *   описании нет), ручка модели → `'$.<путь>'`, под-модель или фасад массива →
 *   `'[model $.<путь>]'`, прочий сигнал → `'[signal]'`, React-элемент → `'[element]'`,
 *   повтор объекта на пути от корня → `'[circular]'`;
 * - ключи строк в идентификаторах областей (`#/phones[17]`) заменены на `row#0`, `row#1`, … в
 *   порядке выдачи ключа (по возрастанию). В свежей сборке это порядок появления строк при обходе;
 *   после `move`/`swap` видно, что ключ остался за строкой, а не за индексом.
 *
 * Описание строк вызывает `row()` у каждого массива для текущих строк модели — то есть компилирует
 * их, как это сделал бы рендерер. Отключается опцией `rows: false`.
 *
 * @example
 * ```typescript
 * expect(describeCompiled(compileSchema(tree, model))).toMatchSnapshot();
 * ```
 *
 * @module test-utils/compiled-snapshot
 */

import type { CompiledChild, CompiledNode, CompiledSchema } from '../../src/form/schema/compiled';
import { isModelFacade } from '../../src/model/model-value-proxy';
import { isSignal } from '../../src/signals';

/** Описание значения: примитив, строка-метка, массив или объект описаний. */
type DescribedValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly DescribedValue[]
  | { readonly [key: string]: DescribedValue };

/** Описание узла: общие ключи плюс ключи своего вида. */
export interface DescribedNode {
  readonly kind: CompiledChild['kind'];
  readonly id: string;
  readonly [key: string]: unknown;
}

/** Описание области: её идентификатор, модель, корень и индексы. */
export interface DescribedSchema {
  readonly scope: string;
  readonly model?: DescribedValue;
  readonly root: DescribedNode;
  /** Идентификаторы узлов области в порядке индекса `nodes`. */
  readonly nodes: readonly string[];
  /** Ручки полей индекса `fields` (`'$.home.city'`). */
  readonly fields: readonly string[];
  /** Ручки массивов индекса `arrays`. */
  readonly arrays: readonly string[];
}

/** Опции {@link describeCompiled}. */
export interface DescribeCompiledOptions {
  /** Описывать строки массивов (компилирует их через `row()`); по умолчанию `true`. */
  readonly rows?: boolean;
}

/** Путь ручки модели: `'$'` — корень, иначе `'$.<путь>'`. */
function handlePath(handle: unknown): string {
  const path = (handle as { __path?: unknown } | null)?.__path;
  return typeof path === 'string' && path !== '' ? `$.${path}` : '$';
}

/** Имя компонента узла: HTML-тег как есть, иначе `displayName` или имя функции. */
function componentName(component: unknown): string | undefined {
  if (component === undefined || component === null) return undefined;
  if (typeof component === 'string') return component;
  const named = component as { displayName?: unknown; name?: unknown };
  if (typeof named.displayName === 'string' && named.displayName !== '') return named.displayName;
  if (typeof named.name === 'string' && named.name !== '') return named.name;
  return '[component]';
}

/** Значение пропса, `initialValue` или части текста — без функций и живых ссылок. */
function describeValue(value: unknown, ancestors: Set<object> = new Set()): DescribedValue {
  if (typeof value === 'function') return '[function]';
  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'bigint') return `${value}n`;
  if (value === null || typeof value !== 'object') return value as DescribedValue;
  if (isModelFacade(value)) return `[model ${handlePath(value)}]`;
  if (isSignal(value)) {
    return typeof (value as { __path?: unknown }).__path === 'string'
      ? handlePath(value)
      : '[signal]';
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
  }
  if ('$$typeof' in value) return '[element]';
  if (ancestors.has(value)) return '[circular]';
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => describeValue(item, ancestors));
    const out: Record<string, DescribedValue> = {};
    for (const [key, item] of Object.entries(value)) out[key] = describeValue(item, ancestors);
    return out;
  } finally {
    ancestors.delete(value);
  }
}

/** Под-модели текущих строк массива — по индексу. */
function rowModelsOf(node: Extract<CompiledNode, { kind: 'array' }>): object[] {
  const rows: object[] = [];
  for (let index = 0; index < node.control.length; index++) {
    const row = node.control.at(index);
    if (row !== null && typeof row === 'object') rows.push(row);
  }
  return rows;
}

/** Обход компиляции: каждая область — один раз, строки — через `row()`. */
function forEachScope(
  schema: CompiledSchema,
  withRows: boolean,
  visit: (scope: CompiledSchema) => void
): void {
  visit(schema);
  const walk = (child: CompiledChild): void => {
    switch (child.kind) {
      case 'container':
        child.children.forEach(walk);
        return;
      case 'part':
        forEachScope(child.content, withRows, visit);
        return;
      case 'array':
        if (withRows) {
          for (const row of rowModelsOf(child)) forEachScope(child.row(row), withRows, visit);
        }
        return;
      default:
        return;
    }
  };
  walk(schema.root);
}

const ROW_KEY = /\[(\d+)\]/g;

/**
 * Описание скомпилированной схемы для снапшота: см. шапку модуля.
 *
 * @param compiled - Скомпилированная схема области.
 * @param options - {@link DescribeCompiledOptions}.
 * @returns Простые данные без ссылок на живые объекты; ключи строк нормализованы.
 */
export function describeCompiled(
  compiled: CompiledSchema,
  options: DescribeCompiledOptions = {}
): DescribedSchema {
  const withRows = options.rows !== false;

  // Первый проход: ключи строк во всех областях — для нормализации в порядке выдачи.
  const keys = new Set<number>();
  forEachScope(compiled, withRows, (scope) => {
    for (const match of scope.scope.matchAll(ROW_KEY)) keys.add(Number(match[1]));
  });
  const order = [...keys].sort((left, right) => left - right);
  const normalized = new Map(order.map((key, index) => [key, `row#${index}`]));
  const scopeId = (scope: string): string =>
    scope.replace(ROW_KEY, (_match, key: string) => `[${normalized.get(Number(key))}]`);

  const describeNode = (node: CompiledChild): DescribedNode => {
    if (node.kind === 'text') {
      return { kind: 'text', id: node.id, parts: node.parts.map((part) => describeValue(part)) };
    }
    const base: { -readonly [K in keyof DescribedNode]: DescribedNode[K] } = {
      kind: node.kind,
      id: node.id,
    };
    if (node.path !== node.id) base.path = node.path;
    if (node.selector !== undefined) base.selector = node.selector;
    base.scope = scopeId(node.scope);
    const component = componentName(node.component);
    if (component !== undefined) base.component = component;
    if (Object.keys(node.props).length > 0) base.props = describeValue(node.props);

    switch (node.kind) {
      case 'field':
        return { ...base, handle: handlePath(node.handle), disabled: node.disabled };
      case 'array':
        return {
          ...base,
          handle: handlePath(node.handle),
          ...(node.initialValue !== undefined
            ? { initialValue: describeValue(node.initialValue) }
            : {}),
          ...(withRows
            ? { rows: rowModelsOf(node).map((row) => describeSchema(node.row(row))) }
            : {}),
        };
      case 'part':
        return { ...base, handle: handlePath(node.handle), content: describeSchema(node.content) };
      case 'container':
        return { ...base, children: node.children.map(describeNode) };
    }
  };

  const describeSchema = (schema: CompiledSchema): DescribedSchema => ({
    scope: scopeId(schema.scope),
    ...(schema.model !== undefined ? { model: describeValue(schema.model) } : {}),
    root: describeNode(schema.root),
    nodes: [...schema.nodes.keys()],
    fields: [...schema.fields.keys()].map(handlePath),
    arrays: [...schema.arrays.keys()].map(handlePath),
  });

  return describeSchema(compiled);
}

/**
 * Сбор из схемы всего, что нужно эмиттерам: дерево TS-типов формы, список `$component`-имён,
 * классы `$dataSource` и верхнеуровневые поля с `required`.
 *
 * Обход зеркалит {@link './mock'.collectFieldDefaults}: тот же спуск, тот же отказ спускаться
 * в `item.$template` за верхнеуровневыми путями. Это не совпадение, а требование —
 * `model.ts` печатается из первого, `types.ts` из второго, и разойтись им нельзя.
 *
 * @module reformer-builder/lib/codegen/collect
 */

import {
  isArrayNode,
  isContainerNode,
  isFieldNode,
  parseOperator,
  type JsonFieldNode,
  type JsonFormSchema,
  type JsonNode,
} from '@reformer/renderer-json';
import { isNodeLike } from '../form-model/node-kind';
import { collectOperatorNames } from '../form-model/query';
import {
  classifyDataSources,
  fieldKindOf,
  LIST_PROP_KEYS,
  type DataSourceClasses,
} from '../form-mock';
import type { FormMock } from './types';

/** Узел дерева типов: лист (готовый TS-тип), объект (вложенность), массив (тип элемента). */
export type TsNode =
  | { readonly t: 'leaf'; readonly ts: string }
  | { readonly t: 'obj'; readonly fields: Record<string, TsNode> }
  | { readonly t: 'arr'; readonly elem: TsNode };

/** Объектный узел дерева типов — тип корня и любой вложенности. */
export interface TsObject {
  readonly t: 'obj';
  readonly fields: Record<string, TsNode>;
}

export interface Collected {
  /** Корень дерева типов. */
  readonly root: TsObject;
  /** Уникальные имена из `$component(Name)` (без `$html`). */
  readonly components: readonly string[];
  /** Классы `$dataSource`. */
  readonly ds: DataSourceClasses;
  /** Верхнеуровневые `$model`-пути полей с `componentProps.required === true`. */
  readonly requiredPaths: readonly string[];
  /** `$model`-пути узлов-массивов. */
  readonly arrayPaths: readonly string[];
}

/** Значения опций поля — из мока по `$dataSource` либо инлайн — для string-union типа. */
function optionValues(node: JsonFieldNode, mock: FormMock): string[] | null {
  const props = node.componentProps ?? {};
  for (const key of LIST_PROP_KEYS) {
    const parsed = parseOperator(props[key]);
    if (parsed?.op === 'dataSource') {
      const options = mock.dataSources[parsed.arg];
      if (Array.isArray(options) && options.length > 0) {
        return options.map((o) => String((o as { value?: unknown }).value ?? ''));
      }
    }
  }
  if (Array.isArray(props.options) && props.options.length > 0) {
    return props.options.map((o) => String((o as { value?: unknown }).value ?? ''));
  }
  return null;
}

/** Union строковых литералов из значений опций; `null`, если опции неизвестны. */
function optionUnion(node: JsonFieldNode, mock: FormMock): string | null {
  const values = optionValues(node, mock);
  if (values === null || values.length === 0) return null;
  const unique = [...new Set(values)].map(
    (v) => `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  );
  return unique.join(' | ');
}

/** TS-тип листа: список с известными опциями — union, иначе по виду значения. */
function leafType(node: JsonFieldNode, mock: FormMock): string {
  const kind = fieldKindOf(node);
  if (kind === 'select') return optionUnion(node, mock) ?? 'string';
  if (kind === 'multi') {
    const union = optionUnion(node, mock);
    // Тип nullable: пустой выбор приходит как `null` — массив в начальном значении модели
    // создал бы форму-массив вместо листа (см. дефолты в `./mock`).
    return union === null ? 'string[] | null' : `Array<${union}> | null`;
  }
  if (kind === 'file') return 'unknown[] | null';
  if (kind === 'boolean') return 'boolean';
  if (kind === 'number') return 'number';
  return 'string';
}

function insert(target: TsObject, segments: readonly string[], node: TsNode): void {
  let cursor = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    const next = cursor.fields[key];
    if (next === undefined || next.t !== 'obj') cursor.fields[key] = { t: 'obj', fields: {} };
    cursor = cursor.fields[key] as TsObject;
  }
  cursor.fields[segments[segments.length - 1]] = node;
}

/** Построить дерево типов узла — формы целиком или элемента массива. */
function buildTree(
  node: JsonNode,
  mock: FormMock,
  topLevel: boolean,
  requiredOut: string[],
  arraysOut: string[]
): TsObject {
  const root: TsObject = { t: 'obj', fields: {} };
  const visit = (n: JsonNode): void => {
    if (isArrayNode(n)) {
      const parsed = parseOperator(n.array);
      if (parsed?.op === 'model') {
        const template = n.item?.$template;
        const elem: TsNode = isNodeLike(template)
          ? buildTree(template, mock, false, requiredOut, arraysOut)
          : { t: 'obj', fields: {} };
        insert(root, parsed.arg.split('.'), { t: 'arr', elem });
        if (topLevel) arraysOut.push(parsed.arg);
      }
      return;
    }
    if (isFieldNode(n)) {
      const parsed = parseOperator(n.value);
      if (parsed?.op === 'model') {
        insert(root, parsed.arg.split('.'), { t: 'leaf', ts: leafType(n, mock) });
        if (topLevel && n.componentProps?.required === true) requiredOut.push(parsed.arg);
      }
      return;
    }
    if (isContainerNode(n)) {
      n.children?.forEach((child) => {
        if (isNodeLike(child)) visit(child);
      });
      const steps = n.componentProps?.steps;
      if (Array.isArray(steps)) {
        steps.forEach((step) => {
          if (isNodeLike(step)) visit(step);
        });
      }
    }
  };
  visit(node);
  return root;
}

/** Собрать всё для эмиттеров из (уже трансформированной) схемы и мока. */
export function collect(schema: JsonFormSchema, mock: FormMock): Collected {
  const requiredPaths: string[] = [];
  const arrayPaths: string[] = [];
  const root = isNodeLike(schema.root)
    ? buildTree(schema.root, mock, true, requiredPaths, arrayPaths)
    : ({ t: 'obj', fields: {} } as TsObject);
  return {
    root,
    components: collectOperatorNames(schema).components,
    ds: classifyDataSources(schema),
    requiredPaths,
    arrayPaths,
  };
}

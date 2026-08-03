/**
 * Сбор из схемы всего, что нужно эмиттерам: type-дерево формы (для `types.ts`), список
 * `$component`-имён, классы `$dataSource` и top-level поля с `required`. Обход зеркалит `synthObject`
 * (`preview-runtime/mock-synth`): спуск в `item.$template` для типа элемента массива.
 *
 * @module reformer-builder/codegen/collect
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
import { collectOperatorNames, isNodeLike } from '../model';
import {
  classifyDataSources,
  inferFieldKind,
  type DataSourceClasses,
  type MockData,
} from '../preview-runtime/mock-synth';

/** Узел type-дерева: лист (TS-тип), объект (вложенность), массив (тип элемента). */
export type TsNode =
  | { t: 'leaf'; ts: string }
  | { t: 'obj'; fields: Record<string, TsNode> }
  | { t: 'arr'; elem: TsNode };

export interface Collected {
  /** Корень type-дерева формы. */
  root: { t: 'obj'; fields: Record<string, TsNode> };
  /** Уникальные `$component(Name)` (без `$html`). */
  components: string[];
  /** Классы `$dataSource`. */
  ds: DataSourceClasses;
  /** Top-level `$model`-пути полей с `componentProps.required === true`. */
  requiredPaths: string[];
  /** `$model`-пути FormArray-узлов. */
  arrayPaths: string[];
}

const LIST_PROP_KEYS = ['options', 'items', 'data', 'dataSource', 'choices', 'list'] as const;

/** Значения опций select-поля (из мока по $dataSource, либо инлайн) — для string-union типа. */
function optionValues(node: JsonFieldNode, mock: MockData): string[] | null {
  const props = node.componentProps ?? {};
  for (const key of LIST_PROP_KEYS) {
    const p = parseOperator(props[key]);
    if (p?.op === 'dataSource') {
      const opts = mock.dataSources[p.arg];
      if (Array.isArray(opts) && opts.length)
        return opts.map((o) => String((o as { value?: unknown }).value ?? ''));
    }
  }
  if (Array.isArray(props.options) && props.options.length)
    return props.options.map((o) => String((o as { value?: unknown }).value ?? ''));
  return null;
}

/** TS-тип листа: select с известными опциями → string-union, иначе по {@link inferFieldKind}. */
function leafType(node: JsonFieldNode, mock: MockData): string {
  const kind = inferFieldKind(node);
  if (kind === 'select') {
    const vals = optionValues(node, mock);
    if (vals && vals.length) {
      const uniq = [...new Set(vals)].map(
        (v) => `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
      );
      return uniq.join(' | ');
    }
    return 'string';
  }
  if (kind === 'boolean') return 'boolean';
  if (kind === 'number') return 'number';
  return 'string';
}

function insert(
  target: { t: 'obj'; fields: Record<string, TsNode> },
  segs: string[],
  node: TsNode
): void {
  let cur = target;
  for (let i = 0; i < segs.length - 1; i++) {
    const k = segs[i];
    const next = cur.fields[k];
    if (!next || next.t !== 'obj') cur.fields[k] = { t: 'obj', fields: {} };
    cur = cur.fields[k] as { t: 'obj'; fields: Record<string, TsNode> };
  }
  cur.fields[segs[segs.length - 1]] = node;
}

/** Построить type-дерево узла (для формы и для элемента массива). */
function buildTree(
  node: JsonNode,
  mock: MockData,
  topLevel: boolean,
  requiredOut: string[],
  arraysOut: string[]
): { t: 'obj'; fields: Record<string, TsNode> } {
  const root: { t: 'obj'; fields: Record<string, TsNode> } = { t: 'obj', fields: {} };
  const rec = (n: JsonNode): void => {
    if (isArrayNode(n)) {
      const p = parseOperator(n.array);
      if (p?.op === 'model') {
        const template = n.item?.$template;
        const elem = isNodeLike(template)
          ? buildTree(template as JsonNode, mock, false, requiredOut, arraysOut)
          : { t: 'obj' as const, fields: {} };
        insert(root, p.arg.split('.'), { t: 'arr', elem });
        if (topLevel) arraysOut.push(p.arg);
      }
      return;
    }
    if (isFieldNode(n)) {
      const p = parseOperator(n.value);
      if (p?.op === 'model') {
        insert(root, p.arg.split('.'), { t: 'leaf', ts: leafType(n, mock) });
        if (topLevel && n.componentProps?.required === true) requiredOut.push(p.arg);
      }
      return;
    }
    if (isContainerNode(n)) {
      n.children?.forEach((c) => isNodeLike(c) && rec(c as JsonNode));
      const steps = n.componentProps?.steps;
      if (Array.isArray(steps)) steps.forEach((s) => isNodeLike(s) && rec(s as JsonNode));
    }
  };
  rec(node);
  return root;
}

/** Собрать всё для эмиттеров из (уже трансформированной) схемы + мока. */
export function collect(schema: JsonFormSchema, mock: MockData): Collected {
  const requiredPaths: string[] = [];
  const arrayPaths: string[] = [];
  const root = isNodeLike(schema.root)
    ? buildTree(schema.root as JsonNode, mock, true, requiredPaths, arrayPaths)
    : { t: 'obj' as const, fields: {} };
  return {
    root,
    components: collectOperatorNames(schema).components,
    ds: classifyDataSources(schema),
    requiredPaths,
    arrayPaths,
  };
}

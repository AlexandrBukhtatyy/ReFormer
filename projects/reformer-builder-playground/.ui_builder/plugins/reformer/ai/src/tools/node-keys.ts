/**
 * Особые ключи свойств: правят сам узел, а не его `componentProps`.
 *
 * Два ключа узла модели в структурном режиме иначе задать нечем:
 *
 * - `$disabled` → ключ `disabled` поля: поле создаётся выключенным и остаётся таким. Свойство
 *   компонента `disabled` состояния поля не меняет — оно только рисует, и модель путала одно с
 *   другим;
 * - `$newRow` → ключ `initialValue` массива: шаблон новой строки (объект). Начальные строки
 *   массива — данные модели, а не узла, и этим ключом не задаются.
 *
 * Знак `$` отделяет их от свойств компонента так же, как `$model(...)` отделяет привязку от
 * строки: свойство с таким именем у компонента кита не бывает.
 *
 * @module plugins/reformer/ai/tools/node-keys
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { kindOf, setNodeKey, type JsonPath } from '../../../core/form-model';

/** Особый ключ → ключ узла и вид узла, у которого он есть. */
const NODE_KEYS: Readonly<
  Record<string, { readonly key: string; readonly kind: 'field' | 'array' }>
> = {
  $disabled: { key: 'disabled', kind: 'field' },
  $newRow: { key: 'initialValue', kind: 'array' },
};

/** Особый ли это ключ узла. */
export function isNodeKey(name: string): boolean {
  return Object.hasOwn(NODE_KEYS, name);
}

/**
 * Почему значение особого ключа нельзя положить в узел, или `null`. `null` значение убирает ключ.
 */
export function nodeKeyRefusal(node: JsonNode, name: string, value: unknown): string | null {
  const spec = NODE_KEYS[name];
  if (spec === undefined) return `${name} is not a node key.`;
  if (kindOf(node) !== spec.kind) return `${name} applies to ${spec.kind} nodes only.`;
  if (value === null) return null;
  if (name === '$disabled' && typeof value !== 'boolean') return '$disabled takes true or false.';
  if (name === '$newRow' && (typeof value !== 'object' || Array.isArray(value))) {
    return '$newRow takes an object — the values of a new row.';
  }
  return null;
}

/** Положить значение особого ключа в узел по адресу; `null` убирает ключ. */
export function setNodeKeyValue(
  schema: JsonFormSchema,
  path: JsonPath,
  name: string,
  value: unknown
): JsonFormSchema {
  const spec = NODE_KEYS[name];
  if (spec === undefined) return schema;
  return setNodeKey(schema, path, spec.key, value === null ? undefined : value).schema;
}

/** Разделить свойства на свойства компонента и особые ключи узла. */
export function splitNodeKeys(props: Readonly<Record<string, unknown>>): {
  readonly component: Record<string, unknown>;
  readonly node: Record<string, unknown>;
} {
  const component: Record<string, unknown> = {};
  const node: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(props)) {
    if (isNodeKey(name)) node[name] = value;
    else component[name] = value;
  }
  return { component, node };
}

/** Ключ узла по особому ключу — для применения к узлу, которого ещё нет в схеме. */
export function nodeKeyOf(name: string): string | undefined {
  return NODE_KEYS[name]?.key;
}

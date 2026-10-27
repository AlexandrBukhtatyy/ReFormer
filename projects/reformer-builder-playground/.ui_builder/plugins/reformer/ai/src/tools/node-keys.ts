/**
 * Особые ключи свойств: правят сам узел, а не его `componentProps`.
 *
 * Два ключа узла модели в структурном режиме иначе задать нечем:
 *
 * - `_disabled` → ключ `disabled` поля: поле создаётся выключенным и остаётся таким. Свойство
 *   компонента `disabled` состояния поля не меняет — оно только рисует, и модель путала одно с
 *   другим;
 * - `_newRow` → ключ `initialValue` массива: шаблон новой строки (объект). Начальные строки
 *   массива — данные модели, а не узла, и этим ключом не задаются.
 *
 * Подчёркивание отделяет их от свойств компонента: свойство с таким именем у компонента кита не
 * бывает. Прежде это был знак `$`, как у `$model(...)`, но ключ объекта модель пишет в вызове
 * сама, и не всякий сервер его разбирает: gemma4 пишет ключи без кавычек, и Ollama выбрасывала
 * вызов с `$disabled` целиком — ход кончался пустым ответом (ReFormer-qsm8.11). Ключ из букв,
 * цифр и подчёркивания проходит у всех.
 *
 * @module plugins/reformer/ai/tools/node-keys
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { kindOf, setNodeKey, type JsonPath } from '../../../core/form-model';

/** Особый ключ → ключ узла и вид узла, у которого он есть. */
const NODE_KEYS: Readonly<
  Record<string, { readonly key: string; readonly kind: 'field' | 'array' }>
> = {
  _disabled: { key: 'disabled', kind: 'field' },
  _newRow: { key: 'initialValue', kind: 'array' },
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
  if (name === '_disabled' && typeof value !== 'boolean') return '_disabled takes true or false.';
  if (name === '_newRow' && (typeof value !== 'object' || Array.isArray(value))) {
    return '_newRow takes an object — the values of a new row.';
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

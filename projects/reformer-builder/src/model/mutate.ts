/**
 * Структурные операции над `JsonFormSchema` — иммутабельные, каждая чистая функция возвращает
 * `{ schema, newPath }`, где `newPath` — путь затронутого узла ПОСЛЕ правки (стор переносит
 * на него выделение, так выделение «следует» за узлом через insert/move/remove).
 *
 * Все правки идут через `updateAt`/`removeAt` (`paths.ts`): порядок ключей и неизвестные
 * ключи/операторы сохраняются нетронутыми (требование round-trip).
 *
 * @module reformer-builder/model/mutate
 */

import type { ComponentOp, HtmlOp, JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import {
  getAt,
  pathEquals,
  removeAt,
  updateAt,
  type JsonPath,
  type JsonPathSegment,
} from './paths';
import { parentNodePath } from './query';

/** Результат структурной операции: новая схема + путь затронутого узла. */
export interface MutationResult {
  schema: JsonFormSchema;
  newPath: JsonPath;
}

const clone = <T>(v: T): T => structuredClone(v);

/**
 * Установить/удалить один `componentProps`-ключ узла. `value === undefined` удаляет ключ.
 * Создаёт `componentProps`, если его не было.
 */
export function setComponentProp(
  schema: JsonFormSchema,
  nodePath: JsonPath,
  key: string,
  value: unknown
): MutationResult {
  const next = updateAt(schema, [...nodePath, 'componentProps'], (props: unknown) => {
    const p: Record<string, unknown> = { ...(props as object) };
    if (value === undefined) delete p[key];
    else p[key] = value;
    return p;
  });
  return { schema: next, newPath: nodePath };
}

/**
 * Установить/удалить верхнеуровневый ключ узла (`selector`/`value`/`component`/`array`/…).
 * `value === undefined` удаляет ключ.
 */
export function setNodeKey(
  schema: JsonFormSchema,
  nodePath: JsonPath,
  key: string,
  value: unknown
): MutationResult {
  const next = updateAt(schema, nodePath, (node: unknown) => {
    const c: Record<string, unknown> = { ...(node as object) };
    if (value === undefined) delete c[key];
    else c[key] = value;
    return c;
  });
  return { schema: next, newPath: nodePath };
}

/** Сменить компонент узла-контейнера/поля (`$component(...)`/`$html(...)`). */
export function setComponent(
  schema: JsonFormSchema,
  nodePath: JsonPath,
  component: ComponentOp | HtmlOp
): MutationResult {
  return setNodeKey(schema, nodePath, 'component', component);
}

/**
 * Вставить узел в массив-слот (`children`/`steps`) на позицию `index`. Слот создаётся,
 * если его не было. `index` за пределами длины трактуется как «в конец».
 *
 * @param slotPath - Путь к массиву-слоту (например `[...nodePath, 'children']`).
 */
export function insertNode(
  schema: JsonFormSchema,
  slotPath: JsonPath,
  index: number,
  node: JsonNode
): MutationResult {
  let insertedAt = index;
  const next = updateAt(schema, slotPath, (arr: unknown) => {
    const list = Array.isArray(arr) ? arr.slice() : [];
    const i = Math.max(0, Math.min(index, list.length));
    insertedAt = i;
    list.splice(i, 0, node);
    return list;
  });
  return { schema: next, newPath: [...slotPath, insertedAt] };
}

/** Добавить узел в конец массива-слота. */
export function appendNode(
  schema: JsonFormSchema,
  slotPath: JsonPath,
  node: JsonNode
): MutationResult {
  const arr = getAt(schema, slotPath);
  const len = Array.isArray(arr) ? arr.length : 0;
  return insertNode(schema, slotPath, len, node);
}

/**
 * Удалить узел по пути. Выделение переносится на родителя-узел (или на корень, если родителя
 * нет). Узел должен лежать в массиве-слоте (`children`/`steps`); для одиночных слотов
 * (`template`/`wrapper`) используйте специализированные операции.
 */
export function removeNode(schema: JsonFormSchema, nodePath: JsonPath): MutationResult {
  const next = removeAt(schema, nodePath);
  const parent = parentNodePath(nodePath) ?? ['root'];
  return { schema: next, newPath: parent };
}

/**
 * Переместить узел в целевой массив-слот на позицию `index`. Извлечение выполняется до вставки;
 * если слот назначения совпадает с исходным и узел вырезан ДО точки вставки — индекс
 * компенсируется. Возвращает путь узла на новом месте.
 */
export function moveNode(
  schema: JsonFormSchema,
  fromPath: JsonPath,
  slotPath: JsonPath,
  index: number
): MutationResult {
  const node = getAt(schema, fromPath) as JsonNode | undefined;
  if (!node) return { schema, newPath: fromPath };
  const moving = clone(node);

  const afterRemove = removeAt(schema, fromPath);

  const fromSlot = fromPath.slice(0, -1);
  const fromIdx = Number(fromPath[fromPath.length - 1] as JsonPathSegment);
  let insIdx = index;
  if (pathEquals(fromSlot, slotPath) && fromIdx < index) insIdx = index - 1;

  return insertNode(afterRemove, slotPath, insIdx, moving);
}

/**
 * Дублировать узел: глубокая копия вставляется сразу после оригинала в том же слоте.
 * Требует, чтобы родитель был массивом-слотом.
 */
export function duplicateNode(schema: JsonFormSchema, nodePath: JsonPath): MutationResult {
  const node = getAt(schema, nodePath) as JsonNode | undefined;
  const slotPath = nodePath.slice(0, -1);
  const idx = Number(nodePath[nodePath.length - 1] as JsonPathSegment);
  const arr = getAt(schema, slotPath);
  if (!node || !Array.isArray(arr)) return { schema, newPath: nodePath };
  return insertNode(schema, slotPath, idx + 1, clone(node));
}

/**
 * Обернуть узел в горизонтальную группу `$html(div)` (по идее прототипа — flex-строка).
 * Узел на его месте заменяется на группу-контейнер, содержащую копию узла первым ребёнком.
 *
 * @returns Путь узла внутри новой группы (`[...nodePath, 'children', 0]`).
 */
export function wrapInHtmlDiv(
  schema: JsonFormSchema,
  nodePath: JsonPath,
  opts?: { className?: string }
): MutationResult {
  const node = getAt(schema, nodePath) as JsonNode | undefined;
  if (!node) return { schema, newPath: nodePath };
  const group: JsonNode = {
    component: '$html(div)',
    componentProps: { className: opts?.className ?? 'flex gap-4' },
    children: [clone(node)],
  };
  const next = updateAt(schema, nodePath, () => group);
  return { schema: next, newPath: [...nodePath, 'children', 0] };
}

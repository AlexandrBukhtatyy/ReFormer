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

import { isContainerNode } from '@reformer/renderer-json';
import type {
  ComponentOp,
  HtmlOp,
  JsonContainerNode,
  JsonFormSchema,
  JsonNode,
} from '@reformer/renderer-json';
import {
  getAt,
  isPrefix,
  pathEquals,
  removeAt,
  updateAt,
  type JsonPath,
  type JsonPathSegment,
} from './paths';
import { parentNodePath } from './query';
import { isDivContainer, orientationOf } from './node-kind';

/** Результат структурной операции: новая схема + путь затронутого узла. */
export interface MutationResult {
  schema: JsonFormSchema;
  newPath: JsonPath;
}

const clone = <T>(v: T): T => structuredClone(v);

/** Дефолтные классы авто-ряда (горизонтальный flex, растёт до N колонок). */
const DEFAULT_ROW_CLASS = 'flex gap-4';
/** Дефолтные классы авто-столбца (вертикальный flex-стек). */
const DEFAULT_COL_CLASS = 'flex flex-col gap-4';

/**
 * Вырожденная авто-обёртка: `$html(div)` с flex/grid-раскладкой и единственным ребёнком (ряд ИЛИ
 * столбец). Такие обёртки создаёт drag-раскладка ({@link wrapInRow}/{@link wrapInColumn}); с одним
 * ребёнком они бессмысленны, поэтому сворачиваются.
 */
function isDegenerateWrapper(node: JsonNode | undefined): node is JsonContainerNode {
  if (!node || !isContainerNode(node)) return false;
  const c = node as JsonContainerNode;
  if (c.component !== '$html(div)') return false;
  const kids = c.children;
  if (!Array.isArray(kids) || kids.length !== 1) return false;
  const cls = c.componentProps?.className;
  if (typeof cls !== 'string') return false;
  const tokens = cls.split(/\s+/);
  return tokens.includes('flex') || tokens.includes('grid');
}

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

/**
 * Записать текстовое содержимое узла — текстовую часть в `children`. Пустая строка убирает её.
 *
 * Текст живёт среди детей на равных с узлами ({@link JsonChild}), поэтому правится ровно один
 * текстовый элемент: существующий переписывается на месте (порядок относительно вложенных узлов
 * сохраняется), а если его не было — добавляется первым. Инспектор зовёт это только когда
 * текстовый элемент ровно один или его нет ({@link textChildIndex}); при нескольких частях
 * содержимое правится в JSON.
 */
export function setTextChild(
  schema: JsonFormSchema,
  nodePath: JsonPath,
  text: string
): MutationResult {
  const next = updateAt(schema, nodePath, (node: unknown) => {
    const c: Record<string, unknown> = { ...(node as object) };
    const kids = Array.isArray(c.children) ? [...(c.children as unknown[])] : [];
    const at = kids.findIndex((k) => typeof k === 'string' || typeof k === 'number');
    if (text === '') {
      if (at >= 0) kids.splice(at, 1);
    } else if (at >= 0) {
      kids[at] = text;
    } else {
      kids.unshift(text);
    }
    if (kids.length === 0 && !Array.isArray(c.children)) delete c.children;
    else c.children = kids;
    return c;
  });
  return { schema: next, newPath: nodePath };
}

/** Индекс единственной текстовой части в `children` (`-1` — её нет, `null` — их несколько). */
export function textChildIndex(node: JsonNode): number | null {
  const kids = (node as { children?: unknown }).children;
  if (!Array.isArray(kids)) return -1;
  const found = kids.reduce<number[]>((acc, k, i) => {
    if (typeof k === 'string' || typeof k === 'number') acc.push(i);
    return acc;
  }, []);
  if (found.length > 1) return null;
  return found.length === 1 ? found[0] : -1;
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
 * Переключить вариант узла на sibling-компонент из той же группы вариантов: сменить `component` на
 * `$component(targetName)` и удалить из `componentProps` ключи, отсутствующие в целевой props-схеме
 * (`targetPropKeys`). Общие ключи (`className`/`placeholder`/`options` + wrapper `label`/`required`/
 * `description`/`testId`) выживают, т.к. есть в целевой схеме. Одна запись истории (стор оборачивает
 * весь результат в один `apply`). Прунинг сохраняет порядок оставшихся ключей.
 *
 * @param targetPropKeys - допустимые `componentProps`-ключи целевого варианта
 *   (`Object.keys(targetEntry.propsSchema.properties)`).
 */
export function switchVariant(
  schema: JsonFormSchema,
  nodePath: JsonPath,
  targetName: string,
  targetPropKeys: Set<string>
): MutationResult {
  const afterComponent = setComponent(schema, nodePath, `$component(${targetName})`);
  const props = getAt(afterComponent.schema, [...nodePath, 'componentProps']);
  if (props == null || typeof props !== 'object') return afterComponent;
  const next = updateAt(afterComponent.schema, [...nodePath, 'componentProps'], (p: unknown) => {
    const pruned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
      if (targetPropKeys.has(k)) pruned[k] = v;
    }
    return pruned;
  });
  return { schema: next, newPath: nodePath };
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
  const afterRemove = removeAt(schema, nodePath);
  const parent = parentNodePath(nodePath) ?? ['root'];
  // Авто-unwrap: если родитель стал вырожденным авто-рядом (осталась одна колонка) — свернуть его.
  const parentNode = getAt(afterRemove, parent) as JsonNode | undefined;
  if (isDegenerateWrapper(parentNode)) {
    const only = parentNode.children![0] as JsonNode;
    return { schema: updateAt(afterRemove, parent, () => clone(only)), newPath: parent };
  }
  return { schema: afterRemove, newPath: parent };
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

  let afterRemove = removeAt(schema, fromPath);

  // Авто-unwrap бывшего родителя-ряда, если он выродился до одной колонки. Замена «ряд → его
  // ребёнок» сохраняет длину массивов, поэтому `slotPath`/индексы вставки остаются валидными.
  // Пропускаем reorder внутри того же ряда и перемещение внутрь его поддерева (`isPrefix`).
  const srcParent = parentNodePath(fromPath);
  if (srcParent && !isPrefix(srcParent, slotPath)) {
    const pn = getAt(afterRemove, srcParent) as JsonNode | undefined;
    if (isDegenerateWrapper(pn)) {
      const only = pn.children![0] as JsonNode;
      afterRemove = updateAt(afterRemove, srcParent, () => clone(only));
    }
  }

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
 * Дублировать непрерывный блок `[start, start+count)` в массив-слоте (глубокие копии) — как
 * «Copy Line Down/Up» в VSCode. `dir`: `down` — копия сразу ПОСЛЕ блока (оригинал остаётся сверху),
 * `up` — ПЕРЕД блоком (оригинал уезжает вниз). Возвращает новую схему и стартовый индекс копии,
 * либо `null`, если блок выходит за границы слота.
 */
export function duplicateBlock(
  schema: JsonFormSchema,
  slotPath: JsonPath,
  start: number,
  count: number,
  dir: 'up' | 'down'
): { schema: JsonFormSchema; newStart: number } | null {
  const arr = getAt(schema, slotPath);
  if (!Array.isArray(arr) || count <= 0 || start < 0 || start + count > arr.length) return null;
  const newStart = dir === 'up' ? start : start + count;
  const next = updateAt(schema, slotPath, (a: unknown) => {
    const list = (a as unknown[]).slice();
    const copies = list.slice(start, start + count).map((n) => clone(n));
    list.splice(newStart, 0, ...copies);
    return list;
  });
  return { schema: next, newStart };
}

/**
 * Переставить непрерывный блок `[start, start+count)` в массив-слоте на `delta` (±1) — для
 * перемещения выделенной группы соседей вверх/вниз. `null`, если блок упирается в границу.
 * Возвращает новую схему и новый стартовый индекс блока.
 */
export function reorderBlock(
  schema: JsonFormSchema,
  slotPath: JsonPath,
  start: number,
  count: number,
  delta: number
): { schema: JsonFormSchema; newStart: number } | null {
  const arr = getAt(schema, slotPath);
  if (!Array.isArray(arr)) return null;
  const newStart = start + delta;
  if (newStart < 0 || newStart + count > arr.length) return null;
  const next = updateAt(schema, slotPath, (a: unknown) => {
    const list = (a as unknown[]).slice();
    const block = list.splice(start, count);
    list.splice(newStart, 0, ...block);
    return list;
  });
  return { schema: next, newStart };
}

/** Удалить непрерывный блок `[start, start+count)` из массив-слота. */
export function removeBlock(
  schema: JsonFormSchema,
  slotPath: JsonPath,
  start: number,
  count: number
): JsonFormSchema {
  return updateAt(schema, slotPath, (a: unknown) => {
    const list = Array.isArray(a) ? (a as unknown[]).slice() : [];
    list.splice(start, count);
    return list;
  });
}

/** Удалить набор индексов из массив-слота (для несмежного мульти-удаления). Порядок — не важен. */
export function removeIndices(
  schema: JsonFormSchema,
  slotPath: JsonPath,
  indices: number[]
): JsonFormSchema {
  const desc = [...new Set(indices)].sort((a, b) => b - a); // с конца — чтобы индексы не сдвигались
  let next = schema;
  for (const i of desc) next = removeBlock(next, slotPath, i, 1);
  return next;
}

/**
 * Сгруппировать непрерывный блок `[start, start+count)` соседей в новый `$html(div)`-контейнер
 * (по умолчанию вертикальный `flex flex-col gap-4`). Возвращает путь новой группы.
 */
export function groupBlock(
  schema: JsonFormSchema,
  slotPath: JsonPath,
  start: number,
  count: number,
  opts?: { className?: string }
): MutationResult {
  const arr = getAt(schema, slotPath);
  if (!Array.isArray(arr) || count < 1) return { schema, newPath: [...slotPath, start] };
  const block = (arr as JsonNode[]).slice(start, start + count).map(clone);
  const group: JsonNode = {
    component: '$html(div)',
    componentProps: { className: opts?.className ?? DEFAULT_COL_CLASS },
    children: block,
  };
  const next = updateAt(schema, slotPath, (a: unknown) => {
    const list = (a as unknown[]).slice();
    list.splice(start, count, group);
    return list;
  });
  return { schema: next, newPath: [...slotPath, start] };
}

/**
 * Разгруппировать `$html(div)`: заменить его в родительском массив-слоте на его детей. No-op для
 * не-div или узла не в массив-слоте. Возвращает путь на месте бывшей группы.
 */
export function ungroupNode(schema: JsonFormSchema, nodePath: JsonPath): MutationResult {
  const node = getAt(schema, nodePath) as JsonNode | undefined;
  if (!node || !isDivContainer(node)) return { schema, newPath: nodePath };
  const kids = (node as { children?: unknown }).children;
  const slotPath = nodePath.slice(0, -1);
  const last = nodePath[nodePath.length - 1];
  if (!Array.isArray(kids) || typeof last !== 'number') return { schema, newPath: nodePath };
  const next = updateAt(schema, slotPath, (a: unknown) => {
    const list = (a as unknown[]).slice();
    list.splice(last, 1, ...(kids as JsonNode[]).map(clone));
    return list;
  });
  return { schema: next, newPath: [...slotPath, last] };
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

/**
 * Создать горизонтальный ряд из целевого узла и НОВОГО узла (дроп из палитры): цель на её месте
 * заменяется на `$html(div)`-ряд, содержащий обе колонки. `side` — с какой стороны от цели встаёт
 * новый узел. Возвращает путь новой колонки (за ним следует выделение).
 */
export function wrapInRow(
  schema: JsonFormSchema,
  targetPath: JsonPath,
  node: JsonNode,
  side: 'before' | 'after',
  opts?: { className?: string }
): MutationResult {
  const target = getAt(schema, targetPath) as JsonNode | undefined;
  if (!target) return { schema, newPath: targetPath };
  const children = side === 'before' ? [clone(node), clone(target)] : [clone(target), clone(node)];
  const row: JsonNode = {
    component: '$html(div)',
    componentProps: { className: opts?.className ?? DEFAULT_ROW_CLASS },
    children,
  };
  const next = updateAt(schema, targetPath, () => row);
  return { schema: next, newPath: [...targetPath, 'children', side === 'before' ? 0 : 1] };
}

/**
 * Создать горизонтальный ряд из целевого узла и ПЕРЕМЕЩАЕМОГО существующего узла: источник
 * вырезается, цель заменяется на `$html(div)`-ряд с обеими колонками. No-op, если один узел —
 * предок другого (нельзя завернуть узел в самого себя/потомка). Индекс цели компенсируется, если
 * источник вырезан из того же слота ДО цели (зеркало компенсации в {@link moveNode}).
 */
export function wrapPairInRow(
  schema: JsonFormSchema,
  targetPath: JsonPath,
  fromPath: JsonPath,
  side: 'before' | 'after',
  opts?: { className?: string }
): MutationResult {
  if (isPrefix(fromPath, targetPath) || isPrefix(targetPath, fromPath)) {
    return { schema, newPath: targetPath };
  }
  const target = getAt(schema, targetPath) as JsonNode | undefined;
  const moving = getAt(schema, fromPath) as JsonNode | undefined;
  if (!target || !moving) return { schema, newPath: targetPath };
  const targetClone = clone(target);
  const movingClone = clone(moving);

  const afterRemove = removeAt(schema, fromPath);

  let adjustedTarget: JsonPath = targetPath;
  const fromSlot = fromPath.slice(0, -1);
  const targetSlot = targetPath.slice(0, -1);
  const fromLast = fromPath[fromPath.length - 1];
  const targetLast = targetPath[targetPath.length - 1];
  if (
    pathEquals(fromSlot, targetSlot) &&
    typeof fromLast === 'number' &&
    typeof targetLast === 'number' &&
    fromLast < targetLast
  ) {
    adjustedTarget = [...targetSlot, targetLast - 1];
  }

  const children = side === 'before' ? [movingClone, targetClone] : [targetClone, movingClone];
  const row: JsonNode = {
    component: '$html(div)',
    componentProps: { className: opts?.className ?? DEFAULT_ROW_CLASS },
    children,
  };
  const next = updateAt(afterRemove, adjustedTarget, () => row);
  return { schema: next, newPath: [...adjustedTarget, 'children', side === 'before' ? 0 : 1] };
}

/**
 * То же, что {@link wrapInRow}, но создаёт ВЕРТИКАЛЬНЫЙ столбец (`flex flex-col gap-4`) — элементы
 * встают друг под другом. Для вложенной раскладки: столбец внутри горизонтального ряда.
 */
export function wrapInColumn(
  schema: JsonFormSchema,
  targetPath: JsonPath,
  node: JsonNode,
  side: 'before' | 'after',
  opts?: { className?: string }
): MutationResult {
  return wrapInRow(schema, targetPath, node, side, {
    className: opts?.className ?? DEFAULT_COL_CLASS,
  });
}

/** Move-вариант {@link wrapInColumn} (зеркало {@link wrapPairInRow} с вертикальными классами). */
export function wrapPairInColumn(
  schema: JsonFormSchema,
  targetPath: JsonPath,
  fromPath: JsonPath,
  side: 'before' | 'after',
  opts?: { className?: string }
): MutationResult {
  return wrapPairInRow(schema, targetPath, fromPath, side, {
    className: opts?.className ?? DEFAULT_COL_CLASS,
  });
}

/**
 * Свернуть вырожденную авто-обёртку (`$html(div)` с flex/grid-раскладкой и единственным ребёнком —
 * ряд или столбец) в этого ребёнка. Иначе no-op. Инвариант «обёртка не остаётся с одной колонкой»
 * (см. {@link removeNode}/{@link moveNode}).
 */
export function unwrapSingleChild(schema: JsonFormSchema, containerPath: JsonPath): MutationResult {
  const node = getAt(schema, containerPath) as JsonNode | undefined;
  if (!isDegenerateWrapper(node)) return { schema, newPath: containerPath };
  const only = node.children![0] as JsonNode;
  return { schema: updateAt(schema, containerPath, () => clone(only)), newPath: containerPath };
}

/**
 * Классы контейнера для заданной оси: нормализует к flex-раскладке (переключать направление имеет
 * смысл только у flex-контейнера). Убирает конфликтующие `grid`/`grid-cols-*`/`grid-rows-*`,
 * гарантирует `flex`, ставит/снимает `flex-col`. Остальные классы и их порядок сохраняются.
 */
function withFlexOrientation(className: string | undefined, horizontal: boolean): string {
  const tokens = (className ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t !== 'grid' && t !== 'flex-col' && !/^grid-(cols|rows)-/.test(t));
  if (!tokens.includes('flex')) tokens.unshift('flex');
  if (!horizontal) tokens.splice(tokens.indexOf('flex') + 1, 0, 'flex-col');
  return tokens.join(' ');
}

/** Переключить `flex-col` в списке классов (горизонталь ⇄ вертикаль flex-обёртки). */
function toggleFlexColToken(className: string): string {
  const tokens = className.split(/\s+/).filter(Boolean);
  const i = tokens.indexOf('flex-col');
  if (i >= 0) {
    tokens.splice(i, 1);
  } else {
    const fi = tokens.indexOf('flex');
    tokens.splice(fi >= 0 ? fi + 1 : 0, 0, 'flex-col');
  }
  return tokens.join(' ');
}

/**
 * Перевернуть направление контейнера НА МЕСТЕ (ряд ⇄ столбец), НЕ создавая новый `div`: определяем
 * текущую ось через {@link orientationOf} и записываем противоположную. Контейнер нормализуется к flex
 * ({@link withFlexOrientation}), поэтому работает и для div без `flex`/без `className` — `componentProps`
 * при необходимости создаётся. No-op для не-контейнеров. Выделение остаётся на узле.
 */
export function flipDirection(schema: JsonFormSchema, nodePath: JsonPath): MutationResult {
  const node = getAt(schema, nodePath) as JsonNode | undefined;
  if (!node || !isContainerNode(node)) return { schema, newPath: nodePath };
  const cls = (node as JsonContainerNode).componentProps?.className;
  const nextClass = withFlexOrientation(
    typeof cls === 'string' ? cls : undefined,
    orientationOf(node) !== 'horizontal'
  );
  const next = updateAt(schema, nodePath, (n: unknown) => {
    const c = n as JsonContainerNode;
    return { ...c, componentProps: { ...(c.componentProps ?? {}), className: nextClass } };
  });
  return { schema: next, newPath: nodePath };
}

/**
 * Перевернуть flex-обёртку и переставить её ЕДИНСТВЕННЫЕ две колонки — случай «сделать 2 поля в `div`
 * вертикально/горизонтально» перетаскиванием: меняем `flex-col` в className и порядок пары, БЕЗ
 * создания нового `div`. `side` — с какой стороны от цели встаёт перемещаемый узел. Возвращает путь
 * перемещённого узла.
 */
export function flipWrapperPair(
  schema: JsonFormSchema,
  wrapperPath: JsonPath,
  targetPath: JsonPath,
  fromPath: JsonPath,
  side: 'before' | 'after'
): MutationResult {
  const wrapper = getAt(schema, wrapperPath) as JsonContainerNode | undefined;
  const target = getAt(schema, targetPath) as JsonNode | undefined;
  const moving = getAt(schema, fromPath) as JsonNode | undefined;
  if (!wrapper || !target || !moving) return { schema, newPath: targetPath };
  const cls = wrapper.componentProps?.className;
  const nextClass = typeof cls === 'string' ? toggleFlexColToken(cls) : cls;
  const children =
    side === 'before' ? [clone(moving), clone(target)] : [clone(target), clone(moving)];
  const next = updateAt(schema, wrapperPath, (n: unknown) => {
    const c = n as JsonContainerNode;
    return {
      ...c,
      componentProps: { ...(c.componentProps ?? {}), className: nextClass },
      children,
    };
  });
  return { schema: next, newPath: [...wrapperPath, 'children', side === 'before' ? 0 : 1] };
}

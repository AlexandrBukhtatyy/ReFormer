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

  const children =
    side === 'before' ? [movingClone, targetClone] : [targetClone, movingClone];
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
export function unwrapSingleChild(
  schema: JsonFormSchema,
  containerPath: JsonPath
): MutationResult {
  const node = getAt(schema, containerPath) as JsonNode | undefined;
  if (!isDegenerateWrapper(node)) return { schema, newPath: containerPath };
  const only = node.children![0] as JsonNode;
  return { schema: updateAt(schema, containerPath, () => clone(only)), newPath: containerPath };
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
 * Перевернуть направление flex-контейнера НА МЕСТЕ: переключить `flex-col` в его `className`
 * (ряд ⇄ столбец), НЕ создавая новый `div`. No-op для не-контейнеров и без строкового className.
 * Выделение остаётся на узле.
 */
export function flipDirection(schema: JsonFormSchema, nodePath: JsonPath): MutationResult {
  const node = getAt(schema, nodePath) as JsonNode | undefined;
  if (!node || !isContainerNode(node)) return { schema, newPath: nodePath };
  const cls = (node as JsonContainerNode).componentProps?.className;
  if (typeof cls !== 'string') return { schema, newPath: nodePath };
  const next = updateAt(schema, [...nodePath, 'componentProps'], (props: unknown) => ({
    ...(props as object),
    className: toggleFlexColToken(cls),
  }));
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
    return { ...c, componentProps: { ...(c.componentProps ?? {}), className: nextClass }, children };
  });
  return { schema: next, newPath: [...wrapperPath, 'children', side === 'before' ? 0 : 1] };
}

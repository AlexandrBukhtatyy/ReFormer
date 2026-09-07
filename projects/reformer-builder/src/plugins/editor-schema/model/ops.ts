/**
 * Словарь операций правки схемы формы и их применение.
 *
 * Словарь принадлежит провайдеру, а не ядру: платформа знает про {@link EditOp} только то,
 * что у него есть строковый `type`, необязательная цель и сериализуемые параметры. Что
 * означает `'insert'` для схемы формы, решается здесь — и ровно поэтому второй формат
 * приходит со своим плагином, а не правкой ядра.
 *
 * ## Три свойства, ради которых модуль устроен именно так
 *
 * - **Чистота.** {@link applyEditOp} ничего не мутирует и возвращает новую модель. На этом стоит
 *   отмена через снимки: снимок перестал бы быть снимком, если бы правка меняла его на месте.
 * - **Structural sharing.** Все правки идут через `updateAt`/`removeAt` домена, а те клонируют
 *   только узлы вдоль пути. Нетронутые ветки остаются ТЕМИ ЖЕ по ссылке — на этом держится
 *   и дешёвый снимок, и сравнение `!==` вместо глубокого обхода при перерисовке.
 * - **Точная обратимость.** У каждой операции есть `inverse`, применение которого возвращает
 *   модель в прежнее состояние — включая идентификаторы узлов. Поэтому удаление и перемещение
 *   собраны из `removeAt`/`insertNode`, а не из `removeNode`/`moveNode`: те дополнительно
 *   СВОРАЧИВАЮТ вырожденную обёртку (`$html(div)` с одной колонкой), и после такого сворачивания
 *   обратная вставка вернула бы узел в контейнер, которого больше нет.
 *
 * ## Сворачивание вырожденной обёртки — своя операция, а не довесок к перемещению
 *
 * Обёртка вырождается не сама по себе: её оставляет перетаскивание, вынувшее одну из двух
 * колонок. Соблазн зашить сворачивание внутрь `move` (так делает `moveNode` домена) стоил бы
 * обратимости — что и записано выше. Поэтому:
 *
 * - **`unwrap`** сворачивает обёртку и объявляет обратной `group` с прежним узлом обёртки
 *   в `template`. Оттуда возвращаются и `$nodeId` обёртки, и её классы — то есть отмена
 *   восстанавливает ровно ту обёртку, что была, а не похожую на неё;
 * - **`unwrap` — не `ungroup` под другим именем.** Он требует РОВНО одного ребёнка и отказывает
 *   иначе; в этом весь смысл: `ungroup` — команда человека, и она вправе распустить контейнер
 *   с пятью детьми, а сворачивание машинное, и распустить чужой контейнер оно не должно уметь
 *   вовсе. Разными их держит и журнал: «человек разгруппировал» и «перетаскивание убрало пустую
 *   обёртку» — разные события, и по одному коду они были бы неразличимы;
 * - **`batch`** склеивает намерение и починку в ОДИН шаг: `[move, unwrap]` — одна запись отмены,
 *   одна перерисовка буфера и одна запись журнала. Обратная к нему — `batch` из обратных
 *   в обратном порядке, поэтому точность сохраняется целиком, а не «почти».
 *
 * Промежуточное состояние наружу не выходит: `applyEditOp` чистая, состав применяется к локальной
 * копии, и отказ на любом шаге оставляет модель нетронутой.
 *
 * ## Копия всегда получает новые идентификаторы
 *
 * Вставка — это НОВЫЙ узел. Сохранить чужой идентификатор значило бы создать двойника, на
 * которого сработают правила и диагностики оригинала. Исключение ровно одно и оно явное:
 * `params.keepIds` у `insert`, которым пользуется обратная операция удаления — там узел
 * не рождается, а возвращается, и адрес обязан быть прежним.
 *
 * @module plugins/editor-schema/model/ops
 */

import {
  isArrayNode,
  isFieldNode,
  parseOperator,
  type JsonFormSchema,
  type JsonNode,
} from '@reformer/renderer-json';
import { canAcceptChildren, childSlots, isNodeLike } from '@/lib/form-model/node-kind';
import { newNodeId, nodeIdOf, reissueNodeIds, type NodeIdFactory } from '@/lib/form-model/node-id';
import { getAt, removeAt, updateAt, type JsonPath } from '@/lib/form-model/paths';
import {
  flipDirection,
  groupBlock,
  insertNode,
  isDegenerateWrapper,
  setComponent,
  setComponentProp,
  setNodeKey,
  setTextChild,
  textChildIndex,
  ungroupNode,
} from '@/lib/form-model/mutate';
import { indexNodes, type NodeIndex } from './node-index';
import type { ApplyResult, EditOp, NodeId } from '../host';

/** Массив-слот, в который кладут узлы. Одиночные (`template`/`wrapper`) вставку не принимают. */
export type ArraySlot = 'children' | 'steps';

/** Типы операций словаря. Проверяется на применении: чужой тип — отказ, а не тишина. */
export const SCHEMA_OP_TYPES = [
  'insert',
  'remove',
  'move',
  'duplicate',
  'group',
  'ungroup',
  'unwrap',
  'flip',
  'set-prop',
  'set-binding',
  'set-text',
  'set-component',
  'rename-prop',
  'batch',
] as const;

export type SchemaOpType = (typeof SCHEMA_OP_TYPES)[number];

/** Отказ применить операцию: неизвестный тип, исчезнувшая цель, негодные параметры. */
export class SchemaOpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaOpError';
  }
}

// ── конструкторы операций ───────────────────────────────────────────────────────
//
// Существуют затем, чтобы литерал операции не собирался руками в трёх местах: канвасе,
// палитре и команде. Форма операции — часть контракта с журналом, и опечатка в имени
// параметра проявилась бы только при воспроизведении записи.

/** Вставить узел в слот родителя. Без `parent` — в `children` корня. */
export function insertOp(
  node: JsonNode,
  options: { parent?: NodeId; slot?: ArraySlot; index?: number; keepIds?: boolean } = {}
): EditOp {
  const params: Record<string, unknown> = { node };
  if (options.slot !== undefined) params.slot = options.slot;
  if (options.index !== undefined) params.index = options.index;
  if (options.keepIds === true) params.keepIds = true;
  return { type: 'insert', target: options.parent, params };
}

/** Удалить узел вместе с поддеревом. */
export function removeOp(target: NodeId): EditOp {
  return { type: 'remove', target };
}

/** Переместить узел в слот другого (или того же) родителя на позицию `index`. */
export function moveOp(
  target: NodeId,
  options: { parent: NodeId; slot?: ArraySlot; index: number }
): EditOp {
  const params: Record<string, unknown> = { parent: options.parent, index: options.index };
  if (options.slot !== undefined) params.slot = options.slot;
  return { type: 'move', target, params };
}

/** Дублировать узел: копия встаёт сразу после оригинала и получает новые идентификаторы. */
export function duplicateOp(target: NodeId): EditOp {
  return { type: 'duplicate', target };
}

/** Сгруппировать соседей в `$html(div)`. `nodes` — непрерывный блок в одном массив-слоте. */
export function groupOp(
  nodes: readonly NodeId[],
  options: { className?: string; template?: JsonNode } = {}
): EditOp {
  const params: Record<string, unknown> = { nodes: [...nodes] };
  if (options.className !== undefined) params.className = options.className;
  if (options.template !== undefined) params.template = options.template;
  return { type: 'group', target: nodes[0], params };
}

/** Разгруппировать `$html(div)`: его дети занимают его место. */
export function ungroupOp(target: NodeId): EditOp {
  return { type: 'ungroup', target };
}

/**
 * Свернуть вырожденную обёртку — `$html(div)` с flex/grid-раскладкой и РОВНО одним ребёнком.
 *
 * Отдельно от {@link ungroupOp}, хотя действие внешне то же: см. шапку модуля. Коротко —
 * `ungroup` распускает что попросят, а `unwrap` отказывается тронуть обёртку, в которой ещё
 * что-то есть, и этот отказ — предохранитель машинного сворачивания.
 */
export function unwrapOp(target: NodeId): EditOp {
  return { type: 'unwrap', target };
}

/**
 * Перевернуть направление контейнера: ряд ⇄ столбец, НА МЕСТЕ и без нового `div`.
 *
 * Своя операция, а не `set-prop` с классом, по двум причинам. Первая: направление живёт
 * не в отдельном свойстве, а в наборе utility-классов, и вычислять следующий набор обязан
 * домен ({@link flipDirection}) — иначе редактор завёл бы собственное представление о том,
 * что такое «горизонтальный», и разошёлся бы с `orientationOf`, по которому канвас рисует.
 * Вторая: у переворота обратная — он сам, и это точно, а `set-prop` возил бы прежнюю строку
 * класса, которую человек мог и не писать.
 */
export function flipOp(target: NodeId): EditOp {
  return { type: 'flip', target };
}

/**
 * Записать текстовое содержимое узла. Пустая строка убирает текстовую часть.
 *
 * Обратная — она же с прежним текстом, поэтому обратимость точная и без особого случая:
 * «текста не было» и «текст был пустой» — одно и то же состояние `children`.
 */
export function setTextOp(target: NodeId, text: string): EditOp {
  return { type: 'set-text', target, params: { text } };
}

/**
 * Один шаг из нескольких операций: намерение плюс его починки.
 *
 * Существует ради перетаскивания, где перемещение оставляет за собой вырожденную обёртку,
 * и ради того, чтобы человек отменял такой ход ОДНИМ Ctrl+Z. Всё остальное следует из этого:
 * состав применяется целиком или никак, обратная — состав обратных в обратном порядке,
 * в журнал уходит одна запись.
 *
 * Состав НЕ вкладывается: обратная к плоскому составу — плоский состав, поэтому вложенность
 * из наших операций не рождается никогда, а разрешить её значило бы пустить рекурсию,
 * глубину которой задаёт файл.
 */
export function batchOp(ops: readonly EditOp[]): EditOp {
  return { type: 'batch', params: { ops: [...ops] } };
}

/** Задать (или удалить, если `value` не передан) ключ `componentProps`. */
export function setPropOp(target: NodeId, key: string, value?: unknown): EditOp {
  const params: Record<string, unknown> = { key };
  if (value !== undefined) params.value = value;
  return { type: 'set-prop', target, params };
}

/** Задать (или снять) привязку узла к модели формы: `$model(path)`. */
export function setBindingOp(target: NodeId, model?: string): EditOp {
  const params: Record<string, unknown> = {};
  if (model !== undefined && model !== '') params.model = model;
  return { type: 'set-binding', target, params };
}

/**
 * Поставить узлу другой компонент каталога: `component` становится `$component(name)`.
 *
 * Отдельная операция, а не `set-prop` по ключу `component`: тот правит `componentProps`,
 * то есть СОДЕРЖИМОЕ компонента, а не сам компонент. Общий «поставь ключ узлу» здесь тоже
 * не подходит — он принял бы любую строку, а сюда приходит имя из каталога, и обёртка
 * `$component(...)` обязана ставиться в одном месте, а не у каждого вызывающего.
 *
 * `componentProps` НЕ чистятся: снятие ключей, которых нет у нового компонента, — это
 * `switchVariant` домена, решение о замене варианта. Быстрое исправление опечатки в имени
 * («Inpt» → «Input») чужие свойства терять не должно, а лишний ключ увидит тот же валидатор
 * следующим проходом.
 */
export function setComponentOp(target: NodeId, name: string): EditOp {
  return { type: 'set-component', target, params: { name } };
}

/**
 * Переименовать ключ в `componentProps`, сохранив его МЕСТО в объекте.
 *
 * Составом из двух `set-prop` (снять старый, поставить новый) это не выражается: удаление
 * с последующей вставкой уносит ключ в конец объекта, и обратная операция вернула бы его
 * туда же — то есть отмена меняла бы текст файла, хотя обязана его восстанавливать.
 * Порядок ключей здесь не косметика: печать детерминированна, и по её результату сравнивают
 * буфер с моделью.
 *
 * Обратная — переименование назад, и она точная ровно потому, что место сохраняется.
 */
export function renamePropOp(target: NodeId, from: string, to: string): EditOp {
  return { type: 'rename-prop', target, params: { from, to } };
}

/**
 * Ключ схлопывания истории — `свойство@узел`, как в v1.
 *
 * Без него набор текста в поле инспектора забивает стек отмены посимвольно. Схлопываются
 * только правки свойств: структурная операция всегда отдельная запись, даже если повторяется.
 */
export function mergeKeyOf(op: EditOp): string | undefined {
  const key = MERGE_PROPERTY[op.type]?.(op);
  return key === undefined ? undefined : `${key}@${op.target ?? ''}`;
}

/**
 * Какое «свойство» правит операция — левая половина ключа схлопывания.
 *
 * Таблица, а не цепочка условий: набор схлопываемых операций растёт (текст узла пришёл вслед
 * за свойством и привязкой), и каждое новое `if` в цепочке — повод забыть про `undefined`
 * для структурных, которые схлопываться не должны никогда.
 */
const MERGE_PROPERTY: Readonly<Record<string, ((op: EditOp) => string) | undefined>> = {
  'set-prop': (op) => String(op.params?.key ?? ''),
  'set-binding': () => '$model',
  'set-text': () => '$text',
};

// ── применение ──────────────────────────────────────────────────────────────────

export interface ApplyOptions {
  /** Генератор идентификаторов. В тестах — детерминированный, в бою — {@link newNodeId}. */
  readonly newId?: NodeIdFactory;
}

/**
 * Применяет операцию к модели.
 *
 * @throws {@link SchemaOpError} — неизвестный тип, исчезнувшая цель, негодные параметры.
 *   Исключение здесь нормальное состояние, а не авария: документ ловит его и отвечает отказом
 *   применения, оставляя модель нетронутой.
 */
export function applyEditOp(
  model: JsonFormSchema,
  op: EditOp,
  options: ApplyOptions = {}
): ApplyResult<JsonFormSchema> {
  const newId = options.newId ?? newNodeId;
  const index = indexNodes(model);

  switch (op.type) {
    case 'insert':
      return applyInsert(model, op, index, newId);
    case 'remove':
      return applyRemove(model, op, index);
    case 'move':
      return applyMove(model, op, index);
    case 'duplicate':
      return applyDuplicate(model, op, index, newId);
    case 'group':
      return applyGroup(model, op, index, newId);
    case 'ungroup':
      return applyUngroup(model, op, index);
    case 'unwrap':
      return applyUnwrap(model, op, index);
    case 'flip':
      return applyFlip(model, op, index);
    case 'set-prop':
      return applySetProp(model, op, index);
    case 'set-binding':
      return applySetBinding(model, op, index);
    case 'set-text':
      return applySetText(model, op, index);
    case 'set-component':
      return applySetComponent(model, op, index);
    case 'rename-prop':
      return applyRenameProp(model, op, index);
    case 'batch':
      return applyBatch(model, op, options);
    default:
      throw new SchemaOpError(`неизвестная операция: «${op.type}»`);
  }
}

// ── разбор адресов ──────────────────────────────────────────────────────────────

/** Место узла в массив-слоте: родитель, слот и позиция. */
export interface SlotPosition {
  readonly parentPath: JsonPath;
  readonly slot: ArraySlot;
  readonly index: number;
}

function isIndexSegment(segment: unknown): boolean {
  return typeof segment === 'number' || /^\d+$/.test(String(segment));
}

/**
 * Куда именно вложен узел с таким путём.
 *
 * Читается с хвоста, потому что вложенность неоднородна: дети лежат в `children`, шаги —
 * в `componentProps.steps`, шаблон элемента — в `item.$template`. Первые два адресуются
 * позицией и принимают вставку, последний — нет, и для него ответ `null`.
 */
export function slotPositionOf(path: JsonPath): SlotPosition | null {
  const n = path.length;
  const last = path[n - 1];
  if (n >= 2 && path[n - 2] === 'children' && isIndexSegment(last)) {
    return { parentPath: path.slice(0, n - 2), slot: 'children', index: Number(last) };
  }
  if (
    n >= 3 &&
    path[n - 3] === 'componentProps' &&
    path[n - 2] === 'steps' &&
    isIndexSegment(last)
  ) {
    return { parentPath: path.slice(0, n - 3), slot: 'steps', index: Number(last) };
  }
  return null;
}

/** Путь массива-слота у родителя. Слот `children` создаётся вставкой, если его ещё нет. */
function slotPathOf(model: JsonFormSchema, parentPath: JsonPath, slot: ArraySlot): JsonPath {
  const parent = getAt(model, parentPath);
  if (!isNodeLike(parent)) throw new SchemaOpError('родитель вставки — не узел');
  if (!canAcceptChildren(parent)) {
    throw new SchemaOpError('узел не принимает вложенные компоненты');
  }
  if (slot === 'steps') {
    const steps = childSlots(parent, parentPath).find((s) => s.kind === 'steps');
    if (!steps) throw new SchemaOpError('у узла нет слота шагов');
    return steps.path;
  }
  return [...parentPath, 'children'];
}

/** Цель операции или отказ: узел мог быть удалён между решением и применением. */
function requireTarget(index: NodeIndex, op: EditOp) {
  if (op.target === undefined) throw new SchemaOpError(`операция «${op.type}» требует цели`);
  const entry = index.find(op.target);
  if (!entry) throw new SchemaOpError(`узел не найден: ${op.target}`);
  return entry;
}

/** Идентификатор узла по пути; отсутствие означает модель, собранную мимо разбора. */
function requireId(index: NodeIndex, path: JsonPath): NodeId {
  const id = index.idAt(path);
  if (id === undefined) throw new SchemaOpError('у узла нет идентификатора');
  return id;
}

// ── операции ────────────────────────────────────────────────────────────────────

function applyInsert(
  model: JsonFormSchema,
  op: EditOp,
  index: NodeIndex,
  newId: NodeIdFactory
): ApplyResult<JsonFormSchema> {
  const raw = op.params?.node;
  if (!isNodeLike(raw)) throw new SchemaOpError('insert: в параметрах нет узла');
  const parentPath = op.target === undefined ? ['root'] : requireTarget(index, op).path;
  const slot = readSlot(op.params?.slot);
  const slotPath = slotPathOf(model, parentPath, slot);
  const at = op.params?.index;
  const arr = getAt(model, slotPath);
  const length = Array.isArray(arr) ? arr.length : 0;
  const position = typeof at === 'number' ? at : length;

  // Идентификаторы перевыдаются ВСЕГДА, кроме возврата удалённого: см. шапку модуля.
  const node = op.params?.keepIds === true ? raw : reissueNodeIds(raw, newId);
  const { schema } = insertNode(model, slotPath, position, node);
  const focus = nodeIdOf(node);
  if (focus === undefined) throw new SchemaOpError('вставленный узел остался без идентификатора');
  return { model: schema, inverse: removeOp(focus), focus };
}

function applyRemove(
  model: JsonFormSchema,
  op: EditOp,
  index: NodeIndex
): ApplyResult<JsonFormSchema> {
  const { path, node } = requireTarget(index, op);
  const position = slotPositionOf(path);
  if (!position) throw new SchemaOpError('узел лежит в одиночном слоте: удалять нечего');
  const parentId = requireId(index, position.parentPath);
  return {
    model: removeAt(model, path),
    // Узел возвращается КАК БЫЛ, с прежними идентификаторами: отмена не создаёт нового узла.
    inverse: insertOp(node, {
      parent: parentId,
      slot: position.slot,
      index: position.index,
      keepIds: true,
    }),
    focus: parentId,
  };
}

function applyMove(
  model: JsonFormSchema,
  op: EditOp,
  index: NodeIndex
): ApplyResult<JsonFormSchema> {
  const { path, id, node } = requireTarget(index, op);
  const from = slotPositionOf(path);
  if (!from) throw new SchemaOpError('узел лежит в одиночном слоте: перемещать нечего');
  const parent = op.params?.parent;
  if (typeof parent !== 'string') throw new SchemaOpError('move: не указан родитель');
  const parentEntry = index.find(parent);
  if (!parentEntry) throw new SchemaOpError(`узел не найден: ${parent}`);
  const slot = readSlot(op.params?.slot);
  const at = op.params?.index;
  if (typeof at !== 'number') throw new SchemaOpError('move: не указана позиция');

  // Узел нельзя переместить внутрь самого себя: путь цели начинался бы путём источника,
  // и после выреза адрес назначения указывал бы в исчезнувшее поддерево.
  if (isSelfOrDescendant(path, parentEntry.path)) {
    throw new SchemaOpError('узел нельзя переместить внутрь самого себя');
  }

  const slotPath = slotPathOf(model, parentEntry.path, slot);
  const afterRemove = removeAt(model, path);
  // Компенсация: вырезали из того же слота ДО точки вставки — всё, что правее, сдвинулось.
  const sameSlot = pathsEqual(path.slice(0, -1), slotPath);
  const position = sameSlot && from.index < at ? at - 1 : at;
  const { schema } = insertNode(afterRemove, slotPath, position, node);

  return {
    model: schema,
    inverse: moveOp(id, {
      parent: requireId(index, from.parentPath),
      slot: from.slot,
      // Позиция называется в координатах ДО выреза, поэтому обратной операции мало прежнего
      // индекса: перестановка ВЛЕВО оставила узел левее его прежнего места, и та же
      // компенсация, что применена выше, съела бы единицу второй раз — узел вернулся бы
      // туда, где уже стоит, то есть отмена не отменяла бы ничего.
      index: sameSlot && position < from.index ? from.index + 1 : from.index,
    }),
    focus: id,
  };
}

function applyDuplicate(
  model: JsonFormSchema,
  op: EditOp,
  index: NodeIndex,
  newId: NodeIdFactory
): ApplyResult<JsonFormSchema> {
  const { path, node } = requireTarget(index, op);
  const position = slotPositionOf(path);
  if (!position) throw new SchemaOpError('узел лежит в одиночном слоте: дублировать некуда');
  // Копия — новый узел, поэтому идентификаторы выдаются заново всему поддереву.
  const copy = reissueNodeIds(structuredClone(node), newId);
  const { schema } = insertNode(model, path.slice(0, -1), position.index + 1, copy);
  const focus = nodeIdOf(copy);
  if (focus === undefined) throw new SchemaOpError('копия осталась без идентификатора');
  return { model: schema, inverse: removeOp(focus), focus };
}

function applyGroup(
  model: JsonFormSchema,
  op: EditOp,
  index: NodeIndex,
  newId: NodeIdFactory
): ApplyResult<JsonFormSchema> {
  const ids = op.params?.nodes;
  if (!Array.isArray(ids) || ids.length === 0) throw new SchemaOpError('group: пустой блок');
  const block = resolveBlock(index, ids as readonly NodeId[]);
  const template = op.params?.template;
  const restored = isNodeLike(template)
    ? (template as unknown as Record<string, unknown>)
    : undefined;
  const className =
    typeof op.params?.className === 'string'
      ? op.params.className
      : classNameOf(restored as JsonNode | undefined);

  const grouped = groupBlock(model, block.slotPath, block.start, block.count, { className });
  // `groupBlock` рождает узел без идентификатора. Обратная операция разгруппировки везёт
  // прежнюю обёртку в `template` — тогда восстанавливается и её идентификатор, и её пропсы;
  // иначе адрес выдаётся здесь, потому что дальше на него переезжает выделение.
  const model2 = updateAt(grouped.schema, grouped.newPath, (created) => {
    const kids = (created as { children?: unknown }).children;
    if (restored !== undefined) return { ...restored, children: kids };
    return { $nodeId: newId(), ...(created as Record<string, unknown>) };
  });

  const groupId = indexNodes(model2).idAt(grouped.newPath);
  if (groupId === undefined) throw new SchemaOpError('группа осталась без идентификатора');
  return { model: model2, inverse: ungroupOp(groupId), focus: groupId };
}

function applyUngroup(
  model: JsonFormSchema,
  op: EditOp,
  index: NodeIndex
): ApplyResult<JsonFormSchema> {
  const { path, node } = requireTarget(index, op);
  const kids = (node as { children?: unknown }).children;
  if (!Array.isArray(kids) || kids.length === 0) {
    throw new SchemaOpError('разгруппировывать нечего: у узла нет детей');
  }
  // Текстовая часть адреса не имеет, а обратная операция собирается из адресов. Отказ здесь
  // честнее необратимой правки: содержимое, потерянное отменой, назад не возвращается ничем.
  if (!kids.every(isNodeLike)) {
    throw new SchemaOpError('узел с текстовым содержимым не разгруппировывается');
  }
  const childIds = kids.map((kid) => nodeIdOf(kid as JsonNode));
  if (childIds.some((id) => id === undefined)) {
    throw new SchemaOpError('у ребёнка нет идентификатора');
  }
  const { schema, newPath } = ungroupNode(model, path);
  if (schema === model) throw new SchemaOpError('узел не разгруппировывается');
  const template: Record<string, unknown> = { ...(node as unknown as Record<string, unknown>) };
  delete template.children;
  return {
    model: schema,
    inverse: groupOp(childIds as NodeId[], { template: template as unknown as JsonNode }),
    focus: indexNodes(schema).idAt(newPath),
  };
}

/**
 * Сворачивание вырожденной обёртки.
 *
 * Три отказа, и каждый защищает обратимость, а не аккуратность:
 *
 * - **не вырожденная обёртка** — сворачивать нечего, и молчаливое согласие означало бы, что
 *   планировщик перетаскивания ошибся, а операция это скрыла;
 * - **единственный ребёнок текстовый** — у текста нет адреса, поэтому обратная операция его
 *   не назовёт (та же причина, по которой отказывает `ungroup`);
 * - **обёртка лежит в одиночном слоте** (`wrapper`, `item.$template`) — там нет позиции,
 *   в которую ребёнок мог бы встать, и `ungroupNode` домена честно возвращает исходную схему.
 */
function applyUnwrap(
  model: JsonFormSchema,
  op: EditOp,
  index: NodeIndex
): ApplyResult<JsonFormSchema> {
  const { path, node } = requireTarget(index, op);
  if (!isDegenerateWrapper(node)) {
    throw new SchemaOpError('unwrap: узел не вырожденная обёртка');
  }
  const only = (node as { children?: readonly unknown[] }).children?.[0];
  if (!isNodeLike(only)) {
    throw new SchemaOpError('unwrap: единственный ребёнок обёртки не узел');
  }
  const childId = nodeIdOf(only);
  if (childId === undefined) throw new SchemaOpError('unwrap: у ребёнка нет идентификатора');

  const { schema } = ungroupNode(model, path);
  if (schema === model) throw new SchemaOpError('unwrap: обёртка лежит в одиночном слоте');

  // Обёртка целиком (без детей) уезжает в обратную операцию: оттуда вернутся и её адрес,
  // и её классы — отмена восстанавливает ту же обёртку, а не похожую.
  const template: Record<string, unknown> = { ...(node as unknown as Record<string, unknown>) };
  delete template.children;
  return {
    model: schema,
    inverse: groupOp([childId], { template: template as unknown as JsonNode }),
    focus: childId,
  };
}

function applyFlip(
  model: JsonFormSchema,
  op: EditOp,
  index: NodeIndex
): ApplyResult<JsonFormSchema> {
  const { path, id } = requireTarget(index, op);
  const { schema } = flipDirection(model, path);
  // Домен отвечает той же моделью, когда переворачивать нечего (узел не контейнер). Отказ здесь
  // честнее тихого согласия: шаг отмены, ничего не меняющий, человек воспринимает как поломку
  // отмены, а не как «эта правка ничего не делала».
  if (schema === model) throw new SchemaOpError('flip: у узла нет направления');
  return { model: schema, inverse: flipOp(id), focus: id };
}

/**
 * Состав операций как один шаг.
 *
 * Применяется к локальной копии, поэтому отказ на любом шаге не оставляет полуправки: наружу
 * уходит исключение, а модель у вызывающего остаётся прежней.
 *
 * **Куда смотреть после составной правки — на первую операцию, а не на последнюю.** Состав
 * устроен как «намерение, затем починки»: человек перетащил узел, а сворачивание пустой обёртки
 * он не заказывал и смотреть на её остаток не собирался. Если узел намерения до конца состава
 * не дожил, ответ берётся с хвоста — это лучше, чем показать на несуществующий адрес.
 */
function applyBatch(
  model: JsonFormSchema,
  op: EditOp,
  options: ApplyOptions
): ApplyResult<JsonFormSchema> {
  const steps = op.params?.ops;
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new SchemaOpError('batch: пустой состав');
  }

  let current = model;
  const inverses: EditOp[] = [];
  const focuses: NodeId[] = [];

  for (const step of steps) {
    if (!isEditOpLike(step)) throw new SchemaOpError('batch: в составе не операция');
    if (step.type === 'batch') throw new SchemaOpError('batch: состав не вкладывается в состав');
    const result = applyEditOp(current, step, options);
    current = result.model;
    inverses.push(result.inverse);
    if (result.focus !== undefined) focuses.push(result.focus);
  }

  const finalIndex = indexNodes(current);
  const focus =
    focuses.find((id) => finalIndex.find(id) !== undefined) ?? focuses[focuses.length - 1];

  return {
    model: current,
    inverse: batchOp([...inverses].reverse()),
    ...(focus === undefined ? {} : { focus }),
  };
}

/** Похоже ли значение на операцию: этого достаточно, чтобы отдать его `applyEditOp`. */
function isEditOpLike(value: unknown): value is EditOp {
  return typeof value === 'object' && value !== null && typeof (value as EditOp).type === 'string';
}

function applySetProp(
  model: JsonFormSchema,
  op: EditOp,
  index: NodeIndex
): ApplyResult<JsonFormSchema> {
  const { path, node, id } = requireTarget(index, op);
  const key = op.params?.key;
  if (typeof key !== 'string' || key === '') throw new SchemaOpError('set-prop: не указан ключ');
  const props = (node as { componentProps?: Record<string, unknown> }).componentProps;
  const previous = props?.[key];
  const { schema } = setComponentProp(model, path, key, op.params?.value);
  return { model: schema, inverse: setPropOp(id, key, previous), focus: id };
}

function applySetBinding(
  model: JsonFormSchema,
  op: EditOp,
  index: NodeIndex
): ApplyResult<JsonFormSchema> {
  const { path, node, id } = requireTarget(index, op);
  const key = bindingKeyOf(node);
  const previous = (node as unknown as Record<string, unknown>)[key];
  const next = op.params?.model;
  if (next !== undefined && typeof next !== 'string') {
    throw new SchemaOpError('set-binding: путь модели должен быть строкой');
  }
  const value = next === undefined || next === '' ? undefined : `$model(${next})`;
  const { schema } = setNodeKey(model, path, key, value);
  return {
    model: schema,
    inverse: { type: 'set-binding', target: id, params: bindingParams(previous) },
    focus: id,
  };
}

/**
 * Замена компонента узла.
 *
 * Отказ, если у узла сейчас не `$component(...)`, — не перестраховка, а условие ТОЧНОЙ
 * обратимости: обратная операция называет компонент ИМЕНЕМ, а `$html(div)` именем каталога
 * не выражается, и вернуть его этой же операцией было бы нечем. Узлы разметки меняют не
 * заменой имени, а перестройкой поддерева.
 */
function applySetComponent(
  model: JsonFormSchema,
  op: EditOp,
  index: NodeIndex
): ApplyResult<JsonFormSchema> {
  const { path, node, id } = requireTarget(index, op);
  const name = op.params?.name;
  if (typeof name !== 'string' || name === '') {
    throw new SchemaOpError('set-component: не указано имя компонента');
  }
  const previous = parseOperator((node as { component?: unknown }).component);
  if (previous?.op !== 'component') {
    throw new SchemaOpError('set-component: у узла не компонент каталога');
  }
  const { schema } = setComponent(model, path, `$component(${name})`);
  return { model: schema, inverse: setComponentOp(id, previous.arg), focus: id };
}

/**
 * Переименование ключа в `componentProps` с сохранением его места.
 *
 * Три отказа, и каждый закрывает свою потерю: без старого ключа переименовывать нечего,
 * при занятом новом переименование затёрло бы чужое значение, а совпадающие имена означают
 * операцию без действия — она попала бы в историю пустой записью.
 */
function applyRenameProp(
  model: JsonFormSchema,
  op: EditOp,
  index: NodeIndex
): ApplyResult<JsonFormSchema> {
  const { path, node, id } = requireTarget(index, op);
  const from = op.params?.from;
  const to = op.params?.to;
  if (typeof from !== 'string' || from === '' || typeof to !== 'string' || to === '') {
    throw new SchemaOpError('rename-prop: не указано имя свойства');
  }
  if (from === to) throw new SchemaOpError('rename-prop: имена свойств совпадают');
  const props = (node as { componentProps?: Record<string, unknown> }).componentProps;
  if (props === undefined || !Object.hasOwn(props, from)) {
    throw new SchemaOpError(`rename-prop: у узла нет свойства «${from}»`);
  }
  if (Object.hasOwn(props, to)) {
    throw new SchemaOpError(`rename-prop: свойство «${to}» у узла уже есть`);
  }
  const next = updateAt(model, [...path, 'componentProps'], (raw: unknown) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      out[key === from ? to : key] = value;
    }
    return out;
  });
  return { model: next, inverse: renamePropOp(id, to, from), focus: id };
}

/**
 * Правка текстового содержимого узла.
 *
 * Отказ при НЕСКОЛЬКИХ текстовых частях — не упрощение, а честность: домен правит ровно одну
 * ({@link setTextChild}), и какая из трёх имелась в виду, операция не знает. Такой узел
 * правится в JSON, и инспектор говорит это прямо.
 */
function applySetText(
  model: JsonFormSchema,
  op: EditOp,
  index: NodeIndex
): ApplyResult<JsonFormSchema> {
  const { path, node, id } = requireTarget(index, op);
  const text = op.params?.text;
  if (typeof text !== 'string') throw new SchemaOpError('set-text: не указан текст');
  const at = textChildIndex(node);
  if (at === null) {
    throw new SchemaOpError('set-text: у узла несколько текстовых частей');
  }
  const kids = (node as { children?: readonly unknown[] }).children;
  const previous = at < 0 ? '' : String(kids?.[at] ?? '');
  const { schema } = setTextChild(model, path, text);
  return { model: schema, inverse: setTextOp(id, previous), focus: id };
}

// ── мелочи ──────────────────────────────────────────────────────────────────────

/**
 * Ключ привязки: у поля это `value`, у массива — `array`.
 *
 * Контейнер к модели не привязывается вовсе, и придумать ему ключ значило бы записать
 * в схему поле, которого рендерер у контейнера не читает.
 */
function bindingKeyOf(node: JsonNode): 'value' | 'array' {
  if (isArrayNode(node)) return 'array';
  if (isFieldNode(node)) return 'value';
  throw new SchemaOpError('контейнер не привязывается к модели формы');
}

/** Параметры обратной привязки: прежнее значение оператора без обёртки `$model(...)`. */
function bindingParams(previous: unknown): Record<string, unknown> {
  if (typeof previous !== 'string') return {};
  const match = /^\$model\((.*)\)$/.exec(previous);
  return match ? { model: match[1] } : {};
}

function readSlot(value: unknown): ArraySlot {
  if (value === undefined || value === 'children') return 'children';
  if (value === 'steps') return 'steps';
  throw new SchemaOpError(`вставка в слот «${String(value)}» не поддерживается`);
}

function classNameOf(node: JsonNode | undefined): string | undefined {
  const value = (node as { componentProps?: Record<string, unknown> } | undefined)?.componentProps
    ?.className;
  return typeof value === 'string' ? value : undefined;
}

function pathsEqual(a: JsonPath, b: JsonPath): boolean {
  return a.length === b.length && a.every((seg, i) => String(seg) === String(b[i]));
}

function isSelfOrDescendant(ancestor: JsonPath, path: JsonPath): boolean {
  return (
    ancestor.length <= path.length && ancestor.every((seg, i) => String(seg) === String(path[i]))
  );
}

/** Непрерывный блок соседей в одном массив-слоте — то, что умеет группировка. */
interface Block {
  readonly slotPath: JsonPath;
  readonly start: number;
  readonly count: number;
}

function resolveBlock(index: NodeIndex, ids: readonly NodeId[]): Block {
  const positions = ids.map((id) => {
    const entry = index.find(id);
    if (!entry) throw new SchemaOpError(`узел не найден: ${id}`);
    const position = slotPositionOf(entry.path);
    if (!position) throw new SchemaOpError('узел лежит в одиночном слоте: группировать нечего');
    return { position, slotPath: entry.path.slice(0, -1) };
  });

  const slotPath = positions[0].slotPath;
  if (!positions.every((p) => pathsEqual(p.slotPath, slotPath))) {
    throw new SchemaOpError('группировать можно только соседей одного слота');
  }
  const indices = positions.map((p) => p.position.index).sort((a, b) => a - b);
  const start = indices[0];
  const count = indices[indices.length - 1] - start + 1;
  // Разрыв означает, что между выбранными узлами лежит что-то ещё (текстовая часть или
  // невыбранный сосед). Захватить его молча значило бы сгруппировать не то, что выделено.
  if (count !== indices.length) throw new SchemaOpError('блок группировки должен быть непрерывным');
  return { slotPath, start, count };
}

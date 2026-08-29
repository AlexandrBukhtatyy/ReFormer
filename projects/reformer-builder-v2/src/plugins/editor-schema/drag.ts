/**
 * Перетаскивание: что означает бросок и во что он превращается.
 *
 * Модуль чистый и не знает ни про DOM, ни про React. Причина та же, по которой отдельно живут
 * {@link './placement'} и {@link './canvas-tree'}: правила перетаскивания — предметные, у них
 * есть углы (визард, шаблон элемента, вырожденная обёртка), и проверять их надо в окружении
 * `node`, а не сквозь события мыши. В браузерном прогоне остаётся ровно то, чего без браузера
 * не видно: геометрия зон и то, что событие вообще доходит.
 *
 * ## Бросок — это одно из трёх мест, а не координата
 *
 * Канвас рисует ДЕРЕВО, а не форму. У строки дерева нет левого и правого края, поэтому
 * «поставить рядом в ряд» перетаскиванием здесь невыразимо — это делает команда «Сгруппировать».
 * Осталось три положения: перед строкой, после строки и внутрь строки-контейнера. Ровно они
 * и покрывают всё, что человек может показать мышью на вертикальном списке.
 *
 * Отсюда же следует, что `wrapInRow`/`wrapPairInRow`/`flipWrapperPair` домена здесь НЕ
 * используются: они переставляют колонки в двумерной раскладке и принадлежат поверхности,
 * которая форму рисует, а не перечисляет. Сегодня такой поверхности с приёмом броска нет —
 * все объявляют `dragSource: false`, и это честное объявление, а не заглушка.
 *
 * ## Сворачивание вырожденной обёртки планируется ЗДЕСЬ
 *
 * Вынули одну из двух колонок — обёртка осталась с одной, и она бессмысленна. Но операция
 * перемещения сворачивать её не имеет права: тогда её обратная вернула бы узел в контейнер,
 * которого больше нет (см. шапку {@link './ops'}). Поэтому решение принимается заранее, по
 * модели ДО броска, и в состав добавляется отдельная операция `unwrap`. Предикат берётся
 * у домена ({@link isDegenerateWrapper}), а не пишется здесь заново: разойдясь с ним, планировщик
 * заказывал бы сворачивание там, где операция откажет, — и бросок отменялся бы целиком.
 *
 * @module plugins/editor-schema/drag
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { isDegenerateWrapper } from '@/lib/form-model/mutate';
import { canAcceptChildren, childSlots, isNodeLike } from '@/lib/form-model/node-kind';
import { getAt, type JsonPath } from '@/lib/form-model/paths';
import { indexNodes, type NodeIndex } from './node-index';
import { batchOp, insertOp, moveOp, slotPositionOf, unwrapOp, type ArraySlot } from './ops';
import type { EditOp, NodeId } from './host';

/**
 * Что тащат.
 *
 * Два вида, потому что операции разные: с палитры приходит узел, которого в схеме ещё нет
 * (`insert`), с канваса — адрес узла, который уже где-то лежит (`move`). Общего у них ровно
 * столько, чтобы место броска считалось одинаково.
 */
export type DragPayload =
  | { readonly kind: 'new'; readonly node: JsonNode }
  | { readonly kind: 'node'; readonly id: NodeId };

/** Куда относительно строки метится бросок. */
export type DropPosition = 'before' | 'after' | 'inside';

/** Строка канваса вместе с выбранным положением — то, что показывает подсветка. */
export interface DropSpot {
  readonly target: NodeId;
  readonly position: DropPosition;
}

/**
 * Доля высоты строки, отданная краевым зонам.
 *
 * Четверть сверху и четверть снизу: попасть в них мышью легко, а середина остаётся достаточно
 * большой, чтобы «внутрь» не требовало прицеливания. У строки, которая внутрь не принимает,
 * середина делится пополам между «перед» и «после» — иначе половина строки была бы мёртвой.
 */
const EDGE_FRACTION = 0.25;

/**
 * Положение по вертикальной координате внутри строки.
 *
 * Геометрия отделена от модели намеренно: здесь нет ни схемы, ни адресов, поэтому правило
 * проверяется числами, а не отрисовкой. Принимает ли узел вложение, решает не эта функция —
 * это знает {@link canDropInside}.
 */
export function dropPositionAt(
  rect: { readonly top: number; readonly height: number },
  clientY: number,
  acceptsInside: boolean
): DropPosition {
  if (rect.height <= 0) return acceptsInside ? 'inside' : 'after';
  const ratio = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1);
  if (!acceptsInside) return ratio < 0.5 ? 'before' : 'after';
  if (ratio < EDGE_FRACTION) return 'before';
  if (ratio > 1 - EDGE_FRACTION) return 'after';
  return 'inside';
}

/** Принимает ли узел вложение — то, от чего зависит, есть ли у строки зона «внутрь». */
export function canDropInside(schema: JsonFormSchema, target: NodeId): boolean {
  const entry = indexNodes(schema).find(target);
  return entry !== undefined && canAcceptChildren(entry.node);
}

/**
 * Операция, которой станет бросок, — или `null`, если бросать сюда нельзя.
 *
 * `null` не ошибка, а ответ: канвас по нему не рисует подсветку, и человек видит запрет
 * до того, как отпустит кнопку. Молча превратить запрещённый бросок в допустимый было бы
 * худшим из возможных — узел уехал бы не туда, куда его вели.
 *
 * Отказы и их причины:
 *
 * - **корень** соседей не имеет, поэтому «перед» и «после» у него не существуют;
 * - **одиночный слот** (`item.$template`, `wrapper`) соседей тоже не имеет — там ровно одно место;
 * - **узел внутрь себя или своего потомка** — путь назначения исчез бы вместе с вырезанным
 *   поддеревом (тот же запрет стоит и в самой операции, здесь он лишь виден заранее);
 * - **бросок на прежнее место** — правка, не меняющая ничего, но занимающая шаг отмены.
 */
export function planDrop(
  schema: JsonFormSchema,
  payload: DragPayload,
  spot: DropSpot
): EditOp | null {
  const index = indexNodes(schema);
  const target = index.find(spot.target);
  if (target === undefined) return null;

  const destination = destinationOf(schema, index, target.path, target.node, spot.position);
  if (destination === null) return null;

  if (payload.kind === 'new') return insertOp(payload.node, destination);

  const source = index.find(payload.id);
  if (source === undefined) return null;
  if (isSelfOrInside(source.path, target.path)) return null;

  const parentEntry = destination.parent === undefined ? undefined : index.find(destination.parent);
  const parentPath: JsonPath = parentEntry?.path ?? ['root'];
  if (isSelfOrInside(source.path, parentPath)) return null;

  const at = destination.index ?? slotLengthOf(schema, parentPath, destination.slot);
  if (isNoop(source.path, parentPath, destination.slot, at)) return null;

  const parent = destination.parent ?? index.idAt(['root']);
  if (parent === undefined) return null;

  const move = moveOp(payload.id, { parent, slot: destination.slot, index: at });
  const collapsing = wrapperLeftBehind(schema, index, source.path, parentPath);
  return collapsing === null ? move : batchOp([move, unwrapOp(collapsing)]);
}

/** Куда именно встанет узел: родитель, слот и позиция. Форма совпадает с {@link './placement'}. */
interface Destination {
  readonly parent?: NodeId;
  readonly slot: ArraySlot;
  readonly index?: number;
}

function destinationOf(
  schema: JsonFormSchema,
  index: NodeIndex,
  path: JsonPath,
  node: JsonNode,
  position: DropPosition
): Destination | null {
  if (position === 'inside') {
    if (!canAcceptChildren(node)) return null;
    const id = index.idAt(path);
    return id === undefined ? null : { parent: id, slot: slotKindOf(node, path) };
  }

  const place = slotPositionOf(path);
  // Корень и одиночные слоты соседей не имеют: «перед» и «после» там не про что.
  if (place === null) return null;
  const parent = index.idAt(place.parentPath);
  if (parent === undefined) return null;
  const parentNode = getAt(schema, place.parentPath);
  if (!isNodeLike(parentNode) || !canAcceptChildren(parentNode)) return null;
  return {
    parent,
    slot: place.slot,
    index: position === 'before' ? place.index : place.index + 1,
  };
}

/** Слот контейнера, принимающий вставку. То же правило, что у щелчка ({@link './placement'}). */
function slotKindOf(node: JsonNode, path: JsonPath): ArraySlot {
  return childSlots(node, path).some((slot) => slot.kind === 'steps') ? 'steps' : 'children';
}

/**
 * Сколько сейчас в слоте — «в конец» без этого не выразить числом.
 *
 * Берётся `length` слота, а не число его узлов: рядом с узлами в `children` лежат текстовые
 * части, и позиция, посчитанная по отфильтрованному списку, воткнула бы узел в середину.
 */
function slotLengthOf(schema: JsonFormSchema, parentPath: JsonPath, slot: ArraySlot): number {
  const parentNode = getAt(schema, parentPath);
  if (!isNodeLike(parentNode)) return 0;
  const found = childSlots(parentNode, parentPath).find((s) => s.kind === slot);
  if (found !== undefined) return found.length;
  const arr = getAt(schema, [...parentPath, 'children']);
  return Array.isArray(arr) ? arr.length : 0;
}

/** Совпадает ли назначение с тем местом, где узел и так лежит. */
function isNoop(sourcePath: JsonPath, parentPath: JsonPath, slot: ArraySlot, at: number): boolean {
  const from = slotPositionOf(sourcePath);
  if (from === null) return false;
  if (!pathsEqual(from.parentPath, parentPath) || from.slot !== slot) return false;
  // «Перед собой» и «после себя» — одно и то же место: после выреза индекс схлопывается.
  return at === from.index || at === from.index + 1;
}

/**
 * Обёртка, которая после переезда останется с одним ребёнком, — или `null`.
 *
 * Считается по модели ДО броска, потому что операция сворачивания заказывается заранее.
 * Условия все обязательны:
 *
 * - родитель источника станет вырожденной обёрткой ПОСЛЕ выреза, то есть сейчас в нём ровно двое;
 * - остающийся ребёнок — узел: текст сворачивание не переживёт (у него нет адреса, и обратная
 *   операция его не назовёт), поэтому такую обёртку оставляем как есть;
 * - назначение лежит ВНЕ этой обёртки: перестановка внутри ряда её не вырождает.
 *
 * Публична ради второго планировщика: схематичный вид ({@link './schematic-drop'}) оставляет за
 * собой ровно такие же обёртки, и второе правило про «когда обёртка выродилась» разошлось бы
 * с этим на первом же углу — а расхождение здесь означает заказ сворачивания там, где операция
 * откажет, то есть отменённый целиком бросок.
 */
export function wrapperLeftBehind(
  schema: JsonFormSchema,
  index: NodeIndex,
  sourcePath: JsonPath,
  parentPath: JsonPath
): NodeId | null {
  const from = slotPositionOf(sourcePath);
  if (from === null || from.slot !== 'children') return null;
  if (pathsEqual(from.parentPath, parentPath)) return null;
  // Обёртка не должна оказаться предком назначения: свернуть её значило бы сдвинуть адрес,
  // по которому узел только что положили.
  if (isSelfOrInside(from.parentPath, parentPath)) return null;

  const wrapper = getAt(schema, from.parentPath);
  if (!isNodeLike(wrapper)) return null;
  const kids = (wrapper as { children?: readonly unknown[] }).children;
  if (!Array.isArray(kids) || kids.length !== 2) return null;

  const survivor = kids[from.index === 0 ? 1 : 0];
  if (!isNodeLike(survivor)) return null;

  // Спрашиваем предикат домена про БУДУЩЕЕ состояние обёртки, а не про нынешнее: он требует
  // ровно одного ребёнка, а сейчас их двое. Так правило остаётся одно на двоих с операцией.
  const after = { ...(wrapper as unknown as Record<string, unknown>), children: [survivor] };
  if (!isDegenerateWrapper(after as unknown as JsonNode)) return null;

  return index.idAt(from.parentPath) ?? null;
}

function pathsEqual(a: JsonPath, b: JsonPath): boolean {
  return a.length === b.length && a.every((seg, i) => String(seg) === String(b[i]));
}

/** Лежит ли `path` в поддереве `ancestor` (включая сам узел). */
function isSelfOrInside(ancestor: JsonPath, path: JsonPath): boolean {
  return (
    ancestor.length <= path.length && ancestor.every((seg, i) => String(seg) === String(path[i]))
  );
}

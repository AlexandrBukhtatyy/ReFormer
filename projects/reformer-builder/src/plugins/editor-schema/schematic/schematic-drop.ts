/**
 * Планировщик броска схематичного вида: во что превращается зона {@link SchematicZone}.
 *
 * Надстройка над {@link '../editing/drag'}, а не его замена. Три «плоских» зоны (`before`, `after`,
 * `into`) означают ровно то же, что и в дереве, и планируются ТЕМ ЖЕ {@link planDrop} —
 * второй ответ на один вопрос означал бы, что один и тот же бросок в двух видах даёт разные
 * правки. Здесь живёт только то, чего в дереве нет: четыре обёрточные зоны.
 *
 * ## Обёртка собирается из существующих операций, а не из мутации домена
 *
 * У домена есть готовые `wrapInRow`/`wrapPairInRow`, и первая версия билдера звала именно их.
 * Здесь так нельзя: словарь операций обязан быть обратимым по шагам ({@link '../model/ops'}), а
 * доменная мутация — это одна непрозрачная правка схемы, к которой обратной операции нет.
 * Поэтому обёртка выражается составом уже существующих и уже обратимых:
 *
 * - обёрточная зона с грузом палитры — `batch([insert рядом с целью, group(пара, класс)])`;
 * - обёрточная зона с узлом канваса — `batch([move рядом с целью, (unwrap), group(пара, класс)])`.
 *
 * Отмена такого хода возвращает модель шаг в шаг, включая адрес обёртки, — и всё это
 * бесплатно, потому что каждая часть уже умеет отменяться.
 *
 * ## Новому узлу адрес выдаётся ЗДЕСЬ
 *
 * `group` называет узлы адресами, а вставка с палитры их ещё не имеет: адрес рождается при
 * применении. Поэтому планировщик выдаёт его заранее и просит `insert` сохранить (`keepIds`) —
 * иначе вторая операция состава ссылалась бы на узел, которого в модели нет.
 *
 * ## Две колонки одной обёртки не оборачиваются во вторую
 *
 * Если цель и груз — единственные две колонки одного flex-контейнера, «поставить их поперёк»
 * означает перевернуть САМ контейнер, а не вложить в него ещё один. Правило перенесено из
 * первой версии (`flipWrapperPair`) и здесь выражено составом `flip` плюс, если нужно, `move`.
 * Без него ряд из двух полей превращался бы в ряд, внутри которого столбец из тех же двух
 * полей, — вложенность, которой человек не просил.
 *
 * @module plugins/editor-schema/schematic/schematic-drop
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { DEFAULT_COL_CLASS, DEFAULT_ROW_CLASS } from '@/lib/form-model/mutate';
import { newNodeId, nodeIdOf, reissueNodeIds, type NodeIdFactory } from '@/lib/form-model/node-id';
import { isFlexWrapper, isNodeLike } from '@/lib/form-model/node-kind';
import { getAt, isPrefix, pathEquals, type JsonPath } from '@/lib/form-model/paths';
import { planDrop, wrapperLeftBehind, type DragPayload, type DropPosition } from '../editing/drag';
import { indexNodes } from '../model/node-index';
import { batchOp, flipOp, groupOp, insertOp, moveOp, slotPositionOf, unwrapOp } from '../model/ops';
import { type SchematicZone } from './schematic-zone';
import type { EditOp, NodeId } from '../host';

/** Коробка вместе с выбранной зоной — то, что показывает подсветка схематичного вида. */
export interface SchematicSpot {
  readonly target: NodeId;
  readonly zone: SchematicZone;
}

export interface SchematicDropOptions {
  /** Генератор адресов для узла с палитры. В тестах — детерминированный. */
  readonly newId?: NodeIdFactory;
}

/**
 * Операция, которой станет бросок, — или `null`, если бросать сюда нельзя.
 *
 * `null` тот же, что и у {@link planDrop}, и значит то же самое: подсветки не будет, и запрет
 * виден ДО того, как отпущена кнопка.
 */
export function planSchematicDrop(
  schema: JsonFormSchema,
  payload: DragPayload,
  spot: SchematicSpot,
  options: SchematicDropOptions = {}
): EditOp | null {
  const position = flatPositionOf(spot.zone);
  if (position !== null) return planDrop(schema, payload, { target: spot.target, position });
  return planWrap(schema, payload, spot, options.newId ?? newNodeId);
}

/**
 * Плоская зона на языке дерева — или `null` у обёрточной, которой в дереве нет.
 *
 * Таблица, а не проверка по набору `PERP_ZONES`: полный `switch` заставляет компилятор
 * потребовать ответа на КАЖДУЮ новую зону. Забытая зона молча ушла бы в обёрточную ветку,
 * а там она означала бы совсем другое действие.
 */
function flatPositionOf(zone: SchematicZone): DropPosition | null {
  switch (zone) {
    case 'before':
      return 'before';
    case 'after':
      return 'after';
    case 'into':
      return 'inside';
    default:
      return null;
  }
}

/** С какой стороны от цели встаёт брошенное. */
type Side = 'before' | 'after';

function sideOf(zone: SchematicZone): Side {
  return zone === 'beside-before' || zone === 'stack-before' ? 'before' : 'after';
}

/**
 * Класс будущей обёртки.
 *
 * `beside-*` рождается на поперечном крае ВЕРТИКАЛЬНОГО родителя, поэтому даёт ряд;
 * `stack-*` — на поперечном крае горизонтального, поэтому даёт столбец. Классы берутся
 * у домена: обёртка, собранная мышью, обязана быть неотличима от собранной командой.
 */
function classOf(zone: SchematicZone): string {
  return zone === 'beside-before' || zone === 'beside-after'
    ? DEFAULT_ROW_CLASS
    : DEFAULT_COL_CLASS;
}

function planWrap(
  schema: JsonFormSchema,
  payload: DragPayload,
  spot: SchematicSpot,
  newId: NodeIdFactory
): EditOp | null {
  const index = indexNodes(schema);
  const target = index.find(spot.target);
  if (target === undefined) return null;

  // Обернуть можно только узел, лежащий среди соседей: у единственного шага визарда, шаблона
  // элемента и корня соседей нет, и «поставить рядом» там не значит ничего. Слот `steps`
  // исключён отдельно: шаг визарда, завёрнутый в div, перестал бы быть шагом.
  const place = slotPositionOf(target.path);
  if (place === null || place.slot !== 'children') return null;
  const parentId = index.idAt(place.parentPath);
  if (parentId === undefined) return null;

  const side = sideOf(spot.zone);
  const className = classOf(spot.zone);
  const at = side === 'before' ? place.index : place.index + 1;

  if (payload.kind === 'new') {
    // Адрес выдаётся всему поддереву: у составного узла с палитры (визард, массив) детей может
    // быть сколько угодно, и безадресный ребёнок сорвал бы уже следующую правку.
    const node = reissueNodeIds(payload.node, newId);
    const addedId = nodeIdOf(node);
    if (addedId === undefined) return null;
    return batchOp([
      insertOp(node, { parent: parentId, slot: 'children', index: at, keepIds: true }),
      groupOp(pairOf(addedId, spot.target, side), { className }),
    ]);
  }

  const source = index.find(payload.id);
  if (source === undefined) return null;
  // Узел не оборачивается ни с самим собой, ни со своим потомком или предком: обёртка обязана
  // содержать ДВА узла, а здесь второй исчез бы вместе с вырезанным поддеревом.
  if (isPrefix(source.path, target.path) || isPrefix(target.path, source.path)) return null;

  const flip = planFlipPair(schema, source.path, place.parentPath, parentId, payload.id, side);
  if (flip !== undefined) return flip;

  const move = moveOp(payload.id, { parent: parentId, slot: 'children', index: at });
  const collapsing = wrapperLeftBehind(schema, index, source.path, place.parentPath);
  const group = groupOp(pairOf(payload.id, spot.target, side), { className });
  return batchOp(collapsing === null ? [move, group] : [move, unwrapOp(collapsing), group]);
}

/** Пара для группировки в порядке будущих колонок: брошенное слева или справа от цели. */
function pairOf(dropped: NodeId, target: NodeId, side: Side): readonly NodeId[] {
  return side === 'before' ? [dropped, target] : [target, dropped];
}

/**
 * Переворот обёртки вместо новой обёртки — или `undefined`, если случай не тот.
 *
 * `undefined`, а не `null`: `null` в этом модуле означает «бросать нельзя», а здесь ответ —
 * «это не мой случай, планируй как обычно». Спутать их значило бы запретить нормальный бросок.
 */
function planFlipPair(
  schema: JsonFormSchema,
  sourcePath: JsonPath,
  parentPath: JsonPath,
  parentId: NodeId,
  dragged: NodeId,
  side: Side
): EditOp | undefined {
  const from = slotPositionOf(sourcePath);
  if (from === null || !pathEquals(from.parentPath, parentPath)) return undefined;

  const parent = getAt(schema, parentPath);
  if (!isNodeLike(parent) || !isFlexWrapper(parent as JsonNode)) return undefined;
  const kids = (parent as { children?: readonly unknown[] }).children;
  if (!Array.isArray(kids) || kids.length !== 2) return undefined;

  const flip = flipOp(parentId);
  // Колонок ровно две, поэтому нужная позиция груза выражается числом: слева — нулевая,
  // справа — первая. Совпала — переворота достаточно, и лишний move только занял бы
  // место в журнале, ничего не изменив.
  const desired = side === 'before' ? 0 : 1;
  if (from.index === desired) return flip;
  return batchOp([flip, moveOp(dragged, { parent: parentId, slot: 'children', index: desired })]);
}

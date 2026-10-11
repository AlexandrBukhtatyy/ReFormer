/**
 * Перемещение узла клавишами: во что превращается стрелка с модификатором.
 *
 * Модуль чистый и не знает ни про DOM, ни про клавиши: сюда приходит НАПРАВЛЕНИЕ, а какое
 * сочетание его дало — дело команды. Ровно та же граница, что у перетаскивания
 * ({@link './drag'}): правила над моделью проверяются без браузера.
 *
 * ## Стрелка означает разное в столбце и в ряду
 *
 * Направление проецируется на ось раскладки РОДИТЕЛЯ ({@link navIntentAt}): в столбце «вниз» —
 * это следующий сосед, а «вправо» — вложить; в ряду наоборот. Без проекции перемещение
 * в горизонтальном контейнере работало бы стрелками вверх-вниз, то есть поперёк того,
 * что человек видит.
 *
 * ## Реордер делается перемещением СОСЕДА, а не блока
 *
 * Сдвинуть выделение на позицию вперёд — то же самое, что перенести соседа за него.
 * Для блока из N узлов это одна операция вместо N: `[A,B,C,D]`, блок `B,C` вниз — переносим
 * `D` на место `B`. Обратимость при этом остаётся точной, а история — одним шагом.
 *
 * Выделение после такой правки НЕ переезжает: `focus` операции назовёт перенесённого соседа,
 * а работают над блоком. Возвращать курсор обязан вызывающий — он же знает, что было выделено.
 *
 * ## Поперёк оси работает только одиночное выделение
 *
 * Так было и в первой версии, и причина не в лени: «вынести наружу» для блока означает
 * вынести каждый узел, а это уже не перемещение, а разгруппировка — у неё своя команда.
 *
 * @module plugins/reformer/editor/editing/move
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { canAcceptChildren, childSlots, isNodeLike } from '../../../core/form-model';
import { getAt, type JsonPath } from '../../../core/form-model';
import { navIntentAt, type NavDir } from '../../../core/form-model';
import { indexNodes, type NodeIndex } from '../model/node-index';
import { blockOf, blockSlotPath, type Block } from '../model/block';
import { arraySlotOf, moveOp, slotPositionOf } from '../model/ops';
import type { EditOp, NodeId } from '../host';

/**
 * Операция, которой станет нажатие, — или `null`, если двигать некуда.
 *
 * `null` здесь так же нормален, как у планировщика броска: узел у края слота, выделение
 * разрознено, соседа-контейнера нет. Команда по нему просто ничего не делает.
 */
export function planMove(
  schema: JsonFormSchema,
  selection: readonly NodeId[],
  dir: NavDir
): EditOp | null {
  const index = indexNodes(schema);
  const block = blockOf(schema, index, selection);
  if (block === null) return null;

  const firstPath: JsonPath = [...blockSlotPath(block), block.start];
  const intent = navIntentAt(schema, firstPath, dir);

  if (intent === 'prev' || intent === 'next') {
    return reorder(schema, index, block, intent);
  }
  // Поперёк оси — только одиночный узел: см. шапку модуля.
  if (block.count !== 1) return null;
  const target = index.idAt(firstPath);
  if (target === undefined) return null;
  return intent === 'out'
    ? moveOut(schema, index, block, target)
    : moveIn(schema, index, block, target);
}

/**
 * Сдвиг блока на позицию вдоль оси — переносом соседа через блок.
 *
 * Позиция вставки называется в координатах ДО выреза (так устроена операция `move`),
 * поэтому вперёд и назад считаются по-разному: при переносе вправо компенсация вычитает
 * единицу, при переносе влево — нет.
 */
function reorder(
  schema: JsonFormSchema,
  index: NodeIndex,
  block: Block,
  intent: 'prev' | 'next'
): EditOp | null {
  const neighbourIndex = intent === 'prev' ? block.start - 1 : block.start + block.count;
  if (neighbourIndex < 0) return null;

  const slotPath = blockSlotPath(block);
  const list = getAt(schema, slotPath);
  if (!Array.isArray(list) || neighbourIndex >= list.length) return null;

  const neighbour = index.idAt([...slotPath, neighbourIndex]);
  // Не узел, а текстовая часть `children` либо ссылка на файл шага: адреса у них нет, и
  // переставить их нечем.
  if (neighbour === undefined) return null;

  const at = intent === 'prev' ? block.start + block.count : block.start;
  return moveOp(neighbour, { parent: block.parentId, slot: block.slot, index: at });
}

/** Вынести узел из родителя: он встаёт сразу после него, среди его соседей. */
function moveOut(
  schema: JsonFormSchema,
  index: NodeIndex,
  block: Block,
  target: NodeId
): EditOp | null {
  const parentPlace = slotPositionOf(schema, block.parentPath);
  // Родитель в одиночном слоте (шаблон элемента) или корень — выносить некуда.
  if (parentPlace === null) return null;
  const grandParent = index.idAt(parentPlace.parentPath);
  if (grandParent === undefined) return null;
  return moveOp(target, {
    parent: grandParent,
    slot: parentPlace.slot,
    index: parentPlace.index + 1,
  });
}

/** Вложить узел в предыдущего соседа-контейнер — последним ребёнком. */
function moveIn(
  schema: JsonFormSchema,
  index: NodeIndex,
  block: Block,
  target: NodeId
): EditOp | null {
  if (block.start === 0) return null;
  const prevPath: JsonPath = [...blockSlotPath(block), block.start - 1];
  const prev = getAt(schema, prevPath);
  if (!isNodeLike(prev) || !canAcceptChildren(prev as JsonNode)) return null;

  const host = index.idAt(prevPath);
  if (host === undefined) return null;
  // Массив-слот соседа в том виде, каким его отдаёт домен: у визарда это слот шагов (он есть
  // и без ключа `children`), у контейнера — дети. Массив без массив-слота (у него только шаблон
  // элемента) и контейнер без `children` вложение стрелкой не принимают.
  const slot = childSlots(prev as JsonNode, prevPath).find((entry) => !entry.single);
  if (slot === undefined) return null;
  // Вид слота называет сам сосед — то же правило, что у броска и у щелчка по палитре.
  return moveOp(target, { parent: host, slot: arraySlotOf(prev), index: slot.length });
}

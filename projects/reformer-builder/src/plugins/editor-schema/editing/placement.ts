/**
 * Куда встанет узел, добавленный из палитры.
 *
 * Правило одно и читается вслух: **в выделенный контейнер — внутрь, к выделенному полю —
 * следом.** Оно отвечает на ожидание человека, который сначала выбрал место, а потом ткнул
 * в палитру, и снимает необходимость перетаскивать очевидное.
 *
 * Функция чистая и живёт отдельно от палитры, потому что тем же правилом пользуются команда
 * добавления, будущий дроп и ход ассистента. Три реализации «куда вставить» разошлись бы
 * ровно там, где это заметнее всего, — на визарде, у которого детей два вида.
 *
 * @module plugins/editor-schema/editing/placement
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { canAcceptChildren, childSlots } from '@/lib/form-model/node-kind';
import { getAt } from '@/lib/form-model/paths';
import { indexNodes } from '../model/node-index';
import { slotPositionOf, type ArraySlot } from '../model/ops';
import type { NodeId } from '../host';

/** Адрес вставки: родитель, слот и позиция (отсутствие позиции означает «в конец»). */
export interface Placement {
  /** Родитель; `undefined` — корень схемы. */
  readonly parent?: NodeId;
  readonly slot: ArraySlot;
  readonly index?: number;
}

/** Вставка в конец корня — ответ, когда выделения нет или оно ведёт в никуда. */
const AT_ROOT: Placement = Object.freeze({ slot: 'children' });

/**
 * Место вставки по текущему выделению.
 *
 * Множественное выделение решается первым узлом: вставка — операция об одном месте, и брать
 * «последний» значило бы, что порядок щелчков меняет результат неочевидным образом.
 */
export function placementFor(schema: JsonFormSchema, selection: readonly NodeId[]): Placement {
  const target = selection[0];
  if (target === undefined) return AT_ROOT;

  const index = indexNodes(schema);
  const entry = index.find(target);
  if (!entry) return AT_ROOT;

  // Контейнер, визард, массив — внутрь, последним ребёнком.
  if (canAcceptChildren(entry.node)) {
    return { parent: target, slot: slotKindOf(entry.node, entry.path) };
  }

  // Лист или поле — следующим соседом. Одиночный слот (шаблон элемента, обёртка поля)
  // соседей не имеет: тогда поднимаемся к родителю и кладём в его конец.
  const position = slotPositionOf(entry.path);
  if (position) {
    const parent = index.idAt(position.parentPath);
    if (parent !== undefined) {
      return { parent, slot: position.slot, index: position.index + 1 };
    }
    return AT_ROOT;
  }

  const parentPath = entry.path.slice(0, -1);
  const parentNode = getAt(schema, parentPath);
  const parentId = index.idAt(parentPath);
  if (
    parentId !== undefined &&
    parentNode !== undefined &&
    canAcceptChildren(parentNode as JsonNode)
  ) {
    return { parent: parentId, slot: 'children' };
  }
  return AT_ROOT;
}

/**
 * Слот контейнера, принимающий вставку.
 *
 * У визарда детей два вида, и `children` он не рендерит вовсе — узел, положенный туда,
 * исчезает с экрана, не исчезнув из файла. Поэтому слот шагов, если он есть, выигрывает.
 */
function slotKindOf(node: JsonNode, path: readonly (string | number)[]): ArraySlot {
  return childSlots(node, path).some((slot) => slot.kind === 'steps') ? 'steps' : 'children';
}

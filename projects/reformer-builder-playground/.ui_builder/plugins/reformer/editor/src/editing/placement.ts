/**
 * Куда встанет узел, добавленный из палитры.
 *
 * Правило одно и читается вслух: **в выделенный контейнер — внутрь, к выделенному полю —
 * следом.** Оно отвечает на ожидание человека, который сначала выбрал место, а потом ткнул
 * в палитру, и снимает необходимость перетаскивать очевидное.
 *
 * Функция чистая и живёт отдельно от палитры, потому что тем же правилом пользуются команда
 * добавления, будущий дроп и ход ассистента. Три реализации «куда вставить» разошлись бы
 * ровно там, где это заметнее всего, — на визарде, у которого `children` — это шаги.
 *
 * ## Слот называет родитель
 *
 * И дети контейнера, и шаги визарда лежат в `children`, поэтому вид слота берётся у узла,
 * в который кладут ({@link arraySlotOf}), а не выводится из места. Это касается и корня:
 * у формы-визарда «в конец корня» означает «последним шагом».
 *
 * @module plugins/reformer/editor/editing/placement
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { canAcceptChildren } from '../../../core/form-model';
import { getAt } from '../../../core/form-model';
import { indexNodes } from '../model/node-index';
import { arraySlotOf, slotPositionOf, type ArraySlot } from '../model/ops';
import type { NodeId } from '../host';

/** Адрес вставки: родитель, слот и позиция (отсутствие позиции означает «в конец»). */
export interface Placement {
  /** Родитель; `undefined` — корень схемы. */
  readonly parent?: NodeId;
  readonly slot: ArraySlot;
  readonly index?: number;
}

/**
 * Вставка в конец корня — ответ, когда выделения нет или оно ведёт в никуда.
 *
 * Слот — тот, что есть у корня: у визарда это шаги, у остальных — дети.
 */
function atRoot(schema: JsonFormSchema): Placement {
  return { slot: arraySlotOf(schema.root) };
}

/**
 * Место вставки по текущему выделению.
 *
 * Множественное выделение решается первым узлом: вставка — операция об одном месте, и брать
 * «последний» значило бы, что порядок щелчков меняет результат неочевидным образом.
 */
export function placementFor(schema: JsonFormSchema, selection: readonly NodeId[]): Placement {
  const target = selection[0];
  if (target === undefined) return atRoot(schema);

  const index = indexNodes(schema);
  const entry = index.find(target);
  if (!entry) return atRoot(schema);

  // Контейнер, визард, массив — внутрь, последним ребёнком (в визард — последним шагом).
  if (canAcceptChildren(entry.node)) {
    return { parent: target, slot: arraySlotOf(entry.node) };
  }

  // Лист или поле — следующим соседом. Одиночный слот (шаблон элемента, обёртка поля)
  // соседей не имеет: тогда поднимаемся к родителю и кладём в его конец.
  const position = slotPositionOf(schema, entry.path);
  if (position) {
    const parent = index.idAt(position.parentPath);
    if (parent !== undefined) {
      return { parent, slot: position.slot, index: position.index + 1 };
    }
    return atRoot(schema);
  }

  const parentPath = entry.path.slice(0, -1);
  const parentNode = getAt(schema, parentPath);
  const parentId = index.idAt(parentPath);
  if (
    parentId !== undefined &&
    parentNode !== undefined &&
    canAcceptChildren(parentNode as JsonNode)
  ) {
    return { parent: parentId, slot: arraySlotOf(parentNode) };
  }
  return atRoot(schema);
}

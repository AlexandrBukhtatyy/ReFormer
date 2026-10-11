/**
 * Выбор слота для вставки — та же политика, что у ручной вставки в редакторе.
 *
 * Агент адресует РОДИТЕЛЯ («вставь поле в этот шаг»), а не массив-слот: что `children` визарда —
 * слот шагов, а `children` секции — обычные дети, он знать не должен — это внутреннее правило
 * размещения ReFormer. Правило выбора то же, что у ручной вставки: первый не-одиночный слот в
 * порядке `childSlots`, иначе синтезировать `children` — `insertNode` создаёт отсутствующий массив
 * сам. В v1 оно было записано дважды: здесь и приватным `insertSlotOf` в редьюсерах стора. В v2
 * второй копии пока нет — когда появится редактор схемы, правило обязано приехать сюда, а не
 * размножиться снова.
 *
 * @module plugins/reformer/ai/model/slots
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import {
  canAcceptChildren,
  childSlots,
  getAt,
  isNodeLike,
  pathEquals,
  type ChildSlotKind,
  type JsonPath,
} from '../../../core/form-model';

/** Куда встанет ребёнок: путь массива-слота и его вид. */
export interface InsertSlot {
  path: JsonPath;
  /** Вид слота — по нему инструменты решают, что сюда класть можно (шаги ≠ поля). */
  kind: ChildSlotKind;
}

/**
 * Слот, куда вставлять детей узла, либо `null`, если узел детей не принимает.
 *
 * Вид слота возвращается вместе с путём не для красоты: «положить поле в мастер» и «положить поле
 * в секцию» отличаются только им, а без этой развилки поле молча становилось шагом. По пути их
 * не различить: и шаги, и обычные дети лежат в `children`.
 *
 * @param node - Узел-родитель.
 * @param path - Абсолютный путь родителя.
 */
export function insertSlotOf(node: JsonNode, path: JsonPath): InsertSlot | null {
  if (!canAcceptChildren(node)) return null;
  const slots = childSlots(node, path);
  const plural = slots.find((s) => !s.single);
  if (plural) return { path: plural.path, kind: plural.kind };
  // Массив (`item.$template`) — единственный слот одиночный, вставлять «ещё одного ребёнка» некуда.
  if (slots.some((s) => s.single)) return null;
  return { path: [...path, 'children'], kind: 'children' };
}

/**
 * Вид массива-слота по его пути, либо `undefined`, если по пути слота нет.
 *
 * Нужен там, где слот получен не от родителя, а от самого узла (`siblingInfo`): хвост пути у
 * слота шагов и у слота детей один — `children`, и что в слоте лежит, знает только узел-держатель.
 *
 * @param schema - Схема, в которой лежит слот.
 * @param slotPath - Путь массива-слота (`[...путь держателя, 'children']`).
 */
export function slotKindAt(schema: JsonFormSchema, slotPath: JsonPath): ChildSlotKind | undefined {
  const holderPath = slotPath.slice(0, -1);
  const holder = getAt(schema, holderPath);
  if (!isNodeLike(holder)) return undefined;
  return childSlots(holder, holderPath).find((s) => pathEquals(s.path, slotPath))?.kind;
}

/** Текущая длина массива-слота (позиция вставки «в конец»). */
export function slotLength(node: JsonNode, path: JsonPath, slotPath: JsonPath): number {
  const slot = childSlots(node, path).find((s) => s.path.join('/') === slotPath.join('/'));
  return slot?.length ?? 0;
}

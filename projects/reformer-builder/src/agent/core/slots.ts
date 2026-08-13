/**
 * Выбор слота для вставки — та же политика, что у ручной вставки в редакторе.
 *
 * Агент адресует РОДИТЕЛЯ («вставь поле в этот шаг»), а не массив-слот: про `children` против
 * `componentProps.steps` он знать не должен — это внутреннее правило размещения ReFormer.
 * Правило выбора повторяет `insertSlotOf` из `store/reducers` (там оно приватное): предпочесть
 * `children`, иначе первый не-одиночный слот, иначе синтезировать `children` — `insertNode`
 * создаёт отсутствующий массив сам.
 *
 * @module reformer-builder/agent/core/slots
 */

import type { JsonNode } from '@reformer/renderer-json';
import { canAcceptChildren, childSlots, type JsonPath } from '../../model';

/**
 * Путь массива-слота, куда вставлять детей узла, либо `null`, если узел детей не принимает.
 *
 * @param node - Узел-родитель.
 * @param path - Абсолютный путь родителя.
 */
export function insertSlotOf(node: JsonNode, path: JsonPath): JsonPath | null {
  if (!canAcceptChildren(node)) return null;
  const slots = childSlots(node, path);
  const children = slots.find((s) => s.kind === 'children');
  if (children) return children.path;
  const plural = slots.find((s) => !s.single);
  if (plural) return plural.path;
  // Массив (`item.$template`) — единственный слот одиночный, вставлять «ещё одного ребёнка» некуда.
  if (slots.some((s) => s.single)) return null;
  return [...path, 'children'];
}

/** Текущая длина массива-слота (позиция вставки «в конец»). */
export function slotLength(node: JsonNode, path: JsonPath, slotPath: JsonPath): number {
  const slot = childSlots(node, path).find((s) => s.path.join('/') === slotPath.join('/'));
  return slot?.length ?? 0;
}

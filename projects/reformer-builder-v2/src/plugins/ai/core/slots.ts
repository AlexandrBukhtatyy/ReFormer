/**
 * Выбор слота для вставки — та же политика, что у ручной вставки в редакторе.
 *
 * Агент адресует РОДИТЕЛЯ («вставь поле в этот шаг»), а не массив-слот: про `children` против
 * `componentProps.steps` он знать не должен — это внутреннее правило размещения ReFormer.
 * Правило выбора то же, что у ручной вставки: первый не-одиночный слот в порядке `childSlots`,
 * иначе синтезировать `children` — `insertNode` создаёт отсутствующий массив сам. В v1 оно было
 * записано дважды: здесь и приватным `insertSlotOf` в редьюсерах стора. В v2 второй копии пока
 * нет — когда появится редактор схемы, правило обязано приехать сюда, а не размножиться снова.
 *
 * @module plugins/ai/core/slots
 */

import type { JsonNode } from '@reformer/renderer-json';
import { canAcceptChildren, childSlots, type ChildSlotKind } from '@/lib/form-model/node-kind';
import { type JsonPath } from '@/lib/form-model/paths';

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
 * в секцию» отличаются только им, а без этой развилки поле молча становилось шагом.
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

/** Текущая длина массива-слота (позиция вставки «в конец»). */
export function slotLength(node: JsonNode, path: JsonPath, slotPath: JsonPath): number {
  const slot = childSlots(node, path).find((s) => s.path.join('/') === slotPath.join('/'));
  return slot?.length ?? 0;
}

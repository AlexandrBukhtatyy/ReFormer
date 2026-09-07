/**
 * Выделение как непрерывный блок соседей — то, над чем работают клавиши.
 *
 * Общее место для перемещения ({@link '../editing/move'}) и дублирования ({@link '../editing/duplicate'}):
 * оба задают выделению один и тот же вопрос — «это подряд идущие соседи одного слота?» —
 * и оба обязаны отвечать на него одинаково. Две копии правила разошлись бы на первом же
 * углу (текстовая часть между узлами, шаги визарда, шаблон элемента), и тогда одна клавиша
 * считала бы выделение блоком, а соседняя — нет.
 *
 * @module plugins/editor-schema/model/block
 */

import type { JsonPath } from '@/lib/form-model/paths';
import type { NodeIndex } from './node-index';
import { slotPositionOf, type ArraySlot } from './ops';
import type { NodeId } from '../host';

/** Непрерывный блок соседей в одном слоте. */
export interface Block {
  readonly parentPath: JsonPath;
  readonly parentId: NodeId;
  readonly slot: ArraySlot;
  readonly start: number;
  readonly count: number;
}

/**
 * Путь до массив-слота от пути родителя.
 *
 * `steps` лежит в `componentProps`, `children` — прямо на узле. Различие предметное, поэтому
 * и живёт рядом с блоком, а не в каждом планировщике заново.
 */
export function slotSegments(slot: ArraySlot): readonly (string | number)[] {
  return slot === 'steps' ? ['componentProps', 'steps'] : ['children'];
}

/**
 * Выделение как блок — или `null`.
 *
 * `null` во всех случаях, когда «сдвинуть на позицию» не определено: пустое выделение, узлы
 * из разных слотов, разрыв между ними, узел вне массив-слота. Одна стрелка означала бы тогда
 * несколько разных правок сразу, а какую человек имел в виду — неизвестно.
 */
export function blockOf(index: NodeIndex, selection: readonly NodeId[]): Block | null {
  if (selection.length === 0) return null;

  const places = selection.map((id) => {
    const entry = index.find(id);
    return entry === undefined ? null : slotPositionOf(entry.path);
  });
  const first = places[0];
  if (first === null || first === undefined) return null;
  if (places.some((place) => place === null)) return null;

  const sameSlot = places.every(
    (place) =>
      place !== null && place.slot === first.slot && samePath(place.parentPath, first.parentPath)
  );
  if (!sameSlot) return null;

  const indices = places.map((place) => (place as { index: number }).index).sort((a, b) => a - b);
  const start = indices[0];
  const count = indices[indices.length - 1] - start + 1;
  // Разрыв означает, что между выбранными лежит что-то ещё — невыбранный сосед или текстовая
  // часть. Захватить его молча значило бы работать не с тем, что выделено.
  if (count !== indices.length) return null;

  const parentId = index.idAt(first.parentPath);
  if (parentId === undefined) return null;
  return { parentPath: first.parentPath, parentId, slot: first.slot, start, count };
}

function samePath(a: JsonPath, b: JsonPath): boolean {
  return a.length === b.length && a.every((segment, i) => String(segment) === String(b[i]));
}

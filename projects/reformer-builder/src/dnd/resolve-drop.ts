/**
 * Резолв дропа: по цели (путь узла) и зоне (`before`/`after`/`into`) вычислить слот-путь + индекс
 * вставки, затем построить мутацию (`insertNode` для нового узла из палитры, `moveNode` для
 * перемещения). Чистые функции — тестируются без React. Инвариант: узел нельзя бросить в самого
 * себя/потомка (`isPrefix`).
 *
 * @module reformer-builder/dnd/resolve-drop
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import {
  childSlots,
  findByPath,
  insertNode,
  isPrefix,
  moveNode,
  type JsonPath,
  type MutationResult,
} from '../model';
import { getCatalogEntry } from '../catalog';
import type { DragPayload } from './drag-state';

/** Зона дропа относительно целевого узла. */
export type DropZone = 'before' | 'after' | 'into';

/** Слот + индекс для вставки, либо `null` если дроп в эту точку невозможен. */
export function resolveDrop(
  schema: JsonFormSchema,
  targetPath: JsonPath,
  zone: DropZone
): { slotPath: JsonPath; index: number } | null {
  const node = findByPath(schema, targetPath);
  if (!node) return null;

  if (zone === 'into') {
    const slots = childSlots(node, targetPath).filter((s) => !s.single);
    const slot = slots.find((s) => s.kind === 'children') ?? slots[0];
    if (!slot) return null;
    return { slotPath: slot.path, index: slot.nodes.length };
  }

  // before/after — как сосед в родительском слоте
  if (targetPath.length === 0) return null;
  const last = targetPath[targetPath.length - 1];
  const idx = typeof last === 'number' ? last : Number(last);
  if (Number.isNaN(idx)) return null; // цель не в массиве-слоте (напр. корень или одиночный template)
  return { slotPath: targetPath.slice(0, -1), index: zone === 'before' ? idx : idx + 1 };
}

/** Построить мутацию из дропа, либо `null` (недопустимый дроп). */
export function performDrop(
  schema: JsonFormSchema,
  targetPath: JsonPath,
  zone: DropZone,
  payload: DragPayload
): MutationResult | null {
  const target = resolveDrop(schema, targetPath, zone);
  if (!target) return null;

  if (payload.kind === 'new') {
    const entry = getCatalogEntry(payload.entryName);
    if (!entry) return null;
    return insertNode(schema, target.slotPath, target.index, entry.makeNode());
  }

  // move: нельзя в самого себя/потомка
  if (isPrefix(payload.path, targetPath)) return null;
  return moveNode(schema, payload.path, target.slotPath, target.index);
}

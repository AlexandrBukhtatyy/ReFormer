/**
 * Цель дропа в runtime-превью: точка курсора → узел схемы + зона вставки. Склейка хит-теста
 * ({@link nodeAtElement}) и общей геометрии зон ({@link computeZone}) — той же, что у схематичного
 * canvas, поэтому дроп в обоих холстах даёт одинаковый результат.
 *
 * @module reformer-builder/canvas/preview-dnd
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { getAt, orientationOf, parentNodePath, type JsonPath } from '../model';
import { computeZone, type Rect } from '../dnd/compute-zone';
import type { DropZone } from '../dnd/resolve-drop';
import { nodeAtElement } from './preview-hit-test';

/** Разрешённая цель дропа: узел, зона и геометрия его DOM-элемента (координаты вьюпорта). */
export interface DropTargetInfo {
  path: JsonPath;
  zone: DropZone;
  rect: Rect;
  /** Ось раскладки родителя — от неё зависит, у какого края рисовать линию вставки. */
  horizontalParent: boolean;
}

/** Цель дропа под точкой `(x, y)`; `null`, если под курсором нет помеченного узла. */
export function resolveDropTarget(
  schema: JsonFormSchema,
  target: Element | null,
  x: number,
  y: number
): DropTargetInfo | null {
  const hit = nodeAtElement(target, schema);
  if (!hit) return null;

  const isRoot = hit.path.length === 1 && hit.path[0] === 'root';
  const parentPath = parentNodePath(hit.path);
  const parentNode = parentPath ? (getAt(schema, parentPath) as JsonNode | undefined) : undefined;
  const parentOrientation = parentNode ? orientationOf(parentNode) : 'vertical';
  // Перпендикулярная обёртка (новый ряд/столбец) — только для узлов в слоте `children`,
  // как и в схематике.
  const allowPerp = !isRoot && hit.path[hit.path.length - 2] === 'children';

  const rect = hit.element.getBoundingClientRect();
  const zone = computeZone({ x, y }, rect, hit.node, parentOrientation, allowPerp);
  return { path: hit.path, zone, rect, horizontalParent: parentOrientation === 'horizontal' };
}

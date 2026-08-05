/**
 * Геометрия зон дропа — общая для схематичного canvas и runtime-превью (чистые функции от
 * прямоугольника и точки, без DOM/React, поэтому тестируются в node-окружении).
 *
 * Главная ось = ось раскладки РОДИТЕЛЯ цели: вдоль неё — `before`/`into`/`after`; поперёк, у краёв
 * (только когда `allowPerp`) — обёртка цели и брошенного в новый `$html(div)`: в вертикальном
 * родителе `beside-*` (горизонтальный ряд), в горизонтальном `stack-*` (вертикальный столбец).
 *
 * @module reformer-builder/dnd/compute-zone
 */

import type { JsonNode } from '@reformer/renderer-json';
import { canAcceptChildren, type Orientation } from '../model';
import type { DropZone } from './resolve-drop';

/** Зоны, создающие перпендикулярную обёртку (ряд/столбец) вместо вставки в слот. */
export const PERP_ZONES = new Set<DropZone>([
  'beside-before',
  'beside-after',
  'stack-before',
  'stack-after',
]);

/** Точка курсора в координатах вьюпорта. */
export interface Point {
  x: number;
  y: number;
}

/** Прямоугольник цели в координатах вьюпорта (совместим с `DOMRect`). */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Край, у которого рисуется линия-индикатор; `null` — зона `into` (подсветка бокса). */
export type ZoneEdge = 'top' | 'bottom' | 'left' | 'right' | null;

/** Доля вдоль стороны (0..1); вырожденная сторона (нулевой размер) — считаем серединой. */
function ratio(pos: number, start: number, size: number): number {
  return size > 0 ? (pos - start) / size : 0.5;
}

/**
 * Зона по позиции курсора внутри прямоугольника цели.
 *
 * @param allowPerp - разрешены ли перпендикулярные (обёрточные) зоны — узел лежит в слоте `children`.
 */
export function computeZone(
  point: Point,
  rect: Rect,
  node: JsonNode,
  parentOrientation: Orientation,
  allowPerp: boolean
): DropZone {
  const rx = ratio(point.x, rect.left, rect.width);
  const ry = ratio(point.y, rect.top, rect.height);
  const horizontalParent = parentOrientation === 'horizontal';
  const main = horizontalParent ? rx : ry;
  const cross = horizontalParent ? ry : rx;

  if (allowPerp) {
    if (cross < 0.25) return horizontalParent ? 'stack-before' : 'beside-before';
    if (cross > 0.75) return horizontalParent ? 'stack-after' : 'beside-after';
  }

  if (canAcceptChildren(node)) {
    if (main < 0.28) return 'before';
    if (main > 0.72) return 'after';
    return 'into';
  }
  return main < 0.5 ? 'before' : 'after';
}

/** Край прямоугольника цели, у которого рисуется линия вставки (зависит от зоны и оси родителя). */
export function zoneEdge(zone: DropZone, horizontalParent: boolean): ZoneEdge {
  switch (zone) {
    case 'before':
      return horizontalParent ? 'left' : 'top';
    case 'after':
      return horizontalParent ? 'right' : 'bottom';
    case 'beside-before':
      return 'left';
    case 'beside-after':
      return 'right';
    case 'stack-before':
      return 'top';
    case 'stack-after':
      return 'bottom';
    default:
      return null; // into — подсветка бокса, не линия
  }
}

/**
 * Полезная нагрузка текущего drag'а. HTML5 DnD не даёт читать `dataTransfer` во время `dragover`
 * (только на `drop`), поэтому храним payload в модуле — общий паттерн. Источники: элемент палитры
 * (новый узел) и узел canvas (перемещение).
 *
 * @module reformer-builder/dnd/drag-state
 */

import type { JsonPath } from '../model';

/** Что перетаскивается: новый компонент из палитры или существующий узел (перемещение). */
export type DragPayload =
  | { kind: 'new'; entryName: string }
  | { kind: 'move'; path: JsonPath };

let current: DragPayload | null = null;

export function setDrag(payload: DragPayload): void {
  current = payload;
}

export function getDrag(): DragPayload | null {
  return current;
}

export function clearDrag(): void {
  current = null;
}

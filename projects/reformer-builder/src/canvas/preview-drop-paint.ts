/**
 * Отрисовка индикатора дропа на слое {@link PreviewOverlay} — императивная: `dragover` летит
 * десятками событий в секунду, и ре-рендер React на каждое перерисовывал бы форму.
 *
 * @module reformer-builder/canvas/preview-drop-paint
 */

import { PERP_ZONES, zoneEdge } from '../dnd/compute-zone';
import type { DropTargetInfo } from './preview-dnd';

/** Толщина линии вставки, px. */
const LINE = 3;

/**
 * Нарисовать индикатор цели (или скрыть, если `target === null`).
 *
 * @param overlay - корневой элемент слоя.
 * @param host - хост превью: его прямоугольник задаёт систему координат слоя.
 */
export function paintDrop(
  overlay: HTMLDivElement | null,
  host: HTMLElement | null,
  target: DropTargetInfo | null
): void {
  if (!overlay || !host) return;
  const box = overlay.querySelector<HTMLElement>('[data-part="box"]');
  const chip = overlay.querySelector<HTMLElement>('[data-part="chip"]');
  if (!box || !chip) return;

  if (!target) {
    overlay.classList.add('hidden');
    box.style.display = 'none';
    chip.style.display = 'none';
    return;
  }

  const hostRect = host.getBoundingClientRect();
  const left = target.rect.left - hostRect.left;
  const top = target.rect.top - hostRect.top;
  const { width, height } = target.rect;

  overlay.classList.remove('hidden');
  box.style.display = 'block';

  const edge = zoneEdge(target.zone, target.horizontalParent);
  if (edge === null) {
    // into — рамка по контуру цели (лёгкая заливка + обводка).
    Object.assign(box.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      background: 'color-mix(in oklab, var(--rb-select) 8%, transparent)',
      outline: '2px solid var(--rb-select)',
      outlineOffset: '-1px',
    });
  } else {
    const vertical = edge === 'top' || edge === 'bottom';
    Object.assign(box.style, {
      left: `${edge === 'right' ? left + width - LINE / 2 : left - (vertical ? 0 : LINE / 2)}px`,
      top: `${edge === 'bottom' ? top + height - LINE / 2 : top - (vertical ? LINE / 2 : 0)}px`,
      width: `${vertical ? width : LINE}px`,
      height: `${vertical ? LINE : height}px`,
      background: 'var(--rb-select)',
      outline: 'none',
    });
  }

  // Чип-подсказка — только для обёрточных зон (создаётся новый ряд/столбец).
  if (!PERP_ZONES.has(target.zone)) {
    chip.style.display = 'none';
    return;
  }
  const column = target.zone === 'stack-before' || target.zone === 'stack-after';
  chip.textContent = column ? '↓ столбец' : '→ ряд';
  chip.style.display = 'block';
  chip.style.transform = 'translate(-50%, -50%)';
  const cx = left + width / 2;
  const cy = top + height / 2;
  switch (target.zone) {
    case 'beside-before':
      Object.assign(chip.style, { left: `${left}px`, top: `${cy}px` });
      break;
    case 'beside-after':
      Object.assign(chip.style, { left: `${left + width}px`, top: `${cy}px` });
      break;
    case 'stack-before':
      Object.assign(chip.style, { left: `${cx}px`, top: `${top}px` });
      break;
    default:
      Object.assign(chip.style, { left: `${cx}px`, top: `${top + height}px` });
  }
}

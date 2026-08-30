/**
 * Геометрия живого вида: во что превращаются прямоугольники настоящей формы.
 *
 * Модуль чистый — ни DOM, ни модели, ни React: на вход прямоугольники, на выход числа.
 * Причина та же, по которой отдельно живёт {@link './schematic-zone'}: правило проверяется
 * перебором координат, а через события мыши его пришлось бы проверять браузером, где каждая
 * проверка на порядок дороже.
 *
 * ## Ось измеряется, а не объявляется
 *
 * Схематичный вид выводит ось из `className` ({@link '@/lib/form-model/node-kind'.orientationOf}),
 * и для нарисованных им коробок это верно по построению — он сам их так и раскладывает.
 * В живой форме раскладку делает браузер, и объявленная ось врёт везде, где класс сложнее
 * `flex-row`: у `grid` с брейкпоинтами, у переносящегося ряда, у абсолютного позиционирования.
 * Зато там есть то, чего нет у схематичного вида, — ФАКТИЧЕСКИЕ прямоугольники соседей.
 * По ним ось и определяется, а объявленная остаётся запасным ответом.
 *
 * @module plugins/editor-schema/live-zone
 */

import type { Orientation } from '@/lib/form-model/node-kind';
import type { Rect, SchematicZone } from './schematic-zone';
import { zoneEdge } from './schematic-zone';

/** Толщина линии вставки. Та же, что у схематичного вида: жест один и тот же. */
const LINE = 2;

/** Сторона квадратной ручки перетаскивания. */
export const GRIP_SIZE = 14;

/**
 * Ось по фактическим прямоугольникам соседей; `null` — судить не по чему.
 *
 * Правило простое и намеренно грубое: соседи считаются лежащими в ряд, если они
 * перекрываются по вертикали и разнесены по горизонтали. Голосуют все последовательные пары,
 * побеждает большинство — так переносящийся ряд (`flex-wrap`), где часть пар стоит друг
 * под другом, всё равно читается рядом.
 *
 * `null` возвращается в трёх случаях, и все три законные: соседей меньше двух, все
 * прямоугольники вырожденные (ветка скрыта) или голоса разделились поровну.
 */
export function orientationFromRects(rects: readonly Rect[]): Orientation | null {
  const usable = rects.filter((rect) => rect.width > 0 || rect.height > 0);
  if (usable.length < 2) return null;

  let horizontal = 0;
  let vertical = 0;
  for (let index = 1; index < usable.length; index += 1) {
    const a = usable[index - 1];
    const b = usable[index];
    if (a === undefined || b === undefined) continue;
    const side = pairSide(a, b);
    if (side === 'horizontal') horizontal += 1;
    else if (side === 'vertical') vertical += 1;
  }

  if (horizontal === vertical) return null;
  return horizontal > vertical ? 'horizontal' : 'vertical';
}

/** Как стоит пара соседей; `null` — не разобрать (наложились друг на друга). */
function pairSide(a: Rect, b: Rect): Orientation | null {
  const dx = Math.abs(center(a.left, a.width) - center(b.left, b.width));
  const dy = Math.abs(center(a.top, a.height) - center(b.top, b.height));
  if (dx === dy) return null;
  return dx > dy ? 'horizontal' : 'vertical';
}

function center(start: number, size: number): number {
  return start + size / 2;
}

/** Что нарисовать поверх формы, чтобы показать бросок. */
export interface Indicator {
  /** Рамка — «внутрь»; линия — «перед»/«после» у соответствующего края. */
  readonly shape: 'frame' | 'line';
  /** Прямоугольник В КООРДИНАТАХ ХОСТА: оверлей лежит в нём, а не в окне. */
  readonly box: Rect;
  /** Ось будущей обёртки; `null` — обёртки не будет. */
  readonly axis: 'row' | 'column' | null;
}

/**
 * Указатель броска.
 *
 * Координаты приводятся к системе хоста вычитанием его начала — и это не формальность:
 * форма прокручивается внутри своей области, оверлей прокручивается вместе с ней, а
 * `getBoundingClientRect` отвечает в координатах ОКНА. Считай мы в них, указатель уезжал бы
 * на величину прокрутки.
 */
export function indicatorFor(
  zone: SchematicZone,
  rect: Rect,
  host: Rect,
  horizontalParent: boolean
): Indicator {
  const local: Rect = {
    left: rect.left - host.left,
    top: rect.top - host.top,
    width: rect.width,
    height: rect.height,
  };
  const axis = axisOf(zone);
  const edge = zoneEdge(zone, horizontalParent);
  if (edge === null) return { shape: 'frame', box: local, axis };

  const box: Rect =
    edge === 'top'
      ? { ...local, height: LINE, top: local.top - LINE / 2 }
      : edge === 'bottom'
        ? { ...local, height: LINE, top: local.top + local.height - LINE / 2 }
        : edge === 'left'
          ? { ...local, width: LINE, left: local.left - LINE / 2 }
          : { ...local, width: LINE, left: local.left + local.width - LINE / 2 };
  return { shape: 'line', box, axis };
}

/** Ось будущей обёртки: только у зон, которые её и рождают. */
function axisOf(zone: SchematicZone): 'row' | 'column' | null {
  switch (zone) {
    case 'beside-before':
    case 'beside-after':
      return 'row';
    case 'stack-before':
    case 'stack-after':
      return 'column';
    default:
      return null;
  }
}

/**
 * Место ручки перетаскивания — в координатах хоста.
 *
 * Ручка стоит СНАРУЖИ у левого края узла, чтобы не закрывать содержимое поля. У узла,
 * прижатого к левому краю формы, места снаружи нет, и она уходит внутрь: ручка за пределами
 * видимой области была бы недостижима, а недостижимая ручка — это отсутствие перетаскивания.
 */
export function gripBox(rect: Rect, host: Rect, size: number = GRIP_SIZE): Rect {
  const left = rect.left - host.left;
  const top = rect.top - host.top;
  const outside = left - size;
  return {
    left: outside >= 0 ? outside : left,
    top,
    width: size,
    height: Math.min(size, rect.height > 0 ? rect.height : size),
  };
}

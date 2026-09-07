/**
 * Геометрия зон схематичного вида: во что превращается положение курсора над коробкой.
 *
 * Модуль чистый: ни DOM, ни модели, ни React — только точка, прямоугольник и два признака
 * о цели. Причина та же, по которой отдельно живёт {@link '../editing/drag'}: правило «куда метится
 * бросок» проверяется числами, а через события мыши его пришлось бы проверять браузером,
 * где каждая проверка стоит на порядок дороже и падает от смены раскладки.
 *
 * ## Главная ось — ось раскладки РОДИТЕЛЯ, а не своя
 *
 * Схематичный вид рисует форму так, как она встанет: дети вертикального контейнера идут
 * столбцом, дети горизонтального — рядом. Значит «перед» и «после» у соседей в ряду лежат
 * СЛЕВА и СПРАВА, а не сверху и снизу, и считать их по Y было бы враньём: человек ведёт
 * узел к левому краю соседа, а линия вставки появляется над ним.
 *
 * Отсюда всё остальное: главная ось берётся у родителя, поперечная — та, что осталась.
 *
 * ## Поперечные края создают обёртку, и в этом весь смысл схематичного вида
 *
 * Дерево строк даёт три положения ({@link '../editing/drag'}), потому что у строки нет левого края.
 * У коробки он есть, и бросок в него означает то, чего в дереве выразить нечем: «поставить
 * эти два узла рядом» — то есть обернуть цель и груз в новый `$html(div)`. В вертикальном
 * родителе поперечный край даёт РЯД (`beside-*`), в горизонтальном — СТОЛБЕЦ (`stack-*`),
 * и так строится двумерная раскладка одним перетаскиванием, без похода в команду
 * «Сгруппировать» и правку класса руками.
 *
 * Обёрточные зоны разрешены не везде: `allowPerp` спрашивают у того, кто знает про слот —
 * обернуть можно только узел, лежащий в массив-слоте среди соседей. Единственный шаг визарда
 * или шаблон элемента массива соседей не имеют, и «поставить рядом» там не значит ничего.
 *
 * ## Пороги: 28% вдоль оси и 25% поперёк
 *
 * Числа перенесены из первой версии билдера как есть, вместе с их асимметрией. Она не
 * случайна: поперечные края отдают четверть каждый, потому что мимо них легко промахнуться
 * ведя узел к соседу, а вдоль оси середина оставлена крупнее (44%), потому что «внутрь»
 * — самый частый бросок в контейнер, и он не должен требовать прицеливания.
 *
 * @module plugins/editor-schema/schematic/schematic-zone
 */

import type { Orientation } from '@/lib/form-model/node-kind';

/**
 * Куда метится бросок относительно коробки.
 *
 * Надмножество {@link DropPosition} дерева: первые три — те же самые (`into` там зовётся
 * `inside`), остальные четыре существуют только там, где у цели есть поперечные края.
 * Общего имени у них с деревом нет намеренно: совпади они, обёрточную зону однажды передали
 * бы планировщику дерева, а тот про обёртки не знает вовсе.
 */
export type SchematicZone =
  | 'before'
  | 'after'
  | 'into'
  | 'beside-before'
  | 'beside-after'
  | 'stack-before'
  | 'stack-after';

/** Зоны, которые рождают обёртку вместо вставки в существующий слот. */
export const PERP_ZONES: ReadonlySet<SchematicZone> = new Set<SchematicZone>([
  'beside-before',
  'beside-after',
  'stack-before',
  'stack-after',
]);

/** Точка курсора в координатах окна. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Прямоугольник коробки в координатах окна. Совместим с `DOMRect` по форме. */
export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Край, у которого рисуется линия вставки; `null` — зона `into`, её показывает рамка. */
export type ZoneEdge = 'top' | 'bottom' | 'left' | 'right' | null;

/** Что о цели надо знать, чтобы решить, какие зоны у неё вообще есть. */
export interface ZoneOptions {
  /** Принимает ли цель вложение. Считает не геометрия — см. `canDropInside` в `./drag`. */
  readonly acceptsInside: boolean;
  /** Ось раскладки РОДИТЕЛЯ цели: она же главная ось зон. */
  readonly parentOrientation: Orientation;
  /** Лежит ли цель среди соседей в массив-слоте — только там осмысленна обёртка. */
  readonly allowPerp: boolean;
}

/** Доля вдоль главной оси, отданная краям контейнера. Середина остаётся под `into`. */
const MAIN_EDGE = 0.28;

/** Доля поперёк, отданная обёрточным зонам. */
const CROSS_EDGE = 0.25;

/** Доля стороны; вырожденная сторона считается серединой — иначе деление на ноль. */
function ratio(pos: number, start: number, size: number): number {
  return size > 0 ? (pos - start) / size : 0.5;
}

/**
 * Зона по положению курсора внутри коробки.
 *
 * Порядок проверок важен и он же порядок приоритета: поперечные края СИЛЬНЕЕ главной оси.
 * Иначе угол коробки-контейнера всегда читался бы как `into`, и «поставить рядом» у контейнера
 * стало бы недостижимым — а именно контейнеры и ставят рядом чаще всего.
 */
export function zoneAt(point: Point, rect: Rect, options: ZoneOptions): SchematicZone {
  const { acceptsInside, parentOrientation, allowPerp } = options;
  const horizontalParent = parentOrientation === 'horizontal';
  const rx = ratio(point.x, rect.left, rect.width);
  const ry = ratio(point.y, rect.top, rect.height);
  const main = horizontalParent ? rx : ry;
  const cross = horizontalParent ? ry : rx;

  if (allowPerp) {
    if (cross < CROSS_EDGE) return horizontalParent ? 'stack-before' : 'beside-before';
    if (cross > 1 - CROSS_EDGE) return horizontalParent ? 'stack-after' : 'beside-after';
  }

  if (acceptsInside) {
    if (main < MAIN_EDGE) return 'before';
    if (main > 1 - MAIN_EDGE) return 'after';
    return 'into';
  }
  // У цели, которая внутрь не принимает, середина делится пополам: мёртвой зоны быть не должно.
  return main < 0.5 ? 'before' : 'after';
}

/**
 * Край коробки, у которого рисуется линия вставки.
 *
 * Обёрточные зоны отвечают своим краем независимо от оси родителя: они и определены
 * поперёк неё, поэтому `beside-*` — это всегда лево и право, а `stack-*` — верх и низ.
 */
export function zoneEdge(zone: SchematicZone, horizontalParent: boolean): ZoneEdge {
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
      return null;
  }
}

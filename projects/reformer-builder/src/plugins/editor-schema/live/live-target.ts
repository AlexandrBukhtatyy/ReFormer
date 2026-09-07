/**
 * Куда встанет бросок в живой форме: модель, геометрия и правило вместе.
 *
 * ## Своего правила здесь нет
 *
 * Зону считает {@link zoneAt} схематичного вида, операцию — {@link planSchematicDrop}, метаданные
 * цели («принимает ли внутрь», «есть ли соседи») берутся из его же дерева коробок. Это не
 * экономия: бросок в живой форме и бросок в схематичном виде ОБЯЗАНЫ давать одну и ту же
 * операцию, иначе два вида одного конструктора начнут спорить о том, что значит один и тот же
 * жест. Инвариант закреплён тестом.
 *
 * Своё здесь одно — ось раскладки: в живой форме её видно по-настоящему
 * ({@link orientationFromRects}), и измеренная побеждает объявленную.
 *
 * ## `rectOf` приходит параметром
 *
 * Модуль не читает DOM. Прямоугольники подставляет вызывающий, и поэтому всё — включая
 * `grid`, где объявленная ось врёт, — проверяется числами в обычном прогоне, без браузера.
 *
 * @module plugins/editor-schema/live/live-target
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { NodeId } from '@/sdk';
import type { DragPayload } from '../editing/drag';
import { orientationFromRects } from './live-zone';
import { planSchematicDrop, type SchematicSpot } from '../schematic/schematic-drop';
import { findBox, type SchematicBox, type SchematicItem } from '../schematic/schematic-tree';
import { zoneAt, type Point, type Rect } from '../schematic/schematic-zone';

/** Цель броска вместе с тем, что нужно, чтобы её нарисовать. */
export interface LiveTarget {
  readonly spot: SchematicSpot;
  /** Прямоугольник цели в координатах ОКНА — таким его отдаёт `getBoundingClientRect`. */
  readonly rect: Rect;
  /** Ось родителя: по ней указатель выбирает край. */
  readonly horizontalParent: boolean;
}

export interface LiveTargetDeps {
  readonly model: JsonFormSchema;
  /** Дерево коробок ТОЙ ЖЕ модели: источник `acceptsInside`, `canWrap` и запасной оси. */
  readonly tree: SchematicBox | null;
  /** Прямоугольник узла; `null` — узел сейчас не нарисован. */
  readonly rectOf: (id: NodeId) => Rect | null;
}

/** Узел под курсором: его адрес и его прямоугольник. */
export interface LiveHitRect {
  readonly id: NodeId;
  readonly rect: Rect;
}

/**
 * Куда встал бы бросок; `null` — сюда нельзя.
 *
 * Отказ возвращается ДО отпускания кнопки: указатель не рисуется, `dropEffect` становится
 * `none`, и запрет виден заранее. Тот же порядок, что в схематичном виде.
 */
export function targetAt(
  deps: LiveTargetDeps,
  hit: LiveHitRect,
  point: Point,
  payload: DragPayload
): LiveTarget | null {
  const box = findBox(deps.tree, hit.id);
  if (box === undefined) return null;

  const measured = orientationFromRects(
    siblingsOf(deps.tree, hit.id).flatMap((id) => {
      const rect = deps.rectOf(id);
      return rect === null ? [] : [rect];
    })
  );
  // Измеренная побеждает объявленную; объявленная остаётся там, где измерять нечего:
  // единственный ребёнок, скрытая ветка, шаг визарда.
  const parentOrientation = measured ?? box.parentOrientation;

  const zone = zoneAt(point, hit.rect, {
    acceptsInside: box.acceptsInside,
    parentOrientation,
    allowPerp: box.canWrap,
  });
  const spot: SchematicSpot = { target: hit.id, zone };
  if (planSchematicDrop(deps.model, payload, spot) === null) return null;
  return { spot, rect: hit.rect, horizontalParent: parentOrientation === 'horizontal' };
}

/**
 * Соседи узла по слоту — включая его самого: ось определяется по ряду целиком.
 *
 * Прозрачные группы раскрываются: у них нет адреса, но раскладку они несут, и их дети —
 * такие же соседи, как прямые.
 */
export function siblingsOf(tree: SchematicItem | null, id: NodeId): readonly NodeId[] {
  if (tree === null) return [];
  let found: readonly NodeId[] = [];

  const visit = (item: SchematicItem): void => {
    if (item.shape === 'group') {
      const ids = flatten(item.items);
      if (ids.includes(id)) found = ids;
      item.items.forEach(visit);
      return;
    }
    for (const slot of item.slots) {
      const ids = flatten(slot.items);
      if (ids.includes(id) && found.length === 0) found = ids;
      slot.items.forEach(visit);
    }
  };

  visit(tree);
  return found;
}

/** Адреса ряда: группы раскрываются, коробки отдают свой адрес. */
function flatten(items: readonly SchematicItem[]): readonly NodeId[] {
  const out: NodeId[] = [];
  for (const item of items) {
    if (item.shape === 'group') out.push(...flatten(item.items));
    else out.push(item.id);
  }
  return out;
}

/**
 * Развёртка модели в коробки схематичного вида: то, что рисует канвас-схема.
 *
 * Второй способ показать ту же модель, и потому отдельный модуль, а не флаг у
 * {@link flattenCanvas}. Разница не в оформлении: дерево строк развёртывается в ПЛОСКИЙ
 * список, где вложенность выражена числом-отступом, а здесь коробка вложена в коробку,
 * потому что она обязана повторять раскладку формы — столбец столбцом, ряд рядом. Одна
 * функция с флагом разошлась бы на первом же различии (свёрнутые ветки нужны там и не
 * нужны здесь; ось родителя нужна здесь и не нужна там).
 *
 * ## Коробка знает свою ось и ось родителя
 *
 * Своя нужна, чтобы разложить детей; родительская — чтобы посчитать зоны броска
 * ({@link './schematic-zone'}), у которых главная ось всегда родительская. Считать её
 * в отрисовке значило бы искать родителя вверх по дереву на каждое движение мыши.
 *
 * ## Скрытые обёртки: раскладка остаётся, коробка исчезает
 *
 * Схема, собранная перетаскиванием, обрастает `$html(div)`-обёртками, и при взгляде на
 * форму они шум: человек видит рамку вокруг рамки вокруг поля. Настройка «скрывать
 * обёртки» убирает РАМКУ, но не раскладку — иначе колонки схлопнулись бы в столбец
 * и вид перестал бы отвечать на вопрос «как это встанет».
 *
 * Отсюда {@link SchematicGroup}: прозрачный узел, у которого есть ось и дети, но нет ни
 * подписи, ни адреса. Выделить его нельзя — его и не видно; чтобы добраться до самой
 * обёртки, настройку выключают.
 *
 * @module plugins/editor-schema/schematic/schematic-tree
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { nodeIdOf } from '@/lib/form-model/node-id';
import {
  canAcceptChildren,
  childSlots,
  isDivContainer,
  kindOf,
  orientationOf,
  type ChildSlotKind,
  type NodeKind,
  type Orientation,
} from '@/lib/form-model/node-kind';
import { componentOf, modelOf } from '@/lib/form-model/node-ref';
import type { JsonPath } from '@/lib/form-model/paths';
import { nodeTitle } from '../canvas/canvas-tree';
import type { NodeId } from '../host';

/** Что стоит в слоте: коробка узла или прозрачная группа скрытой обёртки. */
export type SchematicItem = SchematicBox | SchematicGroup;

/**
 * Прозрачная группа — скрытая обёртка, от которой осталась одна раскладка.
 *
 * Ни адреса, ни подписи: показывать нечего, и выбрать её нельзя. Существует только
 * при включённой настройке скрытия — иначе на её месте обычная коробка.
 */
export interface SchematicGroup {
  readonly shape: 'group';
  readonly orientation: Orientation;
  readonly items: readonly SchematicItem[];
}

/** Один слот коробки: как рисовать его содержимое и что в нём лежит. */
export interface SchematicSlot {
  readonly kind: ChildSlotKind;
  /** Ось, вдоль которой рисуются записи слота. */
  readonly orientation: Orientation;
  readonly items: readonly SchematicItem[];
  /**
   * Слот пуст и потому принимает бросок «внутрь».
   *
   * Признак вместо проверки `items.length === 0` в отрисовке: слот, ВСЕ дети которого
   * оказались безадресными, тоже пуст на вид, но приглашения не заслуживает — бросок
   * туда встал бы между невидимых узлов.
   */
  readonly empty: boolean;
}

/** Коробка узла: всё, что о нём нужно знать при отрисовке и при броске. */
export interface SchematicBox {
  readonly shape: 'box';
  readonly id: NodeId;
  readonly path: JsonPath;
  readonly kind: NodeKind;
  /** Подпись для человека — та же, что в дереве строк. */
  readonly title: string;
  /** Каталожное имя (`Input`, `$html(div)`) или `null` у узла без компонента. */
  readonly component: string | null;
  /** Путь модели без обёртки `$model(...)`; у контейнера — `null`. */
  readonly binding: string | null;
  /** Слот, в котором коробка лежит у родителя; у корня — `null`. */
  readonly slot: ChildSlotKind | null;
  /** Ось раскладки самого узла: вдоль неё рисуются его дети. */
  readonly orientation: Orientation;
  /** Ось раскладки родителя: по ней считаются зоны броска. */
  readonly parentOrientation: Orientation;
  /** Принимает ли узел вложение — есть ли у него зона «внутрь». */
  readonly acceptsInside: boolean;
  /** Лежит ли узел среди соседей: только тогда осмысленны обёрточные зоны. */
  readonly canWrap: boolean;
  /** `$html(div)`: у него направление переворачивается на месте. */
  readonly flippable: boolean;
  readonly isRoot: boolean;
  readonly slots: readonly SchematicSlot[];
}

export interface SchematicOptions {
  /**
   * Скрывать `$html(div)`-обёртки: вместо коробки остаётся её раскладка.
   *
   * Корень не скрывается никогда, даже будучи `div`: спрятав его, вид остался бы без
   * единственной коробки, принимающей бросок в пустую форму.
   */
  readonly hideWrappers?: boolean;
}

/**
 * Коробка корня со всем поддеревом; `null` — корня нет или он безадресный.
 *
 * Безадресные узлы пропускаются вместе с поддеревом ровно по той же причине, что и в дереве
 * строк: коробка без адреса выглядит как остальные, но её нельзя ни выбрать, ни перетащить.
 */
export function buildSchematic(
  schema: JsonFormSchema,
  options: SchematicOptions = {}
): SchematicBox | null {
  const root = schema.root as JsonNode | undefined;
  if (root === undefined) return null;
  const built = buildBox(root, ['root'], {
    hideWrappers: options.hideWrappers ?? false,
    parentOrientation: 'vertical',
    slot: null,
    canWrap: false,
    isRoot: true,
  });
  return built;
}

interface Context {
  readonly hideWrappers: boolean;
  readonly parentOrientation: Orientation;
  readonly slot: ChildSlotKind | null;
  readonly canWrap: boolean;
  readonly isRoot: boolean;
}

function buildBox(node: JsonNode, path: JsonPath, ctx: Context): SchematicBox | null {
  const id = nodeIdOf(node);
  if (id === undefined) return null;
  const orientation = orientationOf(node);

  return {
    shape: 'box',
    id,
    path,
    kind: kindOf(node),
    title: nodeTitle(node),
    component: componentOf(node) ?? null,
    binding: modelOf(node) ?? null,
    slot: ctx.slot,
    orientation,
    parentOrientation: ctx.parentOrientation,
    acceptsInside: canAcceptChildren(node),
    canWrap: ctx.canWrap,
    flippable: isDivContainer(node),
    isRoot: ctx.isRoot,
    slots: buildSlots(node, path, orientation, ctx.hideWrappers),
  };
}

function buildSlots(
  node: JsonNode,
  path: JsonPath,
  orientation: Orientation,
  hideWrappers: boolean
): readonly SchematicSlot[] {
  return childSlots(node, path).map((slot) => {
    // Ось своего контейнера имеет только `children`: шаги визарда, шаблон элемента и обёртка
    // рисуются столбцом всегда — раскладку внутри них задаёт уже их собственное содержимое.
    const slotOrientation = slot.kind === 'children' ? orientation : 'vertical';
    const items: SchematicItem[] = [];

    for (const entry of slot.entries) {
      const childPath = slot.single ? slot.path : [...slot.path, entry.index];
      const item = buildItem(entry.node, childPath, {
        hideWrappers,
        parentOrientation: slotOrientation,
        slot: slot.kind,
        canWrap: slot.kind === 'children' && !slot.single,
        isRoot: false,
      });
      if (item !== null) items.push(item);
    }

    return {
      kind: slot.kind,
      orientation: slotOrientation,
      items,
      // Одиночный слот, оставшийся пустым, приглашения не получает: класть туда вторым
      // нечего, а первый узел появляется не броском, а операцией над самим узлом.
      empty: slot.entries.length === 0 && !slot.single,
    };
  });
}

/**
 * Коробка узла или прозрачная группа на её месте.
 *
 * Скрывается только обёртка со слотом `children`: `div`, у которого детей нет вовсе, при
 * скрытии исчез бы бесследно — и человек не смог бы ни увидеть его, ни удалить.
 */
function buildItem(node: JsonNode, path: JsonPath, ctx: Context): SchematicItem | null {
  if (!ctx.hideWrappers || !isDivContainer(node)) return buildBox(node, path, ctx);

  const orientation = orientationOf(node);
  const own = childSlots(node, path).find((slot) => slot.kind === 'children');
  if (own === undefined || own.entries.length === 0) return buildBox(node, path, ctx);

  const items: SchematicItem[] = [];
  for (const entry of own.entries) {
    const item = buildItem(entry.node, [...own.path, entry.index], {
      ...ctx,
      parentOrientation: orientation,
      slot: 'children',
      canWrap: true,
      isRoot: false,
    });
    if (item !== null) items.push(item);
  }
  return { shape: 'group', orientation, items };
}

/**
 * Адреса коробок в порядке отрисовки — то, вдоль чего расширяется выделение диапазоном.
 *
 * Порядок обхода тот же, что у дерева строк: сначала сам узел, затем слоты по очереди.
 * Совпадение обязательное, а не приятное: Shift-выделение, сделанное в одном виде,
 * человек продолжает в другом, и два разных порядка означали бы, что диапазон «прыгает».
 */
export function schematicOrder(box: SchematicItem | null): readonly NodeId[] {
  if (box === null) return [];
  const order: NodeId[] = [];
  const visit = (item: SchematicItem) => {
    if (item.shape === 'group') {
      item.items.forEach(visit);
      return;
    }
    order.push(item.id);
    for (const slot of item.slots) slot.items.forEach(visit);
  };
  visit(box);
  return order;
}

/** Коробка по адресу; `undefined`, если такого узла в виде нет. */
export function findBox(box: SchematicItem | null, id: NodeId): SchematicBox | undefined {
  if (box === null) return undefined;
  if (box.shape === 'box' && box.id === id) return box;
  const children = box.shape === 'group' ? box.items : box.slots.flatMap((slot) => slot.items);
  for (const child of children) {
    const found = findBox(child, id);
    if (found !== undefined) return found;
  }
  return undefined;
}

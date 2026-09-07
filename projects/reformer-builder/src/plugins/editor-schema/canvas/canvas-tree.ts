/**
 * Развёртка модели в строки канваса: то, что канвас рисует, и всё, что он про дерево знает.
 *
 * Компонент канваса получает готовый список строк и не обходит модель сам. Ради этого модуль
 * и существует: обход неоднородной вложенности (`children`, `componentProps.steps`,
 * `item.$template`, `wrapper`) — предметное правило, у него есть углы, и проверять их
 * надо в окружении `node`, а не сквозь отрисовку.
 *
 * ## Свёрнутое поддерево не обходится
 *
 * Не «обходится и прячется». Свёрнутая ветка не попадает в список вовсе, поэтому стоимость
 * развёртки пропорциональна ВИДИМОМУ, а не всей схеме. Из этого же следует правило выделения
 * диапазоном: порядок Shift-расширения — порядок видимых строк ({@link canvasOrder}), потому
 * что человек тянет по тому, что видит.
 *
 * ## Подпись строки собирается доменом
 *
 * `labelOf`/`componentOf`/`modelOf` живут в `lib/form-model/node-ref` и отвечают на те же
 * вопросы для инспектора, диагностики и агента. Вторая функция «как назвать узел» разошлась бы
 * с первой на первом же составном компоненте.
 *
 * @module plugins/editor-schema/canvas/canvas-tree
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { htmlTag } from '@/lib/catalog/grouping';
import { nodeIdOf } from '@/lib/form-model/node-id';
import { childSlots, kindOf, type ChildSlotKind, type NodeKind } from '@/lib/form-model/node-kind';
import { componentOf, labelOf, modelOf } from '@/lib/form-model/node-ref';
import { selectorOf } from '@/lib/form-model/selectors';
import type { JsonPath } from '@/lib/form-model/paths';
import type { NodeId } from '../host';

/** Одна строка канваса — узел вместе с тем, что о нём нужно знать при отрисовке. */
export interface CanvasRow {
  readonly id: NodeId;
  readonly path: JsonPath;
  /** Глубина вложенности; корень — `0`. Отступ строки считается из неё. */
  readonly depth: number;
  readonly kind: NodeKind;
  /** Слот, в котором узел лежит у родителя; у корня — `null`. */
  readonly slot: ChildSlotKind | null;
  /** Подпись для человека: `label`/`title`, иначе селектор, иначе имя компонента. */
  readonly title: string;
  /** Каталожное имя (`Input`, `$html(div)`) или `null` у узла без компонента. */
  readonly component: string | null;
  /** Путь модели формы без обёртки `$model(...)`; у контейнера — `null`. */
  readonly binding: string | null;
  readonly selected: boolean;
  /** Есть ли что разворачивать. */
  readonly expandable: boolean;
  readonly expanded: boolean;
}

export interface FlattenOptions {
  /** Выделенные адреса. */
  readonly selection?: readonly NodeId[];
  /** Свёрнутые адреса: их дети в список не попадают. */
  readonly collapsed?: ReadonlySet<NodeId>;
}

/**
 * Подпись узла для человека.
 *
 * Порядок источников — от самого говорящего к самому служебному: подпись поля, затем имя,
 * которым узел адресуют правила, затем компонент. `$html(div)` показывается тегом: обёртка
 * оператора в списке из сорока строк — шум, а не информация.
 */
export function nodeTitle(node: JsonNode): string {
  const component = componentOf(node);
  const display = component === undefined ? null : (htmlTag(component) ?? component);
  return labelOf(node) ?? selectorOf(node) ?? display ?? 'узел';
}

/**
 * Строки канваса сверху вниз.
 *
 * Узлы без `$nodeId` пропускаются вместе с поддеревом: строка без адреса неотличима на вид
 * от остальных, но по ней нельзя ни выделить, ни удалить — а такая строка хуже отсутствующей.
 * Появиться она может только у модели, собранной мимо разбора.
 */
export function flattenCanvas(
  schema: JsonFormSchema,
  options: FlattenOptions = {}
): readonly CanvasRow[] {
  const selection = options.selection ?? [];
  const collapsed = options.collapsed ?? new Set<NodeId>();
  const rows: CanvasRow[] = [];

  const visit = (node: JsonNode, path: JsonPath, depth: number, slot: ChildSlotKind | null) => {
    const id = nodeIdOf(node);
    if (id === undefined) return;
    const slots = childSlots(node, path);
    const expandable = slots.some((s) => s.entries.length > 0);
    const expanded = expandable && !collapsed.has(id);

    rows.push({
      id,
      path,
      depth,
      kind: kindOf(node),
      slot,
      title: nodeTitle(node),
      component: componentOf(node) ?? null,
      binding: modelOf(node) ?? null,
      selected: selection.includes(id),
      expandable,
      expanded,
    });

    if (!expanded) return;
    for (const child of slots) {
      for (const entry of child.entries) {
        visit(
          entry.node,
          child.single ? child.path : [...child.path, entry.index],
          depth + 1,
          child.kind
        );
      }
    }
  };

  const root = schema.root as JsonNode | undefined;
  if (root) visit(root, ['root'], 0, null);
  return rows;
}

/** Адреса видимых строк по порядку — то, вдоль чего расширяется выделение диапазоном. */
export function canvasOrder(rows: readonly CanvasRow[]): readonly NodeId[] {
  return rows.map((row) => row.id);
}

/** Строка по адресу; `undefined`, если узел свёрнут внутри чужой ветки или удалён. */
export function findRow(rows: readonly CanvasRow[], id: NodeId): CanvasRow | undefined {
  return rows.find((row) => row.id === id);
}

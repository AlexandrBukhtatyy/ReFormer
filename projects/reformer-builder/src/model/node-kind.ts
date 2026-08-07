/**
 * Вид узла и его дочерние слоты — единственное место, знающее про НЕОДНОРОДНУЮ вложенность
 * `JsonFormSchema`:
 *
 * - контейнер держит детей в `children[]`;
 * - wizard-подобный контейнер — в `componentProps.steps[]` (каждый шаг сам является узлом);
 * - массив — единственного ребёнка в `item.$template`;
 * - поле — опциональную обёртку в `wrapper`.
 *
 * Canvas, drag-drop и обходчики дерева ходят через {@link childSlots}, поэтому нигде больше
 * не хардкодится `children` и правила размещения ReFormer сосредоточены здесь.
 *
 * @module reformer-builder/model/node-kind
 */

import {
  isArrayNode,
  isContainerNode,
  isFieldNode,
  parseOperator,
  type JsonArrayNode,
  type JsonContainerNode,
  type JsonNode,
} from '@reformer/renderer-json';
import type { JsonPath } from './paths';

/** Вид узла: лист / массив / контейнер. */
export type NodeKind = 'field' | 'array' | 'container';

/** Имя дочернего слота. */
export type ChildSlotKind = 'children' | 'steps' | 'template' | 'wrapper';

/**
 * Узел слота вместе с его позицией в ИСХОДНОМ массиве. Индекс хранится явно, потому что слот
 * отдаёт только узлы, а в массиве рядом с ними лежат не-узлы: текстовые части `children`
 * (`JsonChild`) и произвольные значения в `componentProps.steps`. Считать позицию по индексу
 * отфильтрованного списка нельзя — путь указал бы на соседа.
 */
export interface ChildEntry {
  node: JsonNode;
  /** Позиция в исходном массиве-слоте; для одиночных слотов (`template`/`wrapper`) — `0`. */
  index: number;
}

/** Дочерний слот узла — нормализованное представление одной коллекции детей. */
export interface ChildSlot {
  /** Тип слота. */
  kind: ChildSlotKind;
  /** Абсолютный путь (от корня документа) к массиву-слоту (`children`/`steps`) либо к держателю одиночного узла (`template`/`wrapper`). */
  path: JsonPath;
  /** `true` для одиночных слотов (`template`/`wrapper`), где не массив, а один узел. */
  single: boolean;
  /** Узлы слота с их позициями (для одиночного — один элемент с `index: 0`). */
  entries: ChildEntry[];
  /** Длина исходного массива-слота, включая не-узлы (для одиночного — `1`). Позиция вставки «в конец». */
  length: number;
}

/**
 * Вид узла. Порядок проверок важен: массив несёт `$model`, поэтому проверяется ПЕРВЫМ
 * (как и требуют guard-ы `@reformer/renderer-json`).
 */
export function kindOf(node: JsonNode): NodeKind {
  if (isArrayNode(node)) return 'array';
  if (isFieldNode(node)) return 'field';
  return 'container';
}

/** Похоже ли значение на узел схемы (лист/массив/контейнер) — без строгой валидации операторов. */
export function isNodeLike(v: unknown): v is JsonNode {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return 'value' in o || 'array' in o || 'component' in o;
}

/** HTML void-элементы (по спецификации содержимого не имеют). */
const VOID_HTML_TAGS: ReadonlySet<string> = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/**
 * Компоненты-листья (`$component`): рендерят самодостаточный визуал (иконка, разделитель, спиннер…) —
 * вложенные компоненты не держат. Расширяемый список.
 */
export const LEAF_COMPONENT_NAMES: ReadonlySet<string> = new Set([
  'Icon',
  'Separator',
  'Spinner',
  'Skeleton',
  'Progress',
]);

/** Листовой ли компонент/тег по строке `component` (Icon/Separator/… или void html br/hr/img/…). */
export function isLeafComponentRef(component: unknown): boolean {
  const op = parseOperator(component);
  if (!op) return false;
  if (op.op === 'component') return LEAF_COMPONENT_NAMES.has(op.arg);
  if (op.op === 'html') return VOID_HTML_TAGS.has(op.arg);
  return false;
}

/**
 * Узел-лист: не принимает вложенные компоненты (Icon/Separator/… или `$html` void-тег). Такие узлы
 * не drop-target ({@link canAcceptChildren}) и не имеют дочерних слотов ({@link childSlots}).
 */
export function isLeafComponent(node: JsonNode): boolean {
  return isLeafComponentRef((node as { component?: unknown }).component);
}

/**
 * Дочерние слоты узла в порядке отображения. Для контейнера возвращает и `children`,
 * и `steps` (если оба присутствуют); для массива — `template`; для поля — `wrapper` (если есть).
 * Лист без обёртки и контейнер без детей дают пустой список.
 *
 * @param node - Узел.
 * @param nodePath - Абсолютный путь узла (нужен, чтобы построить пути слотов).
 */
export function childSlots(node: JsonNode, nodePath: JsonPath): ChildSlot[] {
  const slots: ChildSlot[] = [];

  // Листовые компоненты (Icon/Separator/$html(br)…) вложенности не имеют — ни детей, ни обёртки.
  if (isLeafComponent(node)) return slots;

  if (isArrayNode(node)) {
    const arr = node as JsonArrayNode;
    slots.push({
      kind: 'template',
      path: [...nodePath, 'item', '$template'],
      single: true,
      entries: [{ node: arr.item.$template, index: 0 }],
      length: 1,
    });
    return slots;
  }

  if (isFieldNode(node)) {
    if (node.wrapper) {
      slots.push({
        kind: 'wrapper',
        path: [...nodePath, 'wrapper'],
        single: true,
        entries: [{ node: node.wrapper, index: 0 }],
        length: 1,
      });
    }
    return slots;
  }

  if (isContainerNode(node)) {
    const c = node as JsonContainerNode;
    const steps = c.componentProps?.steps;
    if (Array.isArray(steps) && steps.some(isNodeLike)) {
      slots.push({
        kind: 'steps',
        path: [...nodePath, 'componentProps', 'steps'],
        single: false,
        entries: nodeEntries(steps),
        length: steps.length,
      });
    }
    if (Array.isArray(c.children)) {
      slots.push({
        kind: 'children',
        path: [...nodePath, 'children'],
        single: false,
        // Текстовые части сюда не попадают: у них нет собственного места на canvas — их правит
        // секция «Содержимое» инспектора у родителя.
        entries: nodeEntries(c.children),
        length: c.children.length,
      });
    }
  }

  return slots;
}

/** Узлы массива-слота со своими исходными индексами (не-узлы отбрасываются, индексы не съезжают). */
function nodeEntries(items: readonly unknown[]): ChildEntry[] {
  const out: ChildEntry[] = [];
  items.forEach((item, index) => {
    if (isNodeLike(item)) out.push({ node: item, index });
  });
  return out;
}

/**
 * Может ли узел принимать детей (контейнер/массив/wizard). Лист без `wrapper`-слота — нет.
 * Используется drag-drop для проверки легальности сброса.
 */
export function canAcceptChildren(node: JsonNode): boolean {
  if (isLeafComponent(node)) return false;
  if (isArrayNode(node)) return true;
  if (isContainerNode(node)) return true;
  return false;
}

/** Ось, вдоль которой контейнер раскладывает детей. */
export type Orientation = 'vertical' | 'horizontal';

/**
 * Ось раскладки контейнера, выведенная из его `componentProps.className`:
 * `flex` без `flex-col`, либо `grid grid-cols-N` (N≥2) → горизонтальная; иначе
 * (`space-y-*`, `flex-col`, отсутствие класса, не-контейнер) → вертикальная.
 * Эвристика для drag-раскладки: она определяет, вдоль какой оси сосед считается «до/после»,
 * а какая ось-край означает «поставить рядом».
 */
export function orientationOf(node: JsonNode): Orientation {
  if (!isContainerNode(node)) return 'vertical';
  const cls = (node as JsonContainerNode).componentProps?.className;
  if (typeof cls !== 'string') return 'vertical';
  const tokens = cls.split(/\s+/).filter(Boolean);
  if (tokens.includes('grid')) {
    const cols = tokens.find((t) => /^grid-cols-\d+$/.test(t));
    if (cols && Number(cols.slice('grid-cols-'.length)) >= 2) return 'horizontal';
  }
  if (tokens.includes('flex') && !tokens.includes('flex-col')) return 'horizontal';
  return 'vertical';
}

/**
 * Является ли узел html-контейнером `$html(div)`. У любого такого div можно переключать направление
 * раскладки (ряд ⇄ столбец) на месте — {@link flipDirection} сам нормализует его к flex. Шире, чем
 * {@link isFlexWrapper}: не требует уже проставленного класса `flex`.
 */
export function isDivContainer(node: JsonNode): node is JsonContainerNode {
  return isContainerNode(node) && (node as JsonContainerNode).component === '$html(div)';
}

/**
 * Является ли узел flex-обёрткой `$html(div)` (её создаёт drag-раскладка). У таких обёрток направление
 * задаётся классом `flex`/`flex-col` — его можно переключать на месте, не вкладывая новый `div`.
 */
export function isFlexWrapper(node: JsonNode): node is JsonContainerNode {
  if (!isContainerNode(node)) return false;
  const c = node as JsonContainerNode;
  if (c.component !== '$html(div)') return false;
  const cls = c.componentProps?.className;
  return typeof cls === 'string' && cls.split(/\s+/).includes('flex');
}

/**
 * Запросы к дереву `JsonFormSchema` только для чтения: поиск узла по пути, путь родителя-узла,
 * обход всех узлов и сбор `$model`-путей / имён операторов (для synth-model и mock-sources
 * runtime-preview).
 *
 * @module reformer-builder/model/query
 */

import {
  isArrayNode,
  isContainerNode,
  isFieldNode,
  parseOperator,
  type JsonContainerNode,
  type JsonFormSchema,
  type JsonNode,
} from '@reformer/renderer-json';
import { getAt, isPrefix, pathEquals, type JsonPath } from './paths';
import { childSlots, isNodeLike, orientationOf, type Orientation } from './node-kind';

/** Узел по пути (или `undefined`, если по пути не узел). */
export function findByPath(schema: JsonFormSchema, path: JsonPath): JsonNode | undefined {
  const v = getAt(schema, path);
  return isNodeLike(v) ? (v as JsonNode) : undefined;
}

/**
 * Путь ОХВАТЫВАЮЩЕГО узла (родителя в терминах дерева, а не JSON-объекта): у пути узла
 * отрезается суффикс слота. Возвращает `null` для корня (`['root']`) или если хвост не
 * распознан как слот.
 *
 * Распознаваемые хвосты:
 * - `['children', i]`                      → контейнер-родитель
 * - `['componentProps', 'steps', i]`       → wizard-родитель
 * - `['item', '$template']`                → массив-родитель
 * - `['wrapper']`                          → поле-родитель
 */
export function parentNodePath(path: JsonPath): JsonPath | null {
  const n = path.length;
  if (n === 0) return null;
  const last = path[n - 1];
  const prev = path[n - 2];
  const prev2 = path[n - 3];

  if (prev === 'children' && isIndex(last)) return path.slice(0, n - 2);
  if (prev2 === 'componentProps' && prev === 'steps' && isIndex(last)) return path.slice(0, n - 3);
  if (prev === 'item' && last === '$template') return path.slice(0, n - 2);
  if (last === 'wrapper') return path.slice(0, n - 1);
  return null;
}

function isIndex(seg: JsonPath[number]): boolean {
  return typeof seg === 'number' || /^\d+$/.test(String(seg));
}

/** Обойти все узлы схемы (pre-order), начиная с корневого (`['root']`), через {@link childSlots}. */
export function walkNodes(
  schema: JsonFormSchema,
  visit: (node: JsonNode, path: JsonPath) => void
): void {
  const start = schema.root;
  if (!isNodeLike(start)) return;
  const rec = (node: JsonNode, path: JsonPath) => {
    visit(node, path);
    for (const slot of childSlots(node, path)) {
      slot.nodes.forEach((child, i) => {
        const childPath = slot.single ? slot.path : [...slot.path, i];
        rec(child, childPath);
      });
    }
  };
  rec(start, ['root']);
}

/**
 * Верхнеуровневые `$model(path)` формы: для поля — из `value`, для массива — из `array`.
 * В `item.$template` НЕ спускаемся: пути внутри шаблона относительны элементу и не входят
 * в модель верхнего уровня. Результат дедуплицирован, порядок — по обходу.
 */
export function collectModelPaths(schema: JsonFormSchema): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (arg: string) => {
    if (!seen.has(arg)) {
      seen.add(arg);
      out.push(arg);
    }
  };
  const rec = (node: JsonNode) => {
    if (isArrayNode(node)) {
      const p = parseOperator(node.array);
      if (p?.op === 'model') push(p.arg);
      return; // шаблон элемента — относительные пути, пропускаем
    }
    if (isFieldNode(node)) {
      const p = parseOperator(node.value);
      if (p?.op === 'model') push(p.arg);
      return;
    }
    if (isContainerNode(node)) {
      const c = node as JsonContainerNode;
      c.children?.forEach(rec);
      const steps = c.componentProps?.steps;
      if (Array.isArray(steps)) steps.forEach((s) => isNodeLike(s) && rec(s as JsonNode));
    }
  };
  if (isNodeLike(schema.root)) rec(schema.root);
  return out;
}

/** Имена операторов, встречающиеся где угодно в схеме (включая props и шаблоны массивов). */
export interface OperatorNames {
  components: string[];
  dataSources: string[];
  fns: string[];
  locales: string[];
}

/**
 * Сбор имён `$component/$dataSource/$fn/$locale` из ВСЕГО дерева (рекурсивный скан значений,
 * включая componentProps и `item.$template`). `$model` игнорируется. Нужен для регистрации
 * заглушек источников и детекта незарегистрированных компонентов в runtime-preview.
 */
export function collectOperatorNames(schema: JsonFormSchema): OperatorNames {
  const components = new Set<string>();
  const dataSources = new Set<string>();
  const fns = new Set<string>();
  const locales = new Set<string>();

  const scan = (v: unknown) => {
    if (typeof v === 'string') {
      const p = parseOperator(v);
      if (p) {
        if (p.op === 'component') components.add(p.arg);
        else if (p.op === 'dataSource') dataSources.add(p.arg);
        else if (p.op === 'fn') fns.add(p.arg);
        else if (p.op === 'locale') locales.add(p.arg);
      }
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(scan);
      return;
    }
    if (v && typeof v === 'object') {
      for (const val of Object.values(v as Record<string, unknown>)) scan(val);
    }
  };

  scan(schema.root);
  return {
    components: [...components],
    dataSources: [...dataSources],
    fns: [...fns],
    locales: [...locales],
  };
}

/** Является ли путь путём того же узла (утилита для стора: сравнение выделения). */
export function isSameNode(a: JsonPath, b: JsonPath): boolean {
  return pathEquals(a, b);
}

// ── навигация по дереву (для горячих клавиш) ──────────────────────────────────

/** Позиция узла среди соседей в его массив-слоте (`children`/`steps`). `null` — не в массив-слоте. */
export interface SiblingInfo {
  slotPath: JsonPath;
  index: number;
  count: number;
}

/** Найти массив-слот и индекс узла среди соседей. Одиночные слоты (template/wrapper) — не соседи. */
export function siblingInfo(schema: JsonFormSchema, path: JsonPath): SiblingInfo | null {
  const parentP = parentNodePath(path);
  if (!parentP) return null;
  const parentNode = getAt(schema, parentP);
  if (!isNodeLike(parentNode)) return null;
  for (const slot of childSlots(parentNode, parentP)) {
    if (slot.single) continue;
    if (isPrefix(slot.path, path) && path.length === slot.path.length + 1) {
      return {
        slotPath: slot.path,
        index: Number(path[path.length - 1]),
        count: slot.nodes.length,
      };
    }
  }
  return null;
}

/** Первый ребёнок узла (для навигации «внутрь»), либо `null`. */
export function firstChildPath(schema: JsonFormSchema, path: JsonPath): JsonPath | null {
  const node = getAt(schema, path);
  if (!isNodeLike(node)) return null;
  for (const slot of childSlots(node, path)) {
    if (slot.nodes.length === 0) continue;
    return slot.single ? slot.path : [...slot.path, 0];
  }
  return null;
}

/** Направление навигации/перемещения (нажатая стрелка). */
export type NavDir = 'up' | 'down' | 'left' | 'right';

/** Смысл стрелки после проекции на ось раскладки: сосед до/после, наружу к родителю, вглубь к ребёнку. */
export type NavIntent = 'prev' | 'next' | 'out' | 'in';

/**
 * Ось, вдоль которой лежат соседи узла — это ось раскладки его родителя ({@link orientationOf}).
 * Горизонтальна только для слота `children` контейнера-ряда: `steps`/`template`/`wrapper` canvas
 * всегда рисует столбцом, независимо от классов родителя.
 */
export function siblingAxis(schema: JsonFormSchema, path: JsonPath): Orientation {
  if (path[path.length - 2] !== 'children') return 'vertical';
  const parentP = parentNodePath(path);
  if (!parentP) return 'vertical';
  const parentNode = getAt(schema, parentP);
  return isNodeLike(parentNode) ? orientationOf(parentNode as JsonNode) : 'vertical';
}

/**
 * Проекция стрелки на ось раскладки: вдоль оси — соседи (`prev`/`next`), поперёк — движение по
 * дереву (`out` к родителю, `in` к первому ребёнку). В столбце ↑↓ ходят по соседям, а ←→ — по
 * дереву; в ряду — наоборот, ←→ по соседям, ↑↓ по дереву.
 */
export function navIntent(dir: NavDir, axis: Orientation): NavIntent {
  const horizontal = axis === 'horizontal';
  switch (dir) {
    case 'up':
      return horizontal ? 'out' : 'prev';
    case 'down':
      return horizontal ? 'in' : 'next';
    case 'left':
      return horizontal ? 'prev' : 'out';
    default:
      return horizontal ? 'next' : 'in';
  }
}

/** Смысл стрелки для конкретного узла: {@link navIntent} на его {@link siblingAxis}. */
export function navIntentAt(schema: JsonFormSchema, path: JsonPath, dir: NavDir): NavIntent {
  return navIntent(dir, siblingAxis(schema, path));
}

/**
 * Целевой путь навигации; стрелка трактуется относительно оси раскладки родителя
 * ({@link navIntentAt}): вдоль оси — предыдущий/следующий сосед, поперёк — родитель / первый
 * ребёнок. `null`, если в эту сторону идти некуда.
 */
export function navTarget(schema: JsonFormSchema, path: JsonPath, dir: NavDir): JsonPath | null {
  const intent = navIntentAt(schema, path, dir);
  if (intent === 'out') return parentNodePath(path);
  if (intent === 'in') return firstChildPath(schema, path);
  const sib = siblingInfo(schema, path);
  if (!sib) return null;
  const next = intent === 'prev' ? sib.index - 1 : sib.index + 1;
  return next < 0 || next >= sib.count ? null : [...sib.slotPath, next];
}

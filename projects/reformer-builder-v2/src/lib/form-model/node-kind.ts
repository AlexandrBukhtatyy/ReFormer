/**
 * Вид узла и его дочерние слоты — единственное место, знающее про НЕОДНОРОДНУЮ вложенность
 * `JsonFormSchema`:
 *
 * - контейнер держит детей в `children[]`;
 * - wizard-подобный контейнер — в `componentProps.steps[]` (каждый шаг сам является узлом);
 *   слот шагов существует и когда шагов ещё нет — по имени компонента ({@link STEPS_HOST_NAMES});
 * - массив — единственного ребёнка в `item.$template`;
 * - поле — опциональную обёртку в `wrapper`.
 *
 * Canvas, drag-drop и обходчики дерева ходят через {@link childSlots}, поэтому нигде больше
 * не хардкодится `children` и правила размещения ReFormer сосредоточены здесь.
 *
 * Множество листовых компонентов приходит НЕОБЯЗАТЕЛЬНЫМ параметром: в v1 оно бралось из
 * `getActiveDescriptor().leafComponents`, то есть из СОСТОЯНИЯ «какой кит активен сейчас», а домен
 * на состояние ссылаться не может. Дефолт — `LEAF_COMPONENT_NAMES` из `lib/kits`: пока переезжал
 * только `form-model`, константа временно жила здесь, теперь она у дизайн-систем, где ей и место
 * (это данные кита, а не правило вложенности). Здесь остался ровно шов.
 *
 * @module reformer-builder/lib/form-model/node-kind
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
import { LEAF_COMPONENT_NAMES } from '../kits/legacy-reformer-ui-kit';
import { baseUtility, gridColumnsOf, isAxisToken, variantsOf } from './tw-tokens';

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
 * Компоненты, у которых `componentProps.steps` — это слот шагов, а не обычный проп.
 *
 * Список нужен ровно потому, что слот определяется ЗНАЧЕНИЕМ: пустой `steps: []` или ещё не
 * созданный ключ неотличимы от «пропа steps, который сюда не относится». Без имени визард,
 * оставшийся без шагов, терял слот навсегда — следующая вставка уходила в `children`, которых
 * рантайм не рендерит, и починить его через UI или агента было уже нечем.
 *
 * По имени, а не по наличию массива: в ките есть записи со `steps` из плоских объектов
 * (`StepIndicator`), и слот шагов у них означал бы drop-зону, кладущую узлы в чужие данные.
 */
export const STEPS_HOST_NAMES: ReadonlySet<string> = new Set([
  'Wizard',
  'FormWizard',
  'RendererFormWizard',
]);

/**
 * Держит ли компонент с таким именем шаги (см. {@link STEPS_HOST_NAMES}).
 *
 * Экспортируется, потому что «это визард» решается не только при обходе дерева: кодоген экспорта
 * спрашивает то же самое про собранный список имён (`$component(...)` всей схемы), чтобы решить,
 * печатать ли wizard-шим и на какое событие вешать submit. Второй копии списка быть не должно —
 * прошлый раз она была в `assign-selectors` подстрокой `includes('Wizard')`.
 */
export function isStepsHostName(name: string): boolean {
  return STEPS_HOST_NAMES.has(name);
}

/** Компонент узла — держатель шагов (см. {@link STEPS_HOST_NAMES}). */
function isStepsHost(node: JsonNode): boolean {
  const op = parseOperator((node as { component?: unknown }).component);
  return op?.op === 'component' && STEPS_HOST_NAMES.has(op.arg);
}

/**
 * Листовой ли компонент/тег по строке `component` (Icon/Separator/… или void html br/hr/img/…).
 *
 * @param component - Значение ключа `component` узла.
 * @param leafComponents - Листья активного кита; по умолчанию — {@link LEAF_COMPONENT_NAMES}.
 *   Void-теги `$html(...)` от кита не зависят и проверяются всегда.
 */
export function isLeafComponentRef(
  component: unknown,
  leafComponents: ReadonlySet<string> = LEAF_COMPONENT_NAMES
): boolean {
  const op = parseOperator(component);
  if (!op) return false;
  if (op.op === 'component') return leafComponents.has(op.arg);
  if (op.op === 'html') return VOID_HTML_TAGS.has(op.arg);
  return false;
}

/**
 * Узел-лист: не принимает вложенные компоненты (Icon/Separator/… или `$html` void-тег). Такие узлы
 * не drop-target ({@link canAcceptChildren}) и не имеют дочерних слотов ({@link childSlots}).
 */
export function isLeafComponent(node: JsonNode, leafComponents?: ReadonlySet<string>): boolean {
  return isLeafComponentRef((node as { component?: unknown }).component, leafComponents);
}

/**
 * Дочерние слоты узла в порядке отображения. Для контейнера возвращает и `children`,
 * и `steps` (если оба присутствуют); для массива — `template`; для поля — `wrapper` (если есть).
 * Лист без обёртки и контейнер без детей дают пустой список.
 *
 * @param node - Узел.
 * @param nodePath - Абсолютный путь узла (нужен, чтобы построить пути слотов).
 * @param leafComponents - Листья активного кита (см. {@link isLeafComponentRef}).
 */
export function childSlots(
  node: JsonNode,
  nodePath: JsonPath,
  leafComponents?: ReadonlySet<string>
): ChildSlot[] {
  const slots: ChildSlot[] = [];

  // Листовые компоненты (Icon/Separator/$html(br)…) вложенности не имеют — ни детей, ни обёртки.
  if (isLeafComponent(node, leafComponents)) return slots;

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
    // Слот шагов есть, если шаги уже лежат ЛИБО узел по имени — визард (тогда слот пустой, но
    // существует: иначе визард без шагов становится необратимо сломанным, см. STEPS_HOST_NAMES).
    const hasStepNodes = Array.isArray(steps) && steps.some(isNodeLike);
    if (hasStepNodes || isStepsHost(node)) {
      const items = Array.isArray(steps) ? steps : [];
      slots.push({
        kind: 'steps',
        path: [...nodePath, 'componentProps', 'steps'],
        single: false,
        entries: nodeEntries(items),
        length: items.length,
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
export function canAcceptChildren(node: JsonNode, leafComponents?: ReadonlySet<string>): boolean {
  if (isLeafComponent(node, leafComponents)) return false;
  if (isArrayNode(node)) return true;
  if (isContainerNode(node)) return true;
  return false;
}

/** Ось, вдоль которой контейнер раскладывает детей. */
export type Orientation = 'vertical' | 'horizontal';

/** Ранг брейкпоинта: чем больше, тем шире экран, с которого вариант вступает в силу. */
const BREAKPOINT_RANK: Record<string, number> = { sm: 1, md: 2, lg: 3, xl: 4, '2xl': 5 };

/** Самый крупный брейкпоинт среди вариантов токена (0 — вариантов нет или они не про ширину). */
function breakpointRank(token: string): number {
  let rank = 0;
  for (const v of variantsOf(token)) rank = Math.max(rank, BREAKPOINT_RANK[v] ?? 0);
  return rank;
}

/**
 * Ось раскладки контейнера, выведенная из его `componentProps.className`:
 * `flex` без `flex-col`, либо `grid grid-cols-N` (N≥2) → горизонтальная; иначе
 * (`space-y-*`, `flex-col`, отсутствие класса, не-контейнер) → вертикальная.
 * Эвристика для drag-раскладки: она определяет, вдоль какой оси сосед считается «до/после»,
 * а какая ось-край означает «поставить рядом».
 *
 * Брейкпоинт-варианты РАЗБИРАЮТСЯ, а не считаются оформлением: `grid grid-cols-1 md:grid-cols-2` —
 * это две колонки, а не одна. Токены применяются каскадом по возрастанию брейкпоинта, поэтому ось
 * задаёт самый широкий из указанных: канвас показывает форму на десктопной ширине, и у
 * `flex-col md:flex-row` пользователь видит именно строку.
 */
export function orientationOf(node: JsonNode): Orientation {
  if (!isContainerNode(node)) return 'vertical';
  const cls = (node as JsonContainerNode).componentProps?.className;
  if (typeof cls !== 'string') return 'vertical';
  const axis = cls
    .split(/\s+/)
    .filter(Boolean)
    .filter(isAxisToken)
    .map((token, i) => ({ base: baseUtility(token), rank: breakpointRank(token), i }))
    // Стабильная сортировка по брейкпоинту: внутри одного ранга порядок записи сохраняется.
    .sort((a, b) => a.rank - b.rank || a.i - b.i);

  let display: 'flex' | 'grid' | undefined;
  let column = false;
  let cols = 0;
  for (const { base } of axis) {
    if (base === 'flex' || base === 'inline-flex') display = 'flex';
    else if (base === 'grid' || base === 'inline-grid') display = 'grid';
    else if (base === 'flex-col' || base === 'flex-col-reverse') column = true;
    else if (base === 'flex-row' || base === 'flex-row-reverse') column = false;
    else {
      const n = gridColumnsOf(base);
      if (n !== undefined) cols = n;
    }
  }

  if (display === 'grid') return cols >= 2 ? 'horizontal' : 'vertical';
  if (display === 'flex') return column ? 'vertical' : 'horizontal';
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

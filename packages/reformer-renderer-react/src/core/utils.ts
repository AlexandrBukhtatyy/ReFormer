/**
 * Утилиты для RenderSchema
 *
 * @module reformer/renderer-react/utils
 */

import { isModelContainerSignal, isValueSignal, modelOf } from '@reformer/core';
import type { Signal } from '@reformer/core/signals';
import type {
  RenderNode,
  ContainerRenderNode,
  ModelFieldRenderNode,
  ArrayRenderNode,
  PartRenderNode,
  RenderModelArrayControl,
} from './types';

// ============================================================================
// Привязка узла к модели
// ============================================================================

/**
 * Ручка значения поля: ключ `model` либо прежний `value`. Для узла, который полем не является, —
 * `undefined`.
 *
 * @example
 * ```typescript
 * fieldBindingOf({ model: model.$.email, component: Input }); // model.$.email
 * fieldBindingOf({ component: Section, children: [] }); // undefined
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fieldBindingOf(node: unknown): Signal<any> | undefined {
  const { model } = node as { model?: unknown };
  return isValueSignal(model) ? model : undefined;
}

/** Ручка массива дерева `model.$` — контейнер, который при этом ручка значения. */
const isArrayHandle = (binding: unknown): boolean =>
  isModelContainerSignal(binding) && isValueSignal(binding);

/** Ручка группы дерева `model.$` — контейнер, который ручкой значения не является. */
const isGroupHandle = (binding: unknown): boolean =>
  isModelContainerSignal(binding) && !isValueSignal(binding);

/**
 * Фасад массива модели по узлу-массиву: привязка ручкой (`model: model.$.items`) либо самим
 * фасадом (`model: model.items`). Для узла, который массивом под-форм не является, —
 * `undefined`.
 *
 * @example
 * ```typescript
 * const control = arrayControlOf({ model: model.$.items, item });
 * control?.push(); // новый элемент по шаблону модели
 * ```
 */
export function arrayControlOf(node: unknown): RenderModelArrayControl | undefined {
  const { model, item } = node as { model?: unknown; item?: unknown };
  if (typeof item !== 'function') return undefined;
  if (isArrayHandle(model)) {
    return modelOf(model as { peek(): unknown[] }) as unknown as RenderModelArrayControl;
  }
  if (model == null || typeof model !== 'object' || isModelContainerSignal(model)) {
    return undefined;
  }
  return model as RenderModelArrayControl;
}

/**
 * Под-модель группы по узлу-подформе: привязка ручкой (`model: model.$.address`) либо самой
 * под-моделью (`model: model.address`). Для узла, который подформой не является, — `undefined`.
 *
 * @example
 * ```typescript
 * partModelOf({ model: model.$.address, part: address }) === model.address; // true
 * ```
 */
export function partModelOf(node: unknown): object | undefined {
  const { model, part } = node as { model?: unknown; part?: unknown };
  if (typeof part !== 'function' || model == null || typeof model !== 'object') return undefined;
  if (isGroupHandle(model)) return modelOf(model as { peek(): object }) as object;
  // Под-модель несёт свою ручку в `$`.
  return isGroupHandle((model as { $?: unknown }).$) ? model : undefined;
}

// ============================================================================
// Type guards узлов
// ============================================================================

/**
 * Type guard для {@link ModelFieldRenderNode} (M1): поле, привязанное к ручке значения модели —
 * листу либо массиву целиком (`model.$.<массив>`: мультивыбор, теги, список файлов).
 *
 * Массив под-форм (`{ model, item }`) тоже привязан к ручке значения, но полем не является —
 * он узнаётся раньше, по `item`.
 *
 * @param node - Узел {@link RenderNode}
 * @returns `true`, если узел — поле (привязка — ручка значения, см. `isValueSignal` ядра)
 *
 * @example Сужение к полю
 * ```typescript
 * if (isModelFieldRenderNode(node)) {
 *   fieldBindingOf(node); // Signal модели
 *   node.component; // UI-компонент поля
 * }
 * ```
 */
export function isModelFieldRenderNode<T>(node: RenderNode<T>): node is ModelFieldRenderNode {
  return fieldBindingOf(node) !== undefined && !isArrayRenderNode(node);
}

/**
 * Type guard для {@link ArrayRenderNode} (M1): массив под-форм `{ model, item }`.
 * Проверяется до поля и контейнера: ручка массива — тоже ручка значения, а `component` у узла
 * необязателен.
 *
 * @param node - Узел {@link RenderNode}
 * @returns `true`, если узел — секция массива (есть привязка к массиву и `item`-фабрика)
 *
 * @example Сужение к массиву
 * ```typescript
 * if (isArrayRenderNode(node)) {
 *   arrayControlOf(node); // реактивный массив модели
 *   node.item; // (model) => RenderNode поддерева элемента
 * }
 * ```
 */
export function isArrayRenderNode<T>(node: RenderNode<T>): node is ArrayRenderNode<T> {
  return arrayControlOf(node) !== undefined;
}

/**
 * Type guard для {@link PartRenderNode}: подформа `{ model, part }` — часть схемы, подключённая
 * к группе модели.
 *
 * @param node - Узел {@link RenderNode}
 * @returns `true`, если узел — подформа (привязка — группа модели, есть `part`-фабрика)
 *
 * @example Сужение к подформе
 * ```typescript
 * if (isPartRenderNode(node)) {
 *   partModelOf(node); // под-модель группы
 *   node.part; // (model) => RenderNode поддерева части
 * }
 * ```
 */
export function isPartRenderNode<T>(node: RenderNode<T>): node is PartRenderNode<T> {
  return partModelOf(node) !== undefined;
}

/**
 * Type guard для ContainerRenderNode
 *
 * Проверяет, что узел является контейнером (Box, Section, `'div'` и т.д.).
 *
 * Принимает любой валидный React element type:
 * - plain function component (`function Foo() {...}`),
 * - `React.memo(...)` / `React.forwardRef(...)` обёртки (объекты с `$$typeof`),
 * - lazy / context provider'ы / прочие React-внутренности,
 * - строку нативного HTML-тега (`'div'`, `'p'`) — см. {@link isHtmlTagRenderNode}.
 *
 * @example
 * ```typescript
 * if (isContainerRenderNode(node)) {
 *   // node.component - React component или строка-тег
 *   // node.children - дочерние узлы
 * }
 * ```
 */
export function isContainerRenderNode<T>(node: RenderNode<T>): node is ContainerRenderNode<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = (node as any).component;
  if (typeof component === 'function') return true;
  // Нативный HTML-тег строкой: `{ component: 'div', children: [...] }`.
  if (typeof component === 'string') return component.length > 0;
  // memo/forwardRef/lazy components are plain objects carrying `$$typeof`.
  if (component !== null && typeof component === 'object' && component.$$typeof !== undefined) {
    return true;
  }
  return false;
}

/**
 * Type guard: узел — нативный HTML-тег (`component` задан строкой), а не React-компонент.
 * Рендерер различает их, чтобы не пробрасывать `selector` в DOM-атрибуты и не передавать
 * содержимое void-тегам.
 *
 * @param node - Узел {@link RenderNode}
 * @returns `true`, если `node.component` — строка-тег
 *
 * @example
 * ```typescript
 * isHtmlTagRenderNode({ component: 'div' }); // true
 * isHtmlTagRenderNode({ component: Section }); // false
 * ```
 */
export function isHtmlTagRenderNode<T>(node: RenderNode<T>): node is ContainerRenderNode<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof (node as any).component === 'string';
}

/**
 * HTML void-элементы: не имеют содержимого. React бросает
 * «is a void element tag and must neither have children…», если такому тегу передать children,
 * поэтому рендерер их содержимое не передаёт вовсе.
 */
export const VOID_HTML_TAGS: ReadonlySet<string> = new Set([
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

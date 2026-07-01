/**
 * Утилиты для RenderSchema
 *
 * @module reformer/renderer-react/utils
 */

import { Signal } from '@preact/signals-core';
import type {
  RenderNode,
  ContainerRenderNode,
  ModelFieldRenderNode,
  ArrayRenderNode,
} from './types';

/**
 * Type guard для {@link ModelFieldRenderNode} (M1): лист, привязанный к сигналу модели.
 * Проверяется ПЕРВЫМ — такой узел несёт реальный `component`, иначе спутается с контейнером.
 *
 * @param node - Узел {@link RenderNode}
 * @returns `true`, если узел — поле-лист (`value instanceof Signal`)
 *
 * @example Сужение к полю
 * ```typescript
 * if (isModelFieldRenderNode(node)) {
 *   node.value; // Signal модели
 *   node.component; // UI-компонент поля
 * }
 * ```
 */
export function isModelFieldRenderNode<T>(node: RenderNode<T>): node is ModelFieldRenderNode {
  return (node as ModelFieldRenderNode).value instanceof Signal;
}

/**
 * Type guard для {@link ArrayRenderNode} (M1): массив модели `{ array, item }`.
 * Проверяется до контейнера (у array-узла нет `component`).
 *
 * @param node - Узел {@link RenderNode}
 * @returns `true`, если узел — секция массива (есть `array` и `item`-фабрика)
 *
 * @example Сужение к массиву
 * ```typescript
 * if (isArrayRenderNode(node)) {
 *   node.array; // реактивный массив модели
 *   node.item; // (itemModel) => RenderNode поддерева элемента
 * }
 * ```
 */
export function isArrayRenderNode<T>(node: RenderNode<T>): node is ArrayRenderNode<T> {
  const n = node as ArrayRenderNode<T>;
  return n.array != null && typeof n.array === 'object' && typeof n.item === 'function';
}

/**
 * Type guard для ContainerRenderNode
 *
 * Проверяет, что узел является контейнером (Box, Section и т.д.).
 *
 * Принимает любой валидный React component reference:
 * - plain function component (`function Foo() {...}`),
 * - `React.memo(...)` / `React.forwardRef(...)` обёртки (объекты с `$$typeof`),
 * - lazy / context provider'ы / прочие React-внутренности.
 *
 * @example
 * ```typescript
 * if (isContainerRenderNode(node)) {
 *   // node.component - React component
 *   // node.children - дочерние узлы
 * }
 * ```
 */
export function isContainerRenderNode<T>(node: RenderNode<T>): node is ContainerRenderNode<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = (node as any).component;
  if (typeof component === 'function') return true;
  // memo/forwardRef/lazy components are plain objects carrying `$$typeof`.
  if (component !== null && typeof component === 'object' && component.$$typeof !== undefined) {
    return true;
  }
  return false;
}

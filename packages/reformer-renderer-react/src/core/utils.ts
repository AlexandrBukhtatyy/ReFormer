/**
 * Утилиты для RenderSchema
 *
 * @module reformer/renderer-react/utils
 */

import { Signal } from '@preact/signals-core';
import type {
  RenderNode,
  FieldRenderNode,
  ContainerRenderNode,
  ModelFieldRenderNode,
  ArrayRenderNode,
} from './types';

/**
 * Type guard для ModelFieldRenderNode (M1): лист, привязанный к сигналу модели.
 * Проверяется ПЕРВЫМ — такой узел несёт реальный `component`, иначе спутается с контейнером.
 */
export function isModelFieldRenderNode<T>(node: RenderNode<T>): node is ModelFieldRenderNode {
  return (node as ModelFieldRenderNode).value instanceof Signal;
}

/**
 * Type guard для ArrayRenderNode (M1): массив модели `{ array, item }`.
 * Проверяется до контейнера (у array-узла нет `component`).
 */
export function isArrayRenderNode<T>(node: RenderNode<T>): node is ArrayRenderNode<T> {
  const n = node as ArrayRenderNode<T>;
  return n.array != null && typeof n.array === 'object' && typeof n.item === 'function';
}

/**
 * Type guard для FieldRenderNode
 *
 * Проверяет, что узел является полем формы (ссылкой через path.fieldName).
 * Поля идентифицируются по наличию свойства __path в component.
 *
 * NOTE: Используем прямой доступ к __path вместо 'in' оператора,
 * потому что вложенные Proxy (для path.nested.field) не имеют 'has' trap,
 * и 'in' оператор не работает корректно для них.
 *
 * @example
 * ```typescript
 * if (isFieldRenderNode(node)) {
 *   // node.component имеет __path
 *   const fieldPath = node.component.__path;
 * }
 * ```
 */
export function isFieldRenderNode<T>(node: RenderNode<T>): node is FieldRenderNode {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = (node as any).component;
  if (component == null || typeof component !== 'object') {
    return false;
  }
  // Прямой доступ к __path через get trap Proxy
  const path = component.__path;
  return typeof path === 'string' && path.length > 0;
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

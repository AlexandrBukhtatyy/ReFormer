/**
 * Утилиты для RenderSchema
 *
 * @module reformer/renderer-react/utils
 */

import type { RenderNode, FieldRenderNode, ContainerRenderNode } from './types';

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
  if (node.component == null || typeof node.component !== 'object') {
    return false;
  }
  // Прямой доступ к __path через get trap Proxy
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const path = (node.component as any).__path;
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
  if (typeof node.component === 'function') return true;
  // memo/forwardRef/lazy components are plain objects carrying `$$typeof`.
  if (
    node.component !== null &&
    typeof node.component === 'object' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node.component as any).$$typeof !== undefined
  ) {
    return true;
  }
  return false;
}

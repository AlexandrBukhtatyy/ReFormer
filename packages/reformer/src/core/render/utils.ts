/**
 * Утилиты для RenderSchema
 *
 * @module core/render/utils
 */

import type {
  RenderNode,
  FieldRenderNode,
  ContainerRenderNode,
  ArrayRenderNode,
  NavigationRenderNode,
} from './types';
import { FormArray } from './components/form-array';

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
export function isFieldRenderNode<T>(node: RenderNode<T>): node is FieldRenderNode<T> {
  if (node.component == null || typeof node.component !== 'object') {
    return false;
  }
  // Прямой доступ к __path через get trap Proxy
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const path = (node.component as any).__path;
  return typeof path === 'string' && path.length > 0;
}

/**
 * Type guard для ArrayRenderNode
 *
 * Проверяет, что узел является массивом (FormArray).
 *
 * @example
 * ```typescript
 * if (isArrayRenderNode(node)) {
 *   // node.componentProps.array, node.componentProps.renderItem
 * }
 * ```
 */
export function isArrayRenderNode<T>(node: RenderNode<T>): node is ArrayRenderNode<T> {
  return node.component === FormArray;
}

/**
 * Type guard для ContainerRenderNode
 *
 * Проверяет, что узел является контейнером (Box, Section и т.д.).
 * Контейнер - это функциональный компонент, не являющийся FormArray.
 *
 * @example
 * ```typescript
 * if (isContainerRenderNode(node)) {
 *   // node.component - React component
 *   // node.componentProps.children - дочерние узлы
 * }
 * ```
 */
export function isContainerRenderNode<T>(node: RenderNode<T>): node is ContainerRenderNode<T> {
  return (
    typeof node.component === 'function' &&
    node.component !== FormArray &&
    !isNavigationRenderNode(node)
  );
}

/**
 * Type guard для NavigationRenderNode
 *
 * Проверяет, что узел является FormNavigation для multi-step формы.
 * Идентифицируется по наличию `steps` и `children` с селекторами в componentProps.
 *
 * @example
 * ```typescript
 * if (isNavigationRenderNode(node)) {
 *   // node.componentProps.steps, node.componentProps.children
 * }
 * ```
 */
export function isNavigationRenderNode<T>(node: RenderNode<T>): node is NavigationRenderNode<T> {
  const props = node.componentProps as NavigationRenderNode<T>['componentProps'] | undefined;
  if (!props) return false;

  // Проверяем наличие steps и children с селекторами
  return (
    Array.isArray(props.steps) &&
    Array.isArray(props.children) &&
    props.children.length > 0 &&
    typeof props.children[0] === 'object' &&
    props.children[0] !== null &&
    'selector' in props.children[0]
  );
}

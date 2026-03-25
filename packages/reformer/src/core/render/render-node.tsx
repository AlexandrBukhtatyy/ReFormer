/**
 * RenderNodeComponent - рекурсивный рендеринг узлов RenderSchema
 *
 * @module core/render/render-node
 */

import type { ReactNode } from 'react';
import type { FieldNode } from '../nodes/field-node';
import type { FormProxy, FieldPath } from '../types';
import { FieldPathNavigator } from '../utils/field-path-navigator';
import { useFormControl } from '../../hooks/useFormControl';
import { createFieldPath, extractPath } from '../utils/field-path';
import type { RenderNode } from './types';
import { isFieldRenderNode, isArrayRenderNode, isContainerRenderNode } from './utils';

/**
 * Props для RenderNodeComponent
 */
interface RenderNodeComponentProps<T> {
  /** Узел для рендеринга */
  node: RenderNode<T>;
  /** Proxy формы */
  form: FormProxy<T>;
  /** Текущий FieldPath (для hidden условий) */
  path: FieldPath<T>;
}

/** Navigator для получения узлов по пути */
const navigator = new FieldPathNavigator();

/**
 * Компонент рендеринга поля формы
 *
 * Использует компонент из FieldNode.component и передаёт ему
 * control prop для доступа к состоянию.
 */
function FieldRenderer({
  fieldNode,
  className,
  wrapper: Wrapper = 'div',
}: {
  fieldNode: FieldNode<unknown>;
  className?: string;
  wrapper?: React.ElementType;
}): ReactNode {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state = useFormControl(fieldNode as FieldNode<any>);
  const Component = fieldNode.component;

  return (
    <Wrapper className={className}>
      <Component control={fieldNode} {...state} />
    </Wrapper>
  );
}

/**
 * RenderNodeComponent - рекурсивный рендеринг узла RenderSchema
 *
 * Определяет тип узла и рендерит соответствующим образом:
 * - FieldRenderNode → компонент поля с wrapper
 * - ArrayRenderNode → итерация по элементам массива
 * - ContainerRenderNode → контейнер с дочерними узлами
 */
export function RenderNodeComponent<T>({
  node,
  form,
  path,
}: RenderNodeComponentProps<T>): ReactNode {
  const { componentProps = {} } = node;

  // Проверка условия hidden
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hidden = (componentProps as any).hidden;
  if (typeof hidden === 'function' && hidden(form, path)) {
    return null;
  }

  // ========================================
  // FieldRenderNode - поле формы
  // ========================================
  if (isFieldRenderNode(node)) {
    const fieldPath = extractPath(node.component);
    const fieldNode = navigator.getNodeByPath(form, fieldPath) as FieldNode<unknown> | null;

    if (!fieldNode) {
      console.warn(`[RenderSchema] Field not found: ${fieldPath}`);
      return null;
    }

    const { className, wrapper } = node.componentProps || {};

    return <FieldRenderer fieldNode={fieldNode} className={className} wrapper={wrapper} />;
  }

  // ========================================
  // ArrayRenderNode - массив
  // ========================================
  if (isArrayRenderNode(node)) {
    const { array, className, renderItem } = node.componentProps;
    const arrayPath = extractPath(array);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arrayNode = navigator.getNodeByPath(form, arrayPath) as any;

    if (!arrayNode || !arrayNode.map) {
      console.warn(`[RenderSchema] Array not found: ${arrayPath}`);
      return null;
    }

    return (
      <div className={className}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {arrayNode.map((item: FormProxy<any>, index: number) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const itemPath = createFieldPath<any>();
          const itemNode = renderItem(itemPath, index);

          return (
            <RenderNodeComponent
              key={item.id ?? index}
              node={itemNode}
              form={item}
              path={itemPath}
            />
          );
        })}
      </div>
    );
  }

  // ========================================
  // ContainerRenderNode - контейнер
  // ========================================
  if (isContainerRenderNode(node)) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { children, hidden: _hidden, ...restProps } = node.componentProps || {};
    const Component = node.component;

    return (
      <Component {...restProps}>
        {children?.map((child, i) => (
          <RenderNodeComponent key={i} node={child} form={form} path={path} />
        ))}
      </Component>
    );
  }

  return null;
}

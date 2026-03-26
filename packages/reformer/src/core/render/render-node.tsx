/**
 * RenderNodeComponent - рекурсивный рендеринг узлов RenderSchema
 *
 * @module core/render/render-node
 */

import { memo, type ReactNode } from 'react';
import type { FieldNode } from '../nodes/field-node';
import type { ArrayNode } from '../nodes/array-node';
import type { FormProxy, FieldPath, FormFields } from '../types';
import { FieldPathNavigator } from '../utils/field-path-navigator';
import { useFormControl } from '../../hooks/useFormControl';
import { useArrayLength } from '../../hooks/useArrayLength';
import { createFieldPath, extractPath } from '../utils/field-path';
import type {
  RenderNode,
  ArrayUIHeaderConfig,
  ArrayUIEmptyConfig,
  ArrayRenderItemConfig,
  FieldWrapperProps,
} from './types';
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
  /** Компонент-обёртка для полей */
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
}

/** Navigator для получения узлов по пути */
const navigator = new FieldPathNavigator();

/**
 * Компонент рендеринга поля формы
 *
 * Использует компонент из FieldNode.component и передаёт ему
 * control prop для доступа к состоянию.
 *
 * Если указан fieldWrapper, поле оборачивается им для рендеринга
 * label, errors и т.д.
 */
interface FieldRendererProps {
  fieldNode: FieldNode<unknown>;
  className?: string;
  wrapper?: React.ElementType;
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
}

const FieldRenderer = memo(function FieldRenderer({
  fieldNode,
  className,
  wrapper: Wrapper = 'div',
  fieldWrapper: FieldWrapper,
}: FieldRendererProps): ReactNode {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state = useFormControl(fieldNode as FieldNode<any>);
  const Component = fieldNode.component;

  // Только props для UI компонента (без state props которые не должны попадать в DOM)
  const inputProps = {
    value: state.value,
    disabled: state.disabled,
    ...state.componentProps,
  };

  // Handlers для UI компонентов
  const handlers = {
    onChange: (value: unknown) => fieldNode.setValue(value),
    onBlur: () => fieldNode.markAsTouched(),
  };

  const input = <Component control={fieldNode} {...inputProps} {...handlers} />;

  // Если есть fieldWrapper, оборачиваем им
  const content = FieldWrapper ? (
    <FieldWrapper control={fieldNode} className={className}>
      {input}
    </FieldWrapper>
  ) : (
    <Wrapper className={className}>{input}</Wrapper>
  );

  return content;
});

/**
 * Компонент рендеринга массива
 *
 * Выделен в отдельный компонент для корректного использования хуков.
 * Подписывается на изменения длины массива через useFormControl.
 */
function ArrayRenderer<TItem>({
  arrayNode,
  className,
  renderItem,
  header,
  empty,
  fieldWrapper,
}: {
  arrayNode: ArrayNode<FormFields>;
  className?: string;
  renderItem: ArrayRenderItemConfig<TItem>;
  header?: ArrayUIHeaderConfig;
  empty?: ArrayUIEmptyConfig;
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
}): ReactNode {
  // Подписка только на length - не вызывает ре-рендер при изменении вложенных полей
  const length = useArrayLength(arrayNode);

  const isEmpty = length === 0;

  // Деструктурируем item-конфиг из renderItem
  const {
    render,
    wrapper,
    showIndex,
    indexLabel,
    indexClassName,
    headerClassName,
    removeButton,
    removeButtonClassName,
  } = renderItem;

  return (
    <div className={className}>
      {/* Header с title и add button */}
      {header && (
        <div className={header.className}>
          {header.title && <h3 className={header.titleClassName}>{header.title}</h3>}
          {header.addButton && (
            <button
              type="button"
              onClick={() => arrayNode.push({})}
              className={header.addButtonClassName}
            >
              {header.addButton}
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && empty && (
        <div className={empty.className}>
          <div>{empty.message}</div>
          {empty.hint && <div className={empty.hintClassName}>{empty.hint}</div>}
        </div>
      )}

      {/* Items */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {arrayNode.map((arrayItem: FormProxy<any>, index: number) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const itemPath = createFieldPath<any>();
        const itemNode = render(itemPath, index);

        return (
          <div key={arrayItem.id ?? index} className={wrapper}>
            {/* Item header with index and remove */}
            {(showIndex || removeButton) && (
              <div className={headerClassName}>
                {showIndex && (
                  <span className={indexClassName}>
                    {indexLabel ? `${indexLabel} #${index + 1}` : `#${index + 1}`}
                  </span>
                )}
                {removeButton && (
                  <button
                    type="button"
                    onClick={() => arrayNode.removeAt(index)}
                    className={removeButtonClassName}
                  >
                    {removeButton}
                  </button>
                )}
              </div>
            )}
            <RenderNodeComponent
              node={itemNode}
              form={arrayItem}
              path={itemPath}
              fieldWrapper={fieldWrapper}
            />
          </div>
        );
      })}
    </div>
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
  fieldWrapper,
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

    const { className, wrapper, fieldWrapper: perFieldWrapper } = node.componentProps || {};
    // Per-field wrapper имеет приоритет над глобальным
    const effectiveWrapper = perFieldWrapper ?? fieldWrapper;

    return (
      <FieldRenderer
        fieldNode={fieldNode}
        className={className}
        wrapper={wrapper}
        fieldWrapper={effectiveWrapper}
      />
    );
  }

  // ========================================
  // ArrayRenderNode - массив
  // ========================================
  if (isArrayRenderNode(node)) {
    const { array, className, renderItem, header, empty } = node.componentProps;
    const arrayPath = extractPath(array);
    const arrayNode = navigator.getNodeByPath(form, arrayPath) as ArrayNode<FormFields> | null;

    if (!arrayNode || !arrayNode.map) {
      console.warn(`[RenderSchema] Array not found: ${arrayPath}`);
      return null;
    }

    return (
      <ArrayRenderer
        arrayNode={arrayNode}
        className={className}
        renderItem={renderItem}
        header={header}
        empty={empty}
        fieldWrapper={fieldWrapper}
      />
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
          <RenderNodeComponent
            key={i}
            node={child}
            form={form}
            path={path}
            fieldWrapper={fieldWrapper}
          />
        ))}
      </Component>
    );
  }

  return null;
}

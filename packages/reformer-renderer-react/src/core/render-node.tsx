/**
 * RenderNodeComponent - рекурсивный рендеринг узлов RenderSchema
 *
 * @module reformer/renderer-react/render-node
 */

import { memo, useMemo, type ReactNode } from 'react';
import type { FieldNode, ArrayNode, FormProxy, FieldPath, FormFields } from '@reformer/core';
import {
  FieldPathNavigator,
  useFormControl,
  useArrayLength,
  useHiddenCondition,
  createFieldPath,
  extractPath,
} from '@reformer/core';
import type { RenderNode, SelectorRenderNode, FormArraySelector, FieldWrapperProps } from './types';
import { isFieldRenderNode, isArrayRenderNode, isContainerRenderNode } from './utils';
import {
  FormArrayContext,
  FormArrayItemContext,
  type FormArrayContextValue,
  type FormArrayItemContextValue,
} from '../components/form-array-context';

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
 * Резолвит селектор из массива children
 */
function resolveSelector<T, TItem>(
  children: SelectorRenderNode<T, TItem>[] | undefined,
  selector: FormArraySelector
): SelectorRenderNode<T, TItem> | undefined {
  return children?.find((child) => child.selector === selector);
}

/**
 * Компонент рендеринга массива
 *
 * Использует selector-based API с children для определения частей массива:
 * - header: заголовок и кнопка добавления
 * - empty: пустое состояние
 * - item: элемент массива (с вложенными item:header, item:content, item:footer)
 * - footer: футер массива
 */
function ArrayRenderer<TItem>({
  arrayNode,
  className,
  children,
  fieldWrapper,
}: {
  arrayNode: ArrayNode<FormFields>;
  className?: string;
  children: SelectorRenderNode<unknown, TItem>[];
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
}): ReactNode {
  // Подписка только на length - не вызывает ре-рендер при изменении вложенных полей
  const length = useArrayLength(arrayNode);
  const isEmpty = length === 0;

  // Резолвим селекторы
  const headerNode = resolveSelector(children, 'header');
  const emptyNode = resolveSelector(children, 'empty');
  const itemNode = resolveSelector(children, 'item');
  const footerNode = resolveSelector(children, 'footer');

  // Создаём items для контекста
  const items = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return arrayNode.map((itemControl: FormProxy<any>, index: number) => ({
      control: itemControl,
      index,
      id: itemControl.id ?? index,
      remove: () => arrayNode.removeAt(index),
    }));
  }, [arrayNode, length]);

  // Контекст массива
  const arrayContextValue: FormArrayContextValue = useMemo(
    () => ({
      items,
      length,
      isEmpty,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      add: (value?: any) => arrayNode.push(value ?? {}),
      clear: () => arrayNode.clear(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insert: (index: number, value?: any) => arrayNode.insert(index, value),
      control: arrayNode,
    }),
    [items, length, isEmpty, arrayNode]
  );

  return (
    <FormArrayContext.Provider value={arrayContextValue}>
      <div className={className}>
        {/* Header */}
        {headerNode && <SelectorNodeRenderer node={headerNode} fieldWrapper={fieldWrapper} />}

        {/* Empty state */}
        {isEmpty && emptyNode && (
          <SelectorNodeRenderer node={emptyNode} fieldWrapper={fieldWrapper} />
        )}

        {/* Items */}
        {!isEmpty &&
          items.map(({ control: arrayItem, index, id, remove }) => {
            const itemContextValue: FormArrayItemContextValue = {
              control: arrayItem,
              index,
              id,
              remove,
            };

            return (
              <FormArrayItemContext.Provider key={id} value={itemContextValue}>
                {itemNode && (
                  <ItemSelectorRenderer
                    node={itemNode}
                    item={arrayItem}
                    index={index}
                    fieldWrapper={fieldWrapper}
                  />
                )}
              </FormArrayItemContext.Provider>
            );
          })}

        {/* Footer */}
        {footerNode && <SelectorNodeRenderer node={footerNode} fieldWrapper={fieldWrapper} />}
      </div>
    </FormArrayContext.Provider>
  );
}

/**
 * Рендерит SelectorRenderNode (header, empty, footer)
 */
function SelectorNodeRenderer<T, TItem>({
  node,
  fieldWrapper,
}: {
  node: SelectorRenderNode<T, TItem>;
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
}): ReactNode {
  const Component = node.component;
  if (!Component) return null;

  const { children: selectorChildren, ...restProps } = node.componentProps || {};

  // Рендерим children если они есть (могут быть RenderNode или SelectorRenderNode)
  const renderedChildren = selectorChildren?.map((child, idx) => {
    // Если это SelectorRenderNode с вложенным селектором - пропускаем (они для item)
    if ('selector' in child && (child.selector as string).startsWith('item:')) {
      return null;
    }
    // Если у child есть component - это RenderNode
    if ('component' in child && child.component) {
      return (
        <RenderNodeComponent
          key={idx}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          node={child as RenderNode<any>}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          form={{} as FormProxy<any>}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          path={createFieldPath<any>()}
          fieldWrapper={fieldWrapper}
        />
      );
    }
    return null;
  });

  return <Component {...restProps}>{renderedChildren}</Component>;
}

/**
 * Рендерит item с поддержкой вложенных селекторов (item:header, item:content, item:footer)
 */
function ItemSelectorRenderer<T, TItem>({
  node,
  item,
  index,
  fieldWrapper,
}: {
  node: SelectorRenderNode<T, TItem>;
  item: FormProxy<unknown>;
  index: number;
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
}): ReactNode {
  const Component = node.component;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemPath = createFieldPath<any>();

  const { children: selectorChildren, ...restProps } = node.componentProps || {};

  // Ищем вложенные селекторы
  const itemHeaderNode = selectorChildren?.find(
    (c) => 'selector' in c && c.selector === 'item:header'
  ) as SelectorRenderNode<T, TItem> | undefined;

  const itemContentNode = selectorChildren?.find(
    (c) => 'selector' in c && c.selector === 'item:content'
  ) as SelectorRenderNode<T, TItem> | undefined;

  const itemFooterNode = selectorChildren?.find(
    (c) => 'selector' in c && c.selector === 'item:footer'
  ) as SelectorRenderNode<T, TItem> | undefined;

  // Рендерим content через render функцию
  const contentElement = itemContentNode?.render ? (
    <RenderNodeComponent
      node={itemContentNode.render(itemPath, index)}
      form={item}
      path={itemPath}
      fieldWrapper={fieldWrapper}
    />
  ) : node.render ? (
    <RenderNodeComponent
      node={node.render(itemPath, index)}
      form={item}
      path={itemPath}
      fieldWrapper={fieldWrapper}
    />
  ) : null;

  // Если нет Component, рендерим только content
  if (!Component) {
    return contentElement;
  }

  return (
    <Component {...restProps}>
      {/* Item header */}
      {itemHeaderNode && <SelectorNodeRenderer node={itemHeaderNode} fieldWrapper={fieldWrapper} />}

      {/* Item content */}
      {contentElement}

      {/* Item footer */}
      {itemFooterNode && <SelectorNodeRenderer node={itemFooterNode} fieldWrapper={fieldWrapper} />}
    </Component>
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
  // Проверка условия hidden (реактивная через хук)
  const isHidden = useHiddenCondition(node.hidden, form, path);

  if (isHidden) {
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
    const { array, className, children } = node.componentProps;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        children={children as SelectorRenderNode<unknown, any>[]}
        fieldWrapper={fieldWrapper}
      />
    );
  }

  // ========================================
  // ContainerRenderNode - контейнер
  // ========================================
  if (isContainerRenderNode(node)) {
    const { selector, component: Component, children } = node;
    const restProps = node.componentProps || {};

    // Если компонент управляет children самостоятельно (например, wizard с RenderNode[]),
    // передаём children как сырые данные без авторендеринга через RenderNodeComponent.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((Component as any).__selfManagedChildren === true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SelfManagedComponent = Component as React.ComponentType<any>;
      return (
        <SelfManagedComponent
          {...(selector !== undefined ? { selector } : {})}
          {...restProps}
          children={children}
        />
      );
    }

    return (
      <Component {...(selector !== undefined ? { selector } : {})} {...restProps}>
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

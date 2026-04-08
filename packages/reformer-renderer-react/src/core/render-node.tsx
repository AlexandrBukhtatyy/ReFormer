/**
 * RenderNodeComponent - рекурсивный рендеринг узлов RenderSchema
 *
 * @module reformer/renderer-react/render-node
 */

import { memo, type ReactNode } from 'react';
import type { FieldNode, FormProxy, FieldPath } from '@reformer/core';
import {
  FieldPathNavigator,
  useFormControl,
  useHiddenCondition,
  extractPath,
} from '@reformer/core';
import type { RenderNode, FieldWrapperProps } from './types';
import { isFieldRenderNode, isContainerRenderNode } from './utils';
import { useRenderContext } from './render-context';
import { useOptionalSignalValue, type RenderNodeOverrides } from './render-schema-proxy';

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
  /**
   * Компонент-обёртка для полей (опционально).
   * Переопределяет глобальный fieldWrapper из settings.
   * Используется в user-space компонентах (RendererFormArraySection, RendererFormWizard и т.д.)
   * при рендеринге дочерних узлов с нестандартным контекстом формы.
   */
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
 * RenderNodeComponent - рекурсивный рендеринг узла RenderSchema
 *
 * Определяет тип узла и рендерит соответствующим образом:
 * - FieldRenderNode → компонент поля с wrapper
 * - ContainerRenderNode → контейнер с дочерними узлами
 */
export function RenderNodeComponent<T>({
  node,
  form,
  path,
  fieldWrapper: fieldWrapperProp,
}: RenderNodeComponentProps<T>): ReactNode {
  const { settings } = useRenderContext();
  // prop имеет приоритет над глобальным settings (для user-space компонентов с вложенными формами)
  const fieldWrapper = fieldWrapperProp ?? settings?.fieldWrapper;

  // Читаем сигналы переопределений (если нода создана через createRenderSchema)
  const overrides = node as unknown as RenderNodeOverrides;
  const hiddenOverride = useOptionalSignalValue(overrides.__hiddenOverride);
  const propsOverride = useOptionalSignalValue(overrides.__propsOverride);

  // Реактивная проверка условия hidden из схемы
  const isHiddenByCondition = useHiddenCondition(node.hidden, form, path);
  // Переопределение имеет приоритет: null/undefined = переопределение не задано
  const isHidden = hiddenOverride != null ? hiddenOverride : isHiddenByCondition;

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
  // ContainerRenderNode - контейнер
  // ========================================
  if (isContainerRenderNode(node)) {
    const { selector, component: Component, children } = node;
    const baseProps = node.componentProps || {};
    // Применяем переопределение пропсов (если задано через schema.node(selector).patchProps())
    const effectiveProps = propsOverride != null ? { ...baseProps, ...propsOverride } : baseProps;

    // Если компонент управляет children самостоятельно (например, wizard с RenderNode[]),
    // передаём children как сырые данные без авторендеринга через RenderNodeComponent.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((Component as any).__selfManagedChildren === true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SelfManagedComponent = Component as React.ComponentType<any>;
      return (
        <SelfManagedComponent
          {...(selector !== undefined ? { selector } : {})}
          {...effectiveProps}
          children={children}
        />
      );
    }

    return (
      <Component {...(selector !== undefined ? { selector } : {})} {...effectiveProps}>
        {children?.map((child, i) => (
          <RenderNodeComponent key={i} node={child} form={form} path={path} />
        ))}
      </Component>
    );
  }

  return null;
}

/**
 * RenderNodeComponent - рекурсивный рендеринг узлов RenderSchema
 *
 * @module reformer/renderer-react/render-node
 */

import { memo, type ReactNode } from 'react';
import type { FieldNode, FormProxy, FieldPath } from '@reformer/core';
import { FieldPathNavigator, useFormControl, extractPath } from '@reformer/core';
import type { RenderNode, FieldWrapperProps } from './types';
import { isFieldRenderNode, isContainerRenderNode } from './utils';
import { useRenderContext } from './render-context';
import { useContext } from 'react';
import {
  useHiddenOverride,
  usePropsOverride,
  RenderSchemaOverrideContext,
} from './render-schema-proxy';
import { useCondition, useNodeLifecycle } from './render-behavior';

/**
 * Props для RenderNodeComponent
 */
interface RenderNodeComponentProps<T> {
  /** Узел для рендеринга */
  node: RenderNode<T>;
  /** Proxy формы (опционально — предоставляется wizard-компонентом через props или контекст) */
  form?: FormProxy<T>;
  /** Текущий FieldPath (опционально) */
  path?: FieldPath<T>;
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
  testId?: string;
}

const FieldRenderer = memo(function FieldRenderer({
  fieldNode,
  className,
  wrapper: Wrapper = 'div',
  fieldWrapper: FieldWrapper,
  testId,
}: FieldRendererProps): ReactNode {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state = useFormControl(fieldNode as FieldNode<any>);
  const Component = fieldNode.component;

  // Только props для UI компонента (без state props которые не должны попадать в DOM)
  const inputProps: Record<string, unknown> = {
    value: state.value,
    disabled: state.disabled,
    ...state.componentProps,
  };

  // Прокидываем data-testid в UI-компонент (RadioGroup/Select/Checkbox используют его
  // для генерации child-testid вида `input-${testId}-${optionValue}`)
  if (testId && inputProps['data-testid'] === undefined) {
    inputProps['data-testid'] = `input-${testId}`;
  }

  // Handlers для UI компонентов
  const handlers = {
    onChange: (value: unknown) => fieldNode.setValue(value),
    onBlur: () => fieldNode.markAsTouched(),
  };

  const input = <Component control={fieldNode} {...inputProps} {...handlers} />;

  // Если есть fieldWrapper, оборачиваем им
  const content = FieldWrapper ? (
    <FieldWrapper control={fieldNode} className={className} testId={testId}>
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

  // selector теперь доступен на обоих типах нод (FieldRenderNode и ContainerRenderNode)
  const { selector } = node;
  // Программное переопределение (createRenderSchema) — наивысший приоритет
  const hiddenOverride = useHiddenOverride(selector);
  const propsOverride = usePropsOverride(selector);
  // Ref из registry (если зарегистрирован через schema.node(selector).getRef())
  const overrideMaps = useContext(RenderSchemaOverrideContext);
  const nodeRef =
    selector && overrideMaps?.refRegistry.has(selector)
      ? overrideMaps.refRegistry.get(selector)
      : undefined;
  // Декларативное поведение (hideWhen) — средний приоритет
  const conditionFn = selector ? overrideMaps?.conditionRegistry.get(selector) : undefined;
  const isHiddenByBehavior = useCondition(conditionFn);
  // Итоговое: override > behavior > видимо по умолчанию
  const isHidden = hiddenOverride != null ? hiddenOverride : isHiddenByBehavior;

  // Lifecycle-хуки ноды (onInit/onDestroy)
  const lifecycleHooks = selector ? overrideMaps?.lifecycleRegistry.get(selector) : undefined;
  useNodeLifecycle(lifecycleHooks);

  if (isHidden) {
    return null;
  }

  // ========================================
  // FieldRenderNode - поле формы
  // ========================================
  if (isFieldRenderNode(node)) {
    if (!form) {
      console.warn(
        '[RenderSchema] Field node rendered without form — pass form via wizard componentProps'
      );
      return null;
    }
    const fieldPath = extractPath(node.component);
    const fieldNode = navigator.getNodeByPath(form, fieldPath) as FieldNode<unknown> | null;

    if (!fieldNode) {
      console.warn(`[RenderSchema] Field not found: ${fieldPath}`);
      return null;
    }

    const {
      className,
      wrapper,
      fieldWrapper: perFieldWrapper,
      testId: explicitTestId,
    } = node.componentProps || {};
    // Per-field wrapper имеет приоритет над глобальным
    const effectiveWrapper = perFieldWrapper ?? fieldWrapper;
    // Если testId задан явно в componentProps — используем его, иначе деривируем из path
    // (`personalData.lastName` → `personalData-lastName`). Пустой path (root) → undefined.
    const testId =
      typeof explicitTestId === 'string'
        ? explicitTestId
        : fieldPath
          ? fieldPath.replace(/\./g, '-')
          : undefined;

    return (
      <FieldRenderer
        fieldNode={fieldNode}
        className={className}
        wrapper={wrapper}
        fieldWrapper={effectiveWrapper}
        testId={testId}
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
    const propsPatched = propsOverride != null ? { ...baseProps, ...propsOverride } : baseProps;
    // Колбэки из callbackRegistry (onComponentEvent) — наивысший приоритет среди prop-overrides
    const callbackMap = selector ? overrideMaps?.callbackRegistry.get(selector) : undefined;
    const callbackOverrides = callbackMap ? Object.fromEntries(callbackMap) : {};
    const effectiveProps = callbackMap ? { ...propsPatched, ...callbackOverrides } : propsPatched;

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
          {...(nodeRef !== undefined ? { ref: nodeRef } : {})}
          children={children}
        />
      );
    }

    return (
      <Component
        {...(selector !== undefined ? { selector } : {})}
        {...effectiveProps}
        {...(nodeRef !== undefined ? { ref: nodeRef } : {})}
      >
        {children?.map((child, i) => (
          <RenderNodeComponent key={i} node={child} form={form} path={path} />
        ))}
      </Component>
    );
  }

  return null;
}

/**
 * RenderNodeComponent - рекурсивный рендеринг узлов RenderSchema
 *
 * @module reformer/renderer-react/render-node
 */

import { memo, useSyncExternalStore, type ReactNode } from 'react';
import { effect } from '@preact/signals-core';
import type { FieldNode, FormProxy, FieldPath } from '@reformer/core';
import { FieldPathNavigator, useFormControl, extractPath, getNodeForSignal } from '@reformer/core';
import type {
  RenderNode,
  FieldWrapperProps,
  ModelFieldRenderNode,
  ArrayRenderNode,
  RenderModelArrayControl,
} from './types';
import {
  isFieldRenderNode,
  isContainerRenderNode,
  isModelFieldRenderNode,
  isArrayRenderNode,
} from './utils';
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

  // M1: component опционален в core. Поле без компонента не рендерится автоматически
  // (значение/валидация работают без UI; компонент нужен только для отрисовки).
  if (!Component) {
    if (typeof console !== 'undefined') {
      console.warn('[RenderSchema] Field has no component — nothing to render.');
    }
    return null;
  }

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

// ============================================================================
// M1: единая схема — лист на сигнале модели + массив модели
// ============================================================================

/**
 * Поле единой схемы (M1): значение из сигнала модели; state-нода резолвится по сигналу через реестр.
 * `component`/`componentProps` берутся из схемы (как в схеме формы); `fieldWrapper` оборачивает.
 */
const ModelFieldRenderer = memo(function ModelFieldRenderer({
  node,
  fieldNode,
  fieldWrapper: FieldWrapper,
}: {
  node: ModelFieldRenderNode;
  fieldNode: FieldNode<unknown>;
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
}): ReactNode {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state = useFormControl(fieldNode as FieldNode<any>);
  const Component = node.component;
  if (!Component) {
    if (typeof console !== 'undefined') {
      console.warn('[RenderSchema] Model field has no component — nothing to render.');
    }
    return null;
  }

  const {
    className,
    wrapper: Wrapper = 'div',
    fieldWrapper: perFieldWrapper,
    testId: explicitTestId,
    ...inputComponentProps
  } = node.componentProps ?? {};

  // testId: явный из схемы, иначе из пути сигнала (`personalData.lastName` → `personalData-lastName`).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const path = (node.value as any).__path as string | undefined;
  const testId =
    typeof explicitTestId === 'string'
      ? explicitTestId
      : path
        ? path.replace(/\./g, '-')
        : undefined;

  const inputProps: Record<string, unknown> = {
    value: state.value,
    disabled: state.disabled,
    ...inputComponentProps,
  };
  if (testId && inputProps['data-testid'] === undefined) {
    inputProps['data-testid'] = `input-${testId}`;
  }

  const input = (
    <Component
      control={fieldNode}
      {...inputProps}
      onChange={(value: unknown) => fieldNode.setValue(value as never)}
      onBlur={() => fieldNode.markAsTouched()}
    />
  );

  const EffectiveWrapper = perFieldWrapper ?? FieldWrapper;
  return EffectiveWrapper ? (
    <EffectiveWrapper control={fieldNode} className={className} testId={testId}>
      {input}
    </EffectiveWrapper>
  ) : (
    <Wrapper className={className}>{input}</Wrapper>
  );
});

/** Реактивная подписка на длину массива модели (ре-рендер при push/removeAt). SSR-safe. */
function useModelArrayLength(control: RenderModelArrayControl): number {
  return useSyncExternalStore(
    (cb) =>
      effect(() => {
        void control.length;
        cb();
      }),
    () => control.length,
    () => control.length
  );
}

// Стабильный React-ключ по идентичности под-модели элемента (фасад кэшируется в core).
const itemKeys = new WeakMap<object, number>();
let keyCounter = 0;
function stableKey(item: unknown): number {
  if (item == null || typeof item !== 'object') return keyCounter++;
  let k = itemKeys.get(item as object);
  if (k === undefined) {
    k = keyCounter++;
    itemKeys.set(item as object, k);
  }
  return k;
}

const resolveInitial = (init: ArrayRenderNode<unknown>['initialValue']): unknown =>
  typeof init === 'function' ? (init as () => unknown)() : init;

/**
 * Секция массива единой схемы (M1): данные принадлежат модели (`node.array`), поддерево элемента
 * строит `node.item(itemModel)` и рендерит {@link RenderNodeComponent} (листья на сигналах под-модели
 * резолвятся через реестр — per-item формы создаёт `ModelArrayNode`, материализованный `createForm`).
 * Оформление совместимо с `FormArraySection` (карточки/кнопки/empty), поддерживает `fieldWrapper`.
 */
const ModelArraySectionRenderer = memo(function ModelArraySectionRenderer({
  node,
  fieldWrapper,
}: {
  node: ArrayRenderNode<unknown>;
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
}): ReactNode {
  const control = node.array;
  const length = useModelArrayLength(control);
  const cp = node.componentProps ?? {};
  const {
    title,
    addButtonLabel = '+ Добавить',
    removeButtonLabel = 'Удалить',
    emptyMessage,
    itemLabel,
    className = 'space-y-3 mt-2',
    cardClassName = 'mb-4 p-4 bg-white rounded border',
  } = cp;

  const getItemLabel = (im: unknown, index: number): string =>
    typeof itemLabel === 'function'
      ? itemLabel(im, index)
      : `${(itemLabel as string) ?? title ?? 'Элемент'} #${index + 1}`;

  const addBtnClass =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2';
  const removeBtnClass =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-destructive text-destructive-foreground shadow hover:bg-destructive/90 h-9 px-4 py-2';

  const addButton = (cls: string) => (
    <button
      type="button"
      data-testid="array-add"
      className={cls}
      onClick={() => control.push(resolveInitial(node.initialValue))}
    >
      {addButtonLabel}
    </button>
  );

  return (
    <section className={className}>
      {title ? (
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          {addButton(addBtnClass)}
        </div>
      ) : null}

      {Array.from({ length }, (_, i) => {
        const im = control.at(i);
        const subtree = node.item(im) as RenderNode<unknown>;
        const showRemove = length > 1;
        return (
          <div key={stableKey(im)} className={cardClassName} data-testid={`array-item-${i}`}>
            {title || itemLabel ? (
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium">{getItemLabel(im, i)}</h4>
                {showRemove ? (
                  <button
                    type="button"
                    data-testid={`array-item-${i}-remove`}
                    className={removeBtnClass}
                    onClick={() => control.removeAt(i)}
                  >
                    {removeButtonLabel}
                  </button>
                ) : null}
              </div>
            ) : null}
            <RenderNodeComponent node={subtree} fieldWrapper={fieldWrapper} />
          </div>
        );
      })}

      {length === 0 && emptyMessage ? (
        <div className="p-4 bg-gray-100 border border-gray-300 rounded text-center text-gray-600">
          {emptyMessage}
        </div>
      ) : null}

      {!title ? (
        <div>{addButton('text-sm text-blue-600 hover:text-blue-700 hover:underline')}</div>
      ) : null}
    </section>
  );
});

/**
 * Рекурсивный рендеринг узла `RenderSchema`. Определяет тип узла и рендерит
 * соответственно: `FieldRenderNode` → компонент поля с wrapper,
 * `ContainerRenderNode` → контейнер с дочерними узлами. Используется
 * `FormRenderer`; явный вызов нужен при ручной композиции.
 *
 * @example
 * ```tsx
 * import { RenderNodeComponent } from '@reformer/renderer-react';
 *
 * <RenderContextProvider value={{ settings: { fieldWrapper: FormField } }}>
 *   <RenderNodeComponent node={rootNode} />
 * </RenderContextProvider>
 * ```
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
  // M1: ModelFieldRenderNode — лист на сигнале модели
  // ========================================
  if (isModelFieldRenderNode(node)) {
    const fieldNode = getNodeForSignal(node.value) as FieldNode<unknown> | undefined;
    if (!fieldNode) {
      if (typeof console !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = (node.value as any).__path;
        console.warn(
          `[RenderSchema] No form node for signal${p ? ` "${p}"` : ''} — render value-leaf after createForm.`
        );
      }
      return null;
    }
    return <ModelFieldRenderer node={node} fieldNode={fieldNode} fieldWrapper={fieldWrapper} />;
  }

  // ========================================
  // M1: ArrayRenderNode — массив модели { array, item }
  // ========================================
  if (isArrayRenderNode(node)) {
    return <ModelArraySectionRenderer node={node} fieldWrapper={fieldWrapper} />;
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
    // form пробрасывается в self-managed компоненты как prop, чтобы они могли
    // вызывать `<RenderNodeComponent form={form} ...>` для своих дочерних узлов
    // (используется в RendererFormArraySection, RendererFormWizard и т.п.).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((Component as any).__selfManagedChildren === true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SelfManagedComponent = Component as React.ComponentType<any>;
      // Не перетираем form, если уже задан в componentProps (orchestrator-инжект).
      const formProp =
        (effectiveProps as Record<string, unknown>).form === undefined && form !== undefined
          ? { form }
          : {};
      // children: предпочитаем node.children (если есть). Иначе fallback на
      // componentProps.children (некоторые компоненты, напр. FormRoot из page 2 v4,
      // передают raw RenderNode[] через componentProps).
      const childrenProp = children !== undefined ? { children } : {};
      return (
        <SelfManagedComponent
          {...(selector !== undefined ? { selector } : {})}
          {...effectiveProps}
          {...formProp}
          {...(nodeRef !== undefined ? { ref: nodeRef } : {})}
          {...childrenProp}
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

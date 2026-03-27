/**
 * NavigationRenderer - рендеринг NavigationRenderNode через FormNavigation
 *
 * Компонент преобразует декларативную схему навигации в compound components
 * FormNavigation.
 *
 * @module form-navigation/NavigationRenderer
 */

import { useMemo, useRef, type ReactNode, type ComponentType } from 'react';
import {
  type FormProxy,
  type FieldPath,
  type NavigationRenderNode,
  type RenderNode,
  type FieldWrapperProps,
  RenderNodeComponent,
} from '@reformer/core';
import { FormNavigation } from './FormNavigation';
import type { FormNavigationHandle, FormNavigationConfig } from './types';

/**
 * Props для NavigationRenderer
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface NavigationRendererProps<T extends Record<string, any>> {
  /** Узел навигации из RenderSchema */
  node: NavigationRenderNode<T>;
  /** Proxy формы */
  form: FormProxy<T>;
  /** FieldPath для доступа к полям */
  path: FieldPath<T>;
  /** Компонент-обёртка для полей */
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
}

/**
 * Props для StepContentRenderer (передаются через FormNavigation.Step)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface StepContentRendererProps<T extends Record<string, any>> {
  control: FormProxy<T>;
  stepChildren: RenderNode<T>[];
  stepForm: FormProxy<T>;
  stepPath: FieldPath<T>;
  stepFieldWrapper?: ComponentType<FieldWrapperProps>;
}

/**
 * Компонент для рендеринга содержимого шага
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StepContentRenderer<T extends Record<string, any>>({
  stepChildren,
  stepForm,
  stepPath,
  stepFieldWrapper,
}: StepContentRendererProps<T>): ReactNode {
  return (
    <>
      {stepChildren.map((child, idx) => (
        <RenderNodeComponent
          key={idx}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          node={child as RenderNode<any>}
          form={stepForm}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          path={stepPath as FieldPath<any>}
          fieldWrapper={stepFieldWrapper}
        />
      ))}
    </>
  );
}

/**
 * Парсит номер шага из селектора 'step:N'
 */
function parseStepNumber(selector: string): number | null {
  const match = selector.match(/^step:(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * NavigationRenderer - рендеринг NavigationRenderNode
 *
 * Преобразует декларативную схему в FormNavigation compound components:
 * - 'indicator' → FormNavigation.Indicator
 * - 'step:N' → FormNavigation.Step
 * - 'actions' → FormNavigation.Actions
 * - 'progress' → FormNavigation.Progress
 *
 * @example
 * ```tsx
 * <NavigationRenderer
 *   node={navigationNode}
 *   form={form}
 *   path={path}
 *   fieldWrapper={FormField}
 * />
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function NavigationRenderer<T extends Record<string, any>>({
  node,
  form,
  path,
  fieldWrapper,
}: NavigationRendererProps<T>): ReactNode {
  const {
    steps,
    stepValidations,
    fullValidation,
    children,
    onSubmit,
    onStepChange,
    scrollToTop,
    className,
  } = node.componentProps;

  const navRef = useRef<FormNavigationHandle<T>>(null);

  // Конфигурация навигации
  const navConfig: FormNavigationConfig<T> = useMemo(
    () => ({
      stepValidations: stepValidations || {},
      fullValidation: fullValidation || (() => ({})),
    }),
    [stepValidations, fullValidation]
  );

  // Группируем children по селекторам
  const indicatorNode = children.find((c: { selector: string }) => c.selector === 'indicator');
  const actionsNode = children.find((c: { selector: string }) => c.selector === 'actions');
  const progressNode = children.find((c: { selector: string }) => c.selector === 'progress');
  const stepNodes = children
    .filter((c: { selector: string }) => c.selector.startsWith('step:'))
    .sort((a: { selector: string }, b: { selector: string }) => {
      const aNum = parseStepNumber(a.selector) || 0;
      const bNum = parseStepNumber(b.selector) || 0;
      return aNum - bNum;
    });

  // Обработчик отправки
  const handleSubmit = useMemo(() => {
    if (!onSubmit) return undefined;
    return async () => {
      await navRef.current?.submit(async (values: T) => {
        await onSubmit(values);
      });
    };
  }, [onSubmit]);

  return (
    <FormNavigation
      ref={navRef}
      form={form}
      config={navConfig}
      onStepChange={onStepChange}
      scrollToTop={scrollToTop}
    >
      {/* Indicator */}
      {indicatorNode && (
        <FormNavigation.Indicator steps={steps}>
          {(indicatorProps) => {
            const IndicatorComponent = indicatorNode.component;
            if (!IndicatorComponent) return null;
            // Exclude children/hidden from componentProps to avoid type conflicts
            const {
              className: indicatorClassName,
              children: _indicatorChildren, // eslint-disable-line @typescript-eslint/no-unused-vars
              hidden: _indicatorHidden, // eslint-disable-line @typescript-eslint/no-unused-vars
              ...restProps
            } = indicatorNode.componentProps || {};
            return (
              <IndicatorComponent
                className={indicatorClassName}
                {...restProps}
                {...indicatorProps}
              />
            );
          }}
        </FormNavigation.Indicator>
      )}

      {/* Steps */}
      <div className={className}>
        {stepNodes.map((stepNode: { selector: string; children?: RenderNode<T>[] }) => (
          <FormNavigation.Step
            key={stepNode.selector}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            component={StepContentRenderer as ComponentType<any>}
            control={form}
            stepChildren={stepNode.children || []}
            stepForm={form}
            stepPath={path}
            stepFieldWrapper={fieldWrapper}
          />
        ))}
      </div>

      {/* Actions */}
      {actionsNode && (
        <FormNavigation.Actions onSubmit={handleSubmit}>
          {(actionsProps) => {
            const ActionsComponent = actionsNode.component;
            if (!ActionsComponent) return null;
            // Exclude children/hidden from componentProps to avoid type conflicts
            const {
              className: actionsClassName,
              children: _actionsChildren, // eslint-disable-line @typescript-eslint/no-unused-vars
              hidden: _actionsHidden, // eslint-disable-line @typescript-eslint/no-unused-vars
              ...restProps
            } = actionsNode.componentProps || {};
            return (
              <ActionsComponent className={actionsClassName} {...restProps} {...actionsProps} />
            );
          }}
        </FormNavigation.Actions>
      )}

      {/* Progress */}
      {progressNode && (
        <FormNavigation.Progress>
          {(progressProps) => {
            const ProgressComponent = progressNode.component;
            if (!ProgressComponent) return null;
            // Exclude children/hidden from componentProps to avoid type conflicts
            const {
              className: progressClassName,
              children: _progressChildren, // eslint-disable-line @typescript-eslint/no-unused-vars
              hidden: _progressHidden, // eslint-disable-line @typescript-eslint/no-unused-vars
              ...restProps
            } = progressNode.componentProps || {};
            return (
              <ProgressComponent className={progressClassName} {...restProps} {...progressProps} />
            );
          }}
        </FormNavigation.Progress>
      )}
    </FormNavigation>
  );
}

NavigationRenderer.displayName = 'NavigationRenderer';

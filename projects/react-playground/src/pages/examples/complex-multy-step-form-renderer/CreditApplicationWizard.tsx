/**
 * CreditApplicationWizard - пользовательский wizard-компонент для multi-step форм
 *
 * Использует headless-примитивы из @reformer/ui и контекст рендеринга из @reformer/core.
 * Может использоваться в RenderSchema как обычный ContainerRenderNode.
 *
 * Компонент устанавливает __selfManagedChildren = true, чтобы RenderNodeComponent
 * передавал children как сырые RenderNode[], а не рендерил их самостоятельно.
 * Дочерние узлы идентифицируются по полю selector на уровне ContainerRenderNode.
 */

import { type ReactNode } from 'react';
import type React from 'react';
import { type FormProxy, type FieldPath } from '@reformer/core';
import { useRenderContext, RenderNodeComponent, type RenderNode } from '@reformer/renderer-react';
import { FormNavigation, type FormNavigationConfig } from '@reformer/ui/form-navigation';
import type { CreditApplicationForm } from '../complex-multy-step-form/types/credit-application';
import { StepIndicator } from '../complex-multy-step-form/components/ui/StepIndicator';
import { NavigationActions } from '../complex-multy-step-form/components/ui/NavigationActions';
import { NavigationProgress } from '../complex-multy-step-form/components/ui/NavigationProgress';

interface WizardNodeProps {
  title?: string;
  icon?: string;
  className?: string;
  [key: string]: unknown;
}

interface WizardRenderNode {
  selector?: string;
  component: React.ComponentType<WizardNodeProps>;
  componentProps?: WizardNodeProps;
}

interface CreditApplicationWizardProps {
  /** Selector-based children (indicator, step:N, actions, progress) */
  children?: WizardRenderNode[];
  /** Валидация по шагам */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stepValidations?: Record<number, any>;
  /** Полная валидация при отправке */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fullValidation?: any;
  /** Callback при отправке */
  onSubmit?: (values: CreditApplicationForm) => Promise<void> | void;
  /** Callback при смене шага */
  onStepChange?: (step: number) => void;
  /** Прокрутка вверх при смене шага */
  scrollToTop?: boolean;
  /** CSS класс для контейнера шагов */
  className?: string;
}

const parseStepNum = (selector: string) => parseInt(selector.split(':')[1], 10);

export function CreditApplicationWizard({
  children = [],
  stepValidations,
  fullValidation,
  onSubmit,
  onStepChange,
  scrollToTop = true,
  className,
}: CreditApplicationWizardProps): ReactNode {
  const { form, path, fieldWrapper } = useRenderContext<CreditApplicationForm>();

  // Разбираем RenderNode[] по полю selector
  const indicatorNode = children.find((c) => c.selector === 'indicator');
  const stepNodes = children
    .filter((c) => typeof c.selector === 'string' && c.selector.startsWith('step:'))
    .sort((a, b) => parseStepNum(a.selector!) - parseStepNum(b.selector!));
  const actionsNode = children.find((c) => c.selector === 'actions');
  const progressNode = children.find((c) => c.selector === 'progress');

  // Метаданные шагов из componentProps
  const steps = stepNodes.map((node) => ({
    number: parseStepNum(node.selector!),
    title: node.componentProps?.title || `Step ${parseStepNum(node.selector!)}`,
    icon: node.componentProps?.icon,
  }));

  const config: FormNavigationConfig<CreditApplicationForm> = {
    stepValidations: stepValidations || {},
    fullValidation: fullValidation || (() => ({})),
  };

  const renderNode = (node: WizardRenderNode) => (
    <RenderNodeComponent
      node={node as RenderNode<CreditApplicationForm>}
      form={form as FormProxy<CreditApplicationForm>}
      path={path as FieldPath<CreditApplicationForm>}
      fieldWrapper={fieldWrapper}
    />
  );

  return (
    <FormNavigation
      form={form as FormProxy<CreditApplicationForm>}
      config={config}
      onStepChange={onStepChange}
      scrollToTop={scrollToTop}
    >
      {/* Indicator */}
      {indicatorNode && (
        <FormNavigation.Indicator steps={steps}>
          {(indicatorProps) => {
            const IndicatorComponent = indicatorNode.component || StepIndicator;
            const { className: indicatorClassName, ...restProps } =
              indicatorNode.componentProps || {};
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
        {stepNodes.map((stepNode) => (
          <FormNavigation.Step key={stepNode.selector}>{renderNode(stepNode)}</FormNavigation.Step>
        ))}
      </div>

      {/* Actions */}
      {actionsNode && (
        <FormNavigation.Actions onSubmit={onSubmit ? () => form.submit(onSubmit) : undefined}>
          {(actionsProps) => {
            const ActionsComponent = actionsNode.component || NavigationActions;
            const { className: actionsClassName, ...restProps } = actionsNode.componentProps || {};
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
            const ProgressComponent = progressNode.component || NavigationProgress;
            const { className: progressClassName, ...restProps } =
              progressNode.componentProps || {};
            return (
              <ProgressComponent className={progressClassName} {...restProps} {...progressProps} />
            );
          }}
        </FormNavigation.Progress>
      )}
    </FormNavigation>
  );
}

CreditApplicationWizard.displayName = 'CreditApplicationWizard';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(CreditApplicationWizard as any).__selfManagedChildren = true;

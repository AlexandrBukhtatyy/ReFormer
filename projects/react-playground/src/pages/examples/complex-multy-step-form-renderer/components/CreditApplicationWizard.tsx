/**
 * CreditApplicationWizard - пользовательский wizard-компонент для multi-step форм
 *
 * Использует headless-примитивы из @reformer/ui и контекст рендеринга из @reformer/core.
 * Может использоваться в RenderSchema как обычный ContainerRenderNode.
 */

import { type ReactNode } from 'react';
import {
  useRenderContext,
  RenderNodeComponent,
  type RenderNode,
  type FormProxy,
  type FieldPath,
} from '@reformer/core';
import {
  FormNavigation,
  useNavigationSelectors,
  type WizardSelectorNode,
  type FormNavigationConfig,
} from '@reformer/ui/form-navigation';
import type { CreditApplicationForm } from '../../complex-multy-step-form/types/credit-application';
import { StepIndicator } from '../../complex-multy-step-form/components/ui/StepIndicator';
import { NavigationActions } from '../../complex-multy-step-form/components/ui/NavigationActions';
import { NavigationProgress } from '../../complex-multy-step-form/components/ui/NavigationProgress';

/**
 * Props для CreditApplicationWizard
 *
 * Использует `items` вместо `children` для selector-based узлов,
 * чтобы избежать конфликта с типом ContainerRenderNodeProps.
 */
interface CreditApplicationWizardProps {
  /** Selector-based items (indicator, step:N, actions, progress) */
  items?: WizardSelectorNode<CreditApplicationForm>[];
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
  /** React children (для совместимости с ContainerComponentProps) */
  children?: React.ReactNode;
}

/**
 * CreditApplicationWizard - wizard-компонент для кредитной заявки
 *
 * @example
 * ```tsx
 * // В схеме
 * {
 *   component: CreditApplicationWizard,
 *   componentProps: {
 *     stepValidations: STEP_VALIDATIONS,
 *     fullValidation: creditApplicationValidation,
 *     onSubmit: handleSubmit,
 *     className: 'bg-white p-8 rounded-lg shadow-md',
 *     children: [
 *       { selector: 'indicator', component: StepIndicator },
 *       {
 *         selector: 'step:1',
 *         component: Step,
 *         componentProps: { title: 'Кредит', icon: '💰' },
 *         children: [...]
 *       },
 *       { selector: 'actions', component: NavigationActions },
 *     ],
 *   },
 * }
 * ```
 */
export function CreditApplicationWizard({
  items = [],
  stepValidations,
  fullValidation,
  onSubmit,
  onStepChange,
  scrollToTop = true,
  className,
}: CreditApplicationWizardProps): ReactNode {
  // Получаем контекст рендеринга из FormRenderer
  const { form, path, fieldWrapper } = useRenderContext<CreditApplicationForm>();

  // Парсим selector-based items
  const { indicator, stepNodes, steps, actions, progress } = useNavigationSelectors(items);

  // Конфигурация навигации
  const config: FormNavigationConfig<CreditApplicationForm> = {
    stepValidations: stepValidations || {},
    fullValidation: fullValidation || (() => ({})),
  };

  return (
    <FormNavigation
      form={form as FormProxy<CreditApplicationForm>}
      config={config}
      onStepChange={onStepChange}
      scrollToTop={scrollToTop}
    >
      {/* Indicator */}
      {indicator && (
        <FormNavigation.Indicator steps={steps}>
          {(indicatorProps) => {
            const IndicatorComponent = indicator.component || StepIndicator;
            const { className: indicatorClassName, ...restProps } = indicator.componentProps || {};
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
          <FormNavigation.Step key={stepNode.selector}>
            {stepNode.children?.map((child, i) => (
              <RenderNodeComponent
                key={i}
                node={child as RenderNode<CreditApplicationForm>}
                form={form as FormProxy<CreditApplicationForm>}
                path={path as FieldPath<CreditApplicationForm>}
                fieldWrapper={fieldWrapper}
              />
            ))}
          </FormNavigation.Step>
        ))}
      </div>

      {/* Actions */}
      {actions && (
        <FormNavigation.Actions onSubmit={onSubmit}>
          {(actionsProps) => {
            const ActionsComponent = actions.component || NavigationActions;
            const { className: actionsClassName, ...restProps } = actions.componentProps || {};
            return (
              <ActionsComponent className={actionsClassName} {...restProps} {...actionsProps} />
            );
          }}
        </FormNavigation.Actions>
      )}

      {/* Progress */}
      {progress && (
        <FormNavigation.Progress>
          {(progressProps) => {
            const ProgressComponent = progress.component || NavigationProgress;
            const { className: progressClassName, ...restProps } = progress.componentProps || {};
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

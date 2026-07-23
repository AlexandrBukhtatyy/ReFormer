/**
 * StepIndicator — визуальная цепочка шагов с иконками и навигацией.
 *
 * Получает props через render-prop API из `<FormWizard.Indicator>` слота.
 * Aria-метки опциональные с Russian-дефолтами.
 */

import type { FC } from 'react';
import type {
  FormWizardIndicatorStepWithState,
  FormWizardIndicatorRenderProps,
} from '@reformer/cdk/form-wizard';

/**
 * Пропсы {@link StepIndicator}: render-props индикатора из слота
 * `<FormWizard.Indicator>` (`steps` со статусами, `goToStep`) плюс `className`
 * и настройка aria-меток.
 */
export interface StepIndicatorProps extends FormWizardIndicatorRenderProps {
  /** Внешний CSS-класс контейнера. */
  className?: string;
  /** Aria-label контейнера навигации. По умолчанию «Шаги формы». */
  navAriaLabel?: string;
  /** Кастомный шаблон aria-label для шага. Получает {step}. */
  stepAriaLabel?: (step: FormWizardIndicatorStepWithState) => string;
}

const defaultStepAriaLabel = (step: FormWizardIndicatorStepWithState): string =>
  `Шаг ${step.number}: ${step.title}` +
  (step.isCurrent ? ' (текущий)' : '') +
  (step.isCompleted ? ' (завершён)' : '');

/**
 * Визуальная цепочка шагов wizard'а — иконки, заголовки и соединительные линии
 * с подсветкой текущего / завершённого шага. Клик (и Enter) по доступному шагу
 * вызывает `goToStep`; недоступные шаги приглушены и не кликабельны. Разметка
 * доступна для скринридеров (`role="navigation"`, `aria-current="step"`,
 * настраиваемые aria-метки).
 *
 * Рендерится из headless-слота `<FormWizard.Indicator>` через render-prop
 * (`steps` со статусами и `goToStep` приходят автоматически). Готовый
 * {@link FormWizard} уже подключает этот компонент; напрямую нужен только для
 * кастомной раскладки.
 *
 * @example Индикатор с кастомной aria-меткой контейнера
 * ```tsx
 * <FormWizard.Indicator steps={steps}>
 *   {(indicator) => (
 *     <StepIndicator {...indicator} navAriaLabel="Этапы заявки" className="mb-8" />
 *   )}
 * </FormWizard.Indicator>
 * ```
 */
export const StepIndicator: FC<StepIndicatorProps> = ({
  steps,
  goToStep,
  className,
  navAriaLabel = 'Шаги формы',
  stepAriaLabel = defaultStepAriaLabel,
}) => {
  const getStepClasses = (step: FormWizardIndicatorStepWithState) => {
    if (step.isCurrent) return 'bg-primary text-primary-foreground';
    if (step.isCompleted) return 'text-green-500 hover:bg-accent';
    if (step.canNavigate) return 'hover:bg-accent';
    return 'opacity-50';
  };

  return (
    <div
      data-slot="step-indicator"
      className={`flex items-center justify-between p-4 bg-muted rounded-lg ${className || ''}`}
      data-testid="step-indicator"
      role="navigation"
      aria-label={navAriaLabel}
    >
      {steps.map((step: FormWizardIndicatorStepWithState, index: number) => (
        <div key={step.number} className="flex items-center flex-1">
          <div
            className={`flex items-center gap-2 p-3 rounded-lg transition-all ${getStepClasses(step)} ${step.canNavigate ? 'cursor-pointer' : 'cursor-not-allowed'}`}
            onClick={() => step.canNavigate && goToStep(step.number)}
            onKeyDown={(e) => e.key === 'Enter' && step.canNavigate && goToStep(step.number)}
            data-testid={`step-indicator-${step.number}`}
            data-step-number={step.number}
            data-step-current={step.isCurrent}
            data-step-completed={step.isCompleted}
            data-step-can-navigate={step.canNavigate}
            role="button"
            aria-label={stepAriaLabel(step)}
            aria-current={step.isCurrent ? 'step' : undefined}
            tabIndex={step.canNavigate ? 0 : -1}
          >
            <div className="text-2xl" aria-hidden="true">
              {step.isCompleted ? '✓' : step.icon}
            </div>
            <div className="text-sm font-semibold">{step.title}</div>
            <div className="text-sm">{step.number}</div>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-2 ${step.isCompleted ? 'bg-green-500' : 'bg-border'}`}
              aria-hidden="true"
            />
          )}
        </div>
      ))}
    </div>
  );
};

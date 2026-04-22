/**
 * StepIndicator - компонент индикатора шагов для renderSchema
 *
 * Получает props от FormWizard.Indicator через render props.
 */

import type { FC } from 'react';
import type {
  FormWizardIndicatorStepWithState,
  FormWizardIndicatorRenderProps,
} from '@reformer/cdk/form-wizard';

interface StepIndicatorProps extends FormWizardIndicatorRenderProps {
  className?: string;
}

export const StepIndicator: FC<StepIndicatorProps> = ({ steps, goToStep, className }) => {
  const getStepClasses = (step: FormWizardIndicatorStepWithState) => {
    if (step.isCurrent) return 'bg-blue-500 text-white';
    if (step.isCompleted) return 'text-green-500 hover:bg-gray-200';
    if (step.canNavigate) return 'hover:bg-gray-200';
    return 'opacity-50';
  };

  return (
    <div
      className={`flex items-center justify-between p-4 bg-gray-100 rounded-lg ${className || ''}`}
      data-testid="step-indicator"
      role="navigation"
      aria-label="Form steps"
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
            aria-label={`Step ${step.number}: ${step.title}${step.isCurrent ? ' (current)' : ''}${step.isCompleted ? ' (completed)' : ''}`}
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
              className={`flex-1 h-0.5 mx-2 ${step.isCompleted ? 'bg-green-500' : 'bg-gray-300'}`}
              aria-hidden="true"
            />
          )}
        </div>
      ))}
    </div>
  );
};

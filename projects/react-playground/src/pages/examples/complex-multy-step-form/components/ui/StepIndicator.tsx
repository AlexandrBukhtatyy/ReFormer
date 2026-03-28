/**
 * StepIndicator - компонент индикатора шагов для renderSchema
 *
 * Получает props от FormNavigation.Indicator через render props.
 */

import type { FC } from 'react';
import type {
  FormNavigationIndicatorStepWithState,
  FormNavigationIndicatorRenderProps,
} from '@reformer/ui/form-navigation';

interface StepIndicatorProps extends FormNavigationIndicatorRenderProps {
  className?: string;
}

export const StepIndicator: FC<StepIndicatorProps> = ({ steps, goToStep, className }) => {
  return (
    <div
      className={`flex items-center justify-between p-4 bg-gray-100 rounded-lg ${className || ''}`}
    >
      {steps.map((step: FormNavigationIndicatorStepWithState, index: number) => (
        <div key={step.number} className="flex items-center flex-1">
          <div
            className={`flex items-center gap-2 p-3 rounded-lg transition-all cursor-pointer
              ${step.isCurrent ? 'bg-blue-500 text-white' : ''}
              ${step.isCompleted && !step.isCurrent ? 'text-green-500' : ''}
              ${step.canNavigate ? 'hover:bg-gray-200' : 'cursor-not-allowed opacity-50'}
            `}
            onClick={() => step.canNavigate && goToStep(step.number)}
          >
            <div className="text-2xl">{step.isCompleted ? '✓' : step.icon}</div>
            <div className="text-xs font-medium">{step.title}</div>
            <div className="text-xs opacity-70">{step.number}</div>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-2 ${step.isCompleted ? 'bg-green-500' : 'bg-gray-300'}`}
            />
          )}
        </div>
      ))}
    </div>
  );
};

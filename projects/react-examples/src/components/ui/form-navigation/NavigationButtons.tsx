/**
 * NavigationButtons - компонент навигации для multi-step форм
 *
 * Работает с новым API (useStepForm хук)
 */

import { Button } from '../button';

interface NavigationButtonsProps {
  /** Текущий шаг (1-based) */
  currentStep: number;

  /** Общее количество шагов */
  totalSteps: number;

  /** Отправляется ли форма */
  isSubmitting: boolean;

  /** Обработчик перехода на следующий шаг */
  onNext: () => void;

  /** Обработчик перехода на предыдущий шаг */
  onPrevious: () => void;

  /** Обработчик отправки формы */
  onSubmit: () => void;
}

export function NavigationButtons({
  currentStep,
  totalSteps,
  isSubmitting,
  onNext,
  onPrevious,
  onSubmit,
}: NavigationButtonsProps) {
  return (
    <div className="flex gap-4 mt-8">
      {/* Кнопка "Назад" */}
      {currentStep > 1 && (
        <Button onClick={onPrevious} disabled={isSubmitting}>
          ← Назад
        </Button>
      )}

      <div className="flex-1" />

      {/* Кнопка "Далее" */}
      {currentStep < totalSteps && (
        <Button onClick={onNext} disabled={isSubmitting}>
          Далее →
        </Button>
      )}

      {/* Кнопка "Отправить" */}
      {currentStep === totalSteps && (
        <Button onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Отправка...' : 'Отправить заявку'}
        </Button>
      )}
    </div>
  );
}

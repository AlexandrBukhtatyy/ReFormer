/**
 * NavigationButtons - компонент навигации для multi-step форм
 *
 * Работает с новым API (useStepForm хук)
 */

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
        <button
          type="button"
          onClick={onPrevious}
          className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors disabled:opacity-50"
          disabled={isSubmitting}
        >
          ← Назад
        </button>
      )}

      <div className="flex-1" />

      {/* Кнопка "Далее" */}
      {currentStep < totalSteps && (
        <button
          type="button"
          onClick={onNext}
          className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50"
          disabled={isSubmitting}
        >
          Далее →
        </button>
      )}

      {/* Кнопка "Отправить" */}
      {currentStep === totalSteps && (
        <button
          type="button"
          onClick={onSubmit}
          className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Отправка...' : 'Отправить заявку'}
        </button>
      )}
    </div>
  );
}

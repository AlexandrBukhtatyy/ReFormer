/**
 * StepIndicator - индикатор прогресса для multi-step форм
 *
 * Работает с новым API (useStepForm хук)
 */

export interface StepIndicatorProps {
  /** Массив шагов с метаданными */
  steps: Array<{ number: number; title: string; icon: string }>;

  /** Текущий шаг (1-based) */
  currentStep: number;

  /** Завершенные шаги */
  completedSteps: number[];

  /** Обработчик клика по шагу */
  onStepClick: (step: number) => void;
}

export function StepIndicator({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: StepIndicatorProps) {
  // Навигация по клику на индикатор шагов
  const handleStepClick = (step: number) => {
    const canGoTo = step === 1 || completedSteps.includes(step - 1);

    if (canGoTo) {
      onStepClick(step);
    }
  };

  return (
    <div className="flex items-center justify-between mb-8 p-4 bg-gray-100 rounded-lg">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(step.number);
        const isCurrent = currentStep === step.number;
        const canClick = step.number === 1 || completedSteps.includes(step.number - 1);

        return (
          <div key={step.number} className="flex items-center flex-1">
            <div
              className={`flex items-center gap-2 p-3 rounded-lg transition-all cursor-pointer
                ${isCurrent ? 'bg-blue-500 text-white' : ''}
                ${isCompleted ? 'text-green-500' : ''}
                ${canClick ? 'hover:bg-gray-200' : 'cursor-not-allowed opacity-50'}
              `}
              onClick={() => handleStepClick(step.number)}
            >
              <div className="text-2xl">{isCompleted ? '✓' : step.icon}</div>
              <div className="text-xs font-medium">{step.title}</div>
              <div className="text-xs opacity-70">{step.number}</div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

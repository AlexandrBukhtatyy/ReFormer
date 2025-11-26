---
sidebar_position: 7
---

# Многошаговая отправка

Реализация многошагового рабочего процесса формы с пошаговой валидацией и проверкой.

## Обзор

Многошаговые формы разбивают сложные формы на управляемые разделы:

- **Навигация по шагам** - Перемещение между разделами формы
- **Валидация каждого шага** - Валидировать каждый шаг перед продолжением
- **Отслеживание прогресса** - Показать прогресс пользователя через форму
- **Страница проверки** - Предпросмотр всех данных перед отправкой
- **Редактирование из проверки** - Вернуться для редактирования конкретных разделов
- **Отправка на финальном шаге** - Отправить всю форму одновременно

## Понимание многошагового потока

### Рабочий процесс многошаговой формы

```
┌─────────────────────────────────────────┐
│      Поток многошаговой формы            │
└─────────────────────────────────────────┘

ШАГ 1: Информация о кредите
   ↓ Валидировать → Далее
ШАГ 2: Личная информация
   ↓ Валидировать → Далее
ШАГ 3: Контактная информация
   ↓ Валидировать → Далее
ШАГ 4: Информация о работе
   ↓ Валидировать → Далее
ШАГ 5: Дополнительная информация
   ↓ Валидировать → Проверка
ПРОВЕРКА: Предпросмотр всех данных
   ↓ Отправить
СЕРВЕР: Обработать заявку
   ↓ Успех
СТРАНИЦА УСПЕХА: Подтверждение
```

### Структура шагов

Наша заявка на кредит имеет 5 шагов:

```typescript
const steps = [
  {
    name: 'Информация о кредите',
    path: 'step1',
    fields: ['loanAmount', 'loanTerm', 'loanType', 'loanPurpose']
  },
  {
    name: 'Личная информация',
    path: 'step2',
    fields: ['personalData', 'passportData']
  },
  {
    name: 'Контактная информация',
    path: 'step3',
    fields: ['email', 'phoneMain', 'addresses']
  },
  {
    name: 'Работа',
    path: 'step4',
    fields: ['employmentType', 'companyName', 'monthlyIncome']
  },
  {
    name: 'Дополнительная информация',
    path: 'step5',
    fields: ['hasActiveLoan', 'hasBankruptcy', 'agreements']
  },
];
```

## Создание хука useMultiStep

Создайте хук для управления навигацией и валидацией многошаговой формы.

### Реализация хука

```typescript title="src/hooks/useMultiStep.ts"
import { useState, useCallback } from 'react';
import type { FormNode } from 'reformer';

export interface Step {
  name: string;
  path: string;
  description?: string;
}

export interface UseMultiStepResult {
  currentStep: number;
  currentStepData: Step;
  isFirstStep: boolean;
  isLastStep: boolean;
  goToStep: (step: number) => void;
  goNext: () => Promise<boolean>;
  goPrevious: () => void;
  validateCurrentStep: () => Promise<boolean>;
}

/**
 * Хук для управления навигацией многошаговой формы
 */
export function useMultiStep(
  form: FormNode,
  steps: Step[]
): UseMultiStepResult {
  const [currentStep, setCurrentStep] = useState(0);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const currentStepData = steps[currentStep];

  /**
   * Валидировать текущий шаг
   */
  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    const stepPath = steps[currentStep].path;
    const stepNode = form.group(stepPath);

    if (!stepNode) {
      console.error(`Узел шага не найден: ${stepPath}`);
      return false;
    }

    // Отметить шаг как затронутый
    stepNode.markAsTouched();

    // Валидировать шаг
    const isValid = await stepNode.validate();

    return isValid;
  }, [form, steps, currentStep]);

  /**
   * Перейти на конкретный шаг
   */
  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < steps.length) {
      setCurrentStep(step);
    }
  }, [steps]);

  /**
   * Перейти на следующий шаг (с валидацией)
   */
  const goNext = useCallback(async (): Promise<boolean> => {
    // Валидировать текущий шаг
    const isValid = await validateCurrentStep();

    if (!isValid) {
      console.log('Валидация шага не пройдена');
      return false;
    }

    // Перейти на следующий шаг
    if (!isLastStep) {
      setCurrentStep((prev) => prev + 1);
      return true;
    }

    return true;
  }, [validateCurrentStep, isLastStep]);

  /**
   * Перейти на предыдущий шаг
   */
  const goPrevious = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [isFirstStep]);

  return {
    currentStep,
    currentStepData,
    isFirstStep,
    isLastStep,
    goToStep,
    goNext,
    goPrevious,
    validateCurrentStep,
  };
}
```

## Компонент индикатора шагов

Визуальный индикатор прогресса для многошаговых форм.

### Компонент StepIndicator

```tsx title="src/components/StepIndicator.tsx"
interface StepIndicatorProps {
  steps: Array<{
    name: string;
    description?: string;
  }>;
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function StepIndicator({
  steps,
  currentStep,
  onStepClick
}: StepIndicatorProps) {
  return (
    <nav aria-label="Прогресс">
      <ol className="space-y-4 md:flex md:space-y-0 md:space-x-8">
        {steps.map((step, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;
          const isUpcoming = index > currentStep;

          return (
            <li key={step.name} className="md:flex-1">
              <button
                type="button"
                onClick={() => onStepClick?.(index)}
                disabled={isUpcoming}
                className={`
                  group flex flex-col border-l-4 py-2 pl-4 md:border-l-0 md:border-t-4 md:pl-0 md:pt-4 md:pb-0
                  ${
                    isComplete
                      ? 'border-blue-600 hover:border-blue-800'
                      : isCurrent
                      ? 'border-blue-600'
                      : 'border-gray-200'
                  }
                  ${isUpcoming ? 'cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <span
                  className={`
                    text-sm font-medium
                    ${
                      isComplete
                        ? 'text-blue-600 group-hover:text-blue-800'
                        : isCurrent
                        ? 'text-blue-600'
                        : 'text-gray-500'
                    }
                  `}
                >
                  Шаг {index + 1}
                </span>
                <span className="text-sm font-medium">{step.name}</span>
                {step.description && (
                  <span className="text-xs text-gray-500">{step.description}</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

## Компонент навигации по шагам

Кнопки навигации для перемещения между шагами.

### Компонент StepNavigation

```tsx title="src/components/StepNavigation.tsx"
interface StepNavigationProps {
  isFirstStep: boolean;
  isLastStep: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onReview?: () => void;
  loading?: boolean;
}

export function StepNavigation({
  isFirstStep,
  isLastStep,
  onPrevious,
  onNext,
  onReview,
  loading = false
}: StepNavigationProps) {
  return (
    <div className="mt-8 flex justify-between">
      {/* Кнопка назад */}
      <button
        type="button"
        onClick={onPrevious}
        disabled={isFirstStep || loading}
        className={`
          px-6 py-3 rounded-lg font-medium
          ${
            isFirstStep || loading
              ? 'invisible'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }
        `}
      >
        Назад
      </button>

      {/* Кнопка далее/проверка */}
      <button
        type="button"
        onClick={isLastStep && onReview ? onReview : onNext}
        disabled={loading}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Валидация...
          </span>
        ) : isLastStep ? (
          'Проверить заявку'
        ) : (
          'Следующий шаг'
        )}
      </button>
    </div>
  );
}
```

## Страница проверки

Предпросмотр всех данных формы перед отправкой.

## Лучшие практики

- Валидируйте каждый шаг перед продолжением
- Сохраняйте данные между шагами
- Позвольте пользователям вернуться и отредактировать предыдущие шаги
- Показывайте прогресс пользователя
- Предоставьте страницу проверки перед финальной отправкой
- Обработайте ошибки валидации для каждого шага

## Что дальше?

Вы реализовали многошаговую форму! Далее мы соединим все вместе в **полный поток отправки**.

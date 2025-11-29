---
sidebar_position: 9
---

# Навигация Multi-Step форм

Построение системы навигации multi-step формы с пошаговой валидацией.

## Обзор

В multi-step формах необходимо:

1. **Валидировать только текущий шаг** - Не показывать ошибки полей будущих шагов
2. **Сохранять полную валидацию** - Для финальной отправки
3. **Отслеживать завершенные шаги** - Разрешать навигацию только к посещенным
4. **Предоставлять методы навигации** - Вперед, Назад, Перейти к шагу

В этом разделе показано, как создать переиспользуемый компонент `StepNavigation`, который обрабатывает всю эту логику.

## Проблема

Когда валидация регистрируется при создании формы:

```typescript
createForm<CreditApplicationForm>({
  schema: creditApplicationSchema,
  behavior: creditApplicationBehaviors,
  validation: creditApplicationValidation, // Полная валидация
});
```

Вызов `form.validate()` валидирует **все поля**, включая те, что находятся на шагах, которые пользователь еще не посетил.

Нужен способ валидировать только определенные поля на каждом шаге, сохраняя полную валидацию для финальной отправки.

## Решение: `validateForm`

Функция `validateForm` позволяет валидировать форму по конкретной схеме:

```typescript
import { validateForm } from 'reformer/validators';

// Валидируем только поля шага 1
const isValid = await validateForm(form, step1LoanValidation);
```

### Как это работает

1. Создает временный контекст валидации
2. Применяет валидаторы из переданной схемы
3. Валидирует все соответствующие поля
4. Возвращает `true` если валидно, `false` если есть ошибки
5. **Не изменяет** зарегистрированную валидацию формы

Это означает, что можно использовать разные схемы для валидации шагов, сохраняя полную схему зарегистрированной.

## Конфигурация шагов

Сначала определяем схемы валидации для каждого шага:

```typescript title="src/schemas/validators/index.ts"
export { step1LoanValidation } from './loan-info';
export { step2PersonalValidation } from './personal-info';
export { step3ContactValidation } from './contact-info';
export { step4EmploymentValidation } from './employment';
export { step5AdditionalValidation } from './additional-info';
export { creditApplicationValidation } from './credit-application';
```

Затем создаем конфигурацию шагов:

```typescript title="src/forms/step-config.ts"
import type { ValidationSchemaFn } from 'reformer';
import type { CreditApplicationForm } from '@/types';

import {
  step1LoanValidation,
  step2PersonalValidation,
  step3ContactValidation,
  step4EmploymentValidation,
  step5AdditionalValidation,
  creditApplicationValidation,
} from '@/schemas/validators';

export interface StepNavigationConfig<T> {
  /** Общее количество шагов */
  totalSteps: number;

  /** Схема валидации для каждого шага */
  stepValidations: Record<number, ValidationSchemaFn<T>>;

  /** Полная схема валидации (для submit) */
  fullValidation: ValidationSchemaFn<T>;
}

export const STEP_CONFIG: StepNavigationConfig<CreditApplicationForm> = {
  totalSteps: 6,
  stepValidations: {
    1: step1LoanValidation,
    2: step2PersonalValidation,
    3: step3ContactValidation,
    4: step4EmploymentValidation,
    5: step5AdditionalValidation,
    // Шаг 6 - подтверждение, валидация не нужна
  },
  fullValidation: creditApplicationValidation,
};
```

## Создание компонента StepNavigation

### Типы

```typescript title="src/components/ui/step-navigation/types.ts"
import type { ReactNode } from 'react';
import type { GroupNodeWithControls, ValidationSchemaFn, FormValue } from 'reformer';

/**
 * Конфигурация multi-step формы
 */
export interface StepNavigationConfig<T extends Record<string, FormValue>> {
  totalSteps: number;
  stepValidations: Record<number, ValidationSchemaFn<T>>;
  fullValidation: ValidationSchemaFn<T>;
}

/**
 * Handle для внешнего доступа через ref
 */
export interface StepNavigationHandle<T extends Record<string, FormValue>> {
  /** Текущий шаг (1-based) */
  currentStep: number;

  /** Завершенные шаги */
  completedSteps: number[];

  /** Валидировать текущий шаг */
  validateCurrentStep: () => Promise<boolean>;

  /** Перейти на следующий шаг (с валидацией) */
  goToNextStep: () => Promise<boolean>;

  /** Перейти на предыдущий шаг */
  goToPreviousStep: () => void;

  /** Перейти на конкретный шаг */
  goToStep: (step: number) => boolean;

  /** Отправить форму (с полной валидацией) */
  submit: <R>(onSubmit: (values: T) => Promise<R> | R) => Promise<R | null>;

  /** Первый ли это шаг */
  isFirstStep: boolean;

  /** Последний ли это шаг */
  isLastStep: boolean;

  /** Идет ли валидация */
  isValidating: boolean;
}

/**
 * Состояние, передаваемое в render props
 */
export interface StepNavigationRenderState {
  currentStep: number;
  completedSteps: number[];
  isFirstStep: boolean;
  isLastStep: boolean;
  isValidating: boolean;
}

/**
 * Props для компонента StepNavigation
 */
export interface StepNavigationProps<T extends Record<string, FormValue>> {
  form: GroupNodeWithControls<T>;
  config: StepNavigationConfig<T>;
  children: (state: StepNavigationRenderState) => ReactNode;
  onStepChange?: (step: number) => void;
  scrollToTop?: boolean;
}
```

### Реализация

```typescript title="src/components/ui/step-navigation/StepNavigation.tsx"
import { forwardRef, useImperativeHandle, useState, useCallback, useMemo } from 'react';
import { validateForm } from 'reformer/validators';
import type { FormValue } from 'reformer';
import type {
  StepNavigationHandle,
  StepNavigationProps,
  StepNavigationRenderState,
} from './types';

function StepNavigationInner<T extends Record<string, FormValue>>(
  { form, config, children, onStepChange, scrollToTop = true }: StepNavigationProps<T>,
  ref: React.ForwardedRef<StepNavigationHandle<T>>
) {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // ============================================================================
  // Валидация текущего шага
  // ============================================================================

  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    const schema = config.stepValidations[currentStep];

    if (!schema) {
      // Нет валидации для этого шага (напр., шаг подтверждения)
      return true;
    }

    setIsValidating(true);
    try {
      return await validateForm(form, schema);
    } finally {
      setIsValidating(false);
    }
  }, [form, currentStep, config.stepValidations]);

  // ============================================================================
  // Навигация
  // ============================================================================

  const goToNextStep = useCallback(async (): Promise<boolean> => {
    const isValid = await validateCurrentStep();

    if (!isValid) {
      form.markAsTouched(); // Показать ошибки
      return false;
    }

    // Добавляем в завершенные шаги
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps((prev) => [...prev, currentStep]);
    }

    // Переходим на следующий шаг
    if (currentStep < config.totalSteps) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      onStepChange?.(nextStep);

      if (scrollToTop) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }

    return true;
  }, [validateCurrentStep, currentStep, completedSteps, config.totalSteps, form, onStepChange, scrollToTop]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      onStepChange?.(prevStep);

      if (scrollToTop) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [currentStep, onStepChange, scrollToTop]);

  const goToStep = useCallback(
    (step: number): boolean => {
      // Можно перейти на шаг 1 или если предыдущий шаг завершен
      const canGoTo = step === 1 || completedSteps.includes(step - 1);

      if (canGoTo && step >= 1 && step <= config.totalSteps) {
        setCurrentStep(step);
        onStepChange?.(step);

        if (scrollToTop) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return true;
      }

      return false;
    },
    [completedSteps, config.totalSteps, onStepChange, scrollToTop]
  );

  // ============================================================================
  // Отправка
  // ============================================================================

  const submit = useCallback(
    async <R,>(onSubmit: (values: T) => Promise<R> | R): Promise<R | null> => {
      setIsValidating(true);
      try {
        // Валидируем всю форму с полной схемой
        const isValid = await validateForm(form, config.fullValidation);

        if (!isValid) {
          form.markAsTouched();
          return null;
        }

        // Используем встроенный submit GroupNode
        return form.submit(onSubmit);
      } finally {
        setIsValidating(false);
      }
    },
    [form, config.fullValidation]
  );

  // ============================================================================
  // Вычисляемые свойства
  // ============================================================================

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === config.totalSteps;

  // ============================================================================
  // Expose через ref
  // ============================================================================

  useImperativeHandle(
    ref,
    () => ({
      currentStep,
      completedSteps,
      validateCurrentStep,
      goToNextStep,
      goToPreviousStep,
      goToStep,
      submit,
      isFirstStep,
      isLastStep,
      isValidating,
    }),
    [
      currentStep,
      completedSteps,
      validateCurrentStep,
      goToNextStep,
      goToPreviousStep,
      goToStep,
      submit,
      isFirstStep,
      isLastStep,
      isValidating,
    ]
  );

  // ============================================================================
  // Render state для children
  // ============================================================================

  const renderState: StepNavigationRenderState = useMemo(
    () => ({
      currentStep,
      completedSteps,
      isFirstStep,
      isLastStep,
      isValidating,
    }),
    [currentStep, completedSteps, isFirstStep, isLastStep, isValidating]
  );

  return <>{children(renderState)}</>;
}

// Типизированный forwardRef для generic компонента
export const StepNavigation = forwardRef(StepNavigationInner) as <
  T extends Record<string, FormValue>
>(
  props: StepNavigationProps<T> & { ref?: React.ForwardedRef<StepNavigationHandle<T>> }
) => React.ReactElement;
```

### Экспорт

```typescript title="src/components/ui/step-navigation/index.ts"
export { StepNavigation } from './StepNavigation';
export type {
  StepNavigationConfig,
  StepNavigationHandle,
  StepNavigationRenderState,
  StepNavigationProps,
} from './types';
```

## Использование StepNavigation

### Базовое использование

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo, useRef } from 'react';
import { createCreditApplicationForm } from '@/forms/createCreditApplicationForm';
import { StepNavigation, type StepNavigationHandle } from '@/components/ui/step-navigation';
import { STEP_CONFIG } from '@/forms/step-config';
import type { CreditApplicationForm } from '@/types';

// Компоненты шагов
import { BasicInfoForm } from '@/forms/steps/BasicInfoForm';
import { PersonalInfoForm } from '@/forms/steps/PersonalInfoForm';
import { ContactInfoForm } from '@/forms/steps/ContactInfoForm';
import { EmploymentForm } from '@/forms/steps/EmploymentForm';
import { AdditionalInfoForm } from '@/forms/steps/AdditionalInfoForm';
import { ConfirmationForm } from '@/forms/steps/ConfirmationForm';

export function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const navRef = useRef<StepNavigationHandle<CreditApplicationForm>>(null);

  const handleSubmit = async (values: CreditApplicationForm) => {
    console.log('Отправка:', values);
    await fetch('/api/applications', {
      method: 'POST',
      body: JSON.stringify(values),
    });
  };

  return (
    <StepNavigation ref={navRef} form={form} config={STEP_CONFIG}>
      {(state) => (
        <>
          {/* Содержимое шага */}
          {state.currentStep === 1 && <BasicInfoForm control={form} />}
          {state.currentStep === 2 && <PersonalInfoForm control={form} />}
          {state.currentStep === 3 && <ContactInfoForm control={form} />}
          {state.currentStep === 4 && <EmploymentForm control={form} />}
          {state.currentStep === 5 && <AdditionalInfoForm control={form} />}
          {state.currentStep === 6 && <ConfirmationForm control={form} />}

          {/* Кнопки навигации */}
          <div className="flex gap-4 mt-6">
            {!state.isFirstStep && (
              <button onClick={() => navRef.current?.goToPreviousStep()}>
                Назад
              </button>
            )}

            {!state.isLastStep ? (
              <button
                onClick={() => navRef.current?.goToNextStep()}
                disabled={state.isValidating}
              >
                {state.isValidating ? 'Проверка...' : 'Далее'}
              </button>
            ) : (
              <button
                onClick={() => navRef.current?.submit(handleSubmit)}
                disabled={state.isValidating}
              >
                {state.isValidating ? 'Отправка...' : 'Отправить'}
              </button>
            )}
          </div>
        </>
      )}
    </StepNavigation>
  );
}
```

### Добавление индикатора шагов

```tsx title="src/components/StepIndicator.tsx"
interface StepIndicatorProps {
  currentStep: number;
  completedSteps: number[];
  totalSteps: number;
  labels: string[];
  onStepClick: (step: number) => void;
}

export function StepIndicator({
  currentStep,
  completedSteps,
  totalSteps,
  labels,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <div className="flex gap-2 mb-6">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isActive = currentStep === step;
        const isCompleted = completedSteps.includes(step);
        const canNavigate = step === 1 || completedSteps.includes(step - 1);

        return (
          <button
            key={step}
            onClick={() => canNavigate && onStepClick(step)}
            disabled={!canNavigate}
            className={`
              px-3 py-1.5 rounded-full text-xs font-medium
              ${isActive ? 'bg-blue-600 text-white' : ''}
              ${isCompleted && !isActive ? 'bg-green-100 text-green-800' : ''}
              ${!isActive && !isCompleted ? 'bg-gray-100 text-gray-500' : ''}
              ${canNavigate ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}
            `}
          >
            {step}. {labels[i]}
          </button>
        );
      })}
    </div>
  );
}
```

Использование со StepNavigation:

```tsx
const STEP_LABELS = [
  'Кредит',
  'Личные данные',
  'Контакты',
  'Занятость',
  'Дополнительно',
  'Подтверждение',
];

<StepNavigation ref={navRef} form={form} config={STEP_CONFIG}>
  {(state) => (
    <>
      <StepIndicator
        currentStep={state.currentStep}
        completedSteps={state.completedSteps}
        totalSteps={STEP_CONFIG.totalSteps}
        labels={STEP_LABELS}
        onStepClick={(step) => navRef.current?.goToStep(step)}
      />

      {/* ... содержимое шага ... */}
    </>
  )}
</StepNavigation>
```

## API Reference

### `validateForm`

```typescript
function validateForm<T extends FormFields>(
  form: GroupNode<T>,
  schema: ValidationSchemaFn<T>
): Promise<boolean>;
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `form` | `GroupNode<T>` | Форма для валидации |
| `schema` | `ValidationSchemaFn<T>` | Схема валидации |

**Возвращает:** `Promise<boolean>` - `true` если валидно, `false` если есть ошибки

### `StepNavigationHandle`

Методы и свойства, доступные через ref:

| Свойство/Метод | Тип | Описание |
|----------------|-----|----------|
| `currentStep` | `number` | Текущий шаг (1-based) |
| `completedSteps` | `number[]` | Массив завершенных шагов |
| `isFirstStep` | `boolean` | Первый ли это шаг |
| `isLastStep` | `boolean` | Последний ли это шаг |
| `isValidating` | `boolean` | Идет ли валидация |
| `goToNextStep()` | `Promise<boolean>` | Валидировать и перейти на след. шаг |
| `goToPreviousStep()` | `void` | Перейти на предыдущий шаг |
| `goToStep(step)` | `boolean` | Перейти на конкретный шаг |
| `validateCurrentStep()` | `Promise<boolean>` | Валидировать текущий шаг |
| `submit(onSubmit)` | `Promise<R \| null>` | Полная валидация и отправка |

### `StepNavigationRenderState`

Состояние, передаваемое в функцию children:

| Свойство | Тип | Описание |
|----------|-----|----------|
| `currentStep` | `number` | Текущий шаг (1-based) |
| `completedSteps` | `number[]` | Завершенные шаги |
| `isFirstStep` | `boolean` | Первый ли это шаг |
| `isLastStep` | `boolean` | Последний ли это шаг |
| `isValidating` | `boolean` | Идет ли валидация |

## Ключевые паттерны

### 1. Ref Handle Pattern

Внешний доступ к методам компонента:

```tsx
const navRef = useRef<StepNavigationHandle<MyForm>>(null);

// Использование методов
navRef.current?.goToNextStep();
navRef.current?.submit(handleSubmit);

// Чтение состояния
const step = navRef.current?.currentStep;
```

### 2. Render Props Pattern

Состояние передается через функцию children:

```tsx
<StepNavigation ...>
  {(state) => (
    <div>Текущий шаг: {state.currentStep}</div>
  )}
</StepNavigation>
```

### 3. Изоляция валидации шагов

Каждый шаг валидируется независимо:

```typescript
// Валидация шага 1 не триггерит валидаторы шага 2
const isValid = await validateForm(form, step1LoanValidation);
```

### 4. Полная валидация при отправке

Финальная отправка использует полную схему:

```typescript
const isValid = await validateForm(form, config.fullValidation);
```

## Полный пример

Вот полный рабочий пример, объединяющий все вместе:

```tsx title="src/pages/CreditApplication.tsx"
import { useMemo, useRef } from 'react';
import { createCreditApplicationForm } from '@/forms/createCreditApplicationForm';
import { StepNavigation, type StepNavigationHandle } from '@/components/ui/step-navigation';
import { StepIndicator } from '@/components/StepIndicator';
import { STEP_CONFIG, STEP_LABELS } from '@/forms/step-config';
import type { CreditApplicationForm } from '@/types';

// Шаги
import { BasicInfoForm } from '@/forms/steps/BasicInfoForm';
import { PersonalInfoForm } from '@/forms/steps/PersonalInfoForm';
import { ContactInfoForm } from '@/forms/steps/ContactInfoForm';
import { EmploymentForm } from '@/forms/steps/EmploymentForm';
import { AdditionalInfoForm } from '@/forms/steps/AdditionalInfoForm';
import { ConfirmationForm } from '@/forms/steps/ConfirmationForm';

export default function CreditApplicationPage() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const navRef = useRef<StepNavigationHandle<CreditApplicationForm>>(null);

  const handleSubmit = async (values: CreditApplicationForm) => {
    const response = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      throw new Error('Ошибка отправки');
    }

    return response.json();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Заявка на кредит</h1>

      <StepNavigation
        ref={navRef}
        form={form}
        config={STEP_CONFIG}
        onStepChange={(step) => console.log('Шаг изменен на:', step)}
      >
        {(state) => (
          <>
            {/* Индикатор шагов */}
            <StepIndicator
              currentStep={state.currentStep}
              completedSteps={state.completedSteps}
              totalSteps={STEP_CONFIG.totalSteps}
              labels={STEP_LABELS}
              onStepClick={(step) => navRef.current?.goToStep(step)}
            />

            {/* Содержимое шага */}
            <div className="bg-white rounded-lg shadow p-6 min-h-[400px]">
              {state.currentStep === 1 && <BasicInfoForm control={form} />}
              {state.currentStep === 2 && <PersonalInfoForm control={form} />}
              {state.currentStep === 3 && <ContactInfoForm control={form} />}
              {state.currentStep === 4 && <EmploymentForm control={form} />}
              {state.currentStep === 5 && <AdditionalInfoForm control={form} />}
              {state.currentStep === 6 && <ConfirmationForm control={form} />}
            </div>

            {/* Навигация */}
            <div className="flex justify-between mt-6">
              <button
                onClick={() => navRef.current?.goToPreviousStep()}
                disabled={state.isFirstStep}
                className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
              >
                Назад
              </button>

              {!state.isLastStep ? (
                <button
                  onClick={() => navRef.current?.goToNextStep()}
                  disabled={state.isValidating}
                  className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                >
                  {state.isValidating ? 'Проверка...' : 'Далее'}
                </button>
              ) : (
                <button
                  onClick={async () => {
                    const result = await navRef.current?.submit(handleSubmit);
                    if (result) {
                      alert('Заявка успешно отправлена!');
                    }
                  }}
                  disabled={state.isValidating}
                  className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
                >
                  {state.isValidating ? 'Отправка...' : 'Отправить заявку'}
                </button>
              )}
            </div>
          </>
        )}
      </StepNavigation>
    </div>
  );
}
```

## Итоги

Компонент `StepNavigation` предоставляет:

- **Пошаговую валидацию** с использованием `validateForm`
- **Отслеживание прогресса** через завершенные шаги
- **Управление навигацией** через ref handle pattern
- **Render props** для гибкого UI

Ключевые преимущества:

1. **Разделение ответственности** - Логика валидации в схемах, навигация в компоненте
2. **Переиспользуемость** - Работает с любой формой с пошаговой валидацией
3. **Типобезопасность** - Полная поддержка TypeScript с дженериками
4. **Гибкость** - Рендеринг любого UI через функцию children

## Что дальше?

Теперь, когда валидация и навигация готовы, следующие разделы охватывают:

- **Data Flow** - Загрузка, сохранение и сброс данных формы
- **Submission** - Обработка отправки формы, ошибок и повторных попыток

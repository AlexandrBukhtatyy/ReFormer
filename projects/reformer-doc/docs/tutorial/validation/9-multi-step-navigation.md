---
sidebar_position: 9
---

# Навигация в многошаговых формах

Использование компонента `FormNavigation` из `@reformer/ui` для многошагового мастера форм с пошаговой валидацией.

## Обзор

В многошаговых формах нам нужно:

1. **Валидировать только текущий шаг** — не показывать ошибки для полей будущих шагов
2. **Сохранять полную валидацию** — для финальной отправки
3. **Отслеживать завершённые шаги** — разрешать навигацию только к посещённым шагам
4. **Предоставлять методы навигации** — Далее, Назад, Перейти к шагу

Пакет `@reformer/ui` предоставляет `FormNavigation` — headless compound component, который обрабатывает всю эту логику.

## Установка

```bash
npm install @reformer/ui
```

## Проблема

При регистрации валидации при создании формы:

```typescript
createForm<CreditApplicationForm>({
  schema: creditApplicationSchema,
  behavior: creditApplicationBehaviors,
  validation: creditApplicationValidation, // Полная валидация
});
```

Вызов `form.validate()` валидирует **все поля**, включая те, что на шагах, до которых пользователь ещё не дошёл.

Нам нужен способ валидировать только определённые поля на каждом шаге, сохраняя полную валидацию для финальной отправки.

## Решение: FormNavigation

`FormNavigation` из `@reformer/ui` предоставляет:

- **Пошаговую валидацию** через `validateForm` внутри
- **Отслеживание прогресса** с завершёнными шагами
- **Headless compound components** для гибкого UI
- **Ref handle** для программной навигации

## Конфигурация шагов

Сначала определите схемы валидации для каждого шага:

```typescript title="src/forms/credit-application/steps/*/validators.ts"
export { loanValidation } from './loan-info/validators';
export { personalValidation } from './personal-info/validators';
export { contactValidation } from './contact-info/validators';
export { employmentValidation } from './employment/validators';
export { additionalValidation } from './additional-info/validators';
```

Затем определите метаданные шагов:

```typescript title="src/forms/credit-application/CreditApplicationForm.tsx"
const STEPS = [
  { number: 1, title: 'Кредит', icon: '💰' },
  { number: 2, title: 'Личные данные', icon: '👤' },
  { number: 3, title: 'Контакты', icon: '📞' },
  { number: 4, title: 'Занятость', icon: '💼' },
  { number: 5, title: 'Дополнительно', icon: '📋' },
  { number: 6, title: 'Подтверждение', icon: '✅' },
];

const STEP_VALIDATIONS = {
  1: loanValidation,
  2: personalValidation,
  3: contactValidation,
  4: employmentValidation,
  5: additionalValidation,
  // Шаг 6 — подтверждение, валидация не нужна
};
```

## Использование FormNavigation

### Базовая структура

```tsx title="src/forms/credit-application/CreditApplicationForm.tsx"
import { useMemo, useRef } from 'react';
import { createForm } from '@reformer/core';
import { FormNavigation, type FormNavigationHandle } from '@reformer/ui/form-navigation';

// Компоненты шагов
import { BasicInfoForm } from './steps/loan-info/BasicInfoForm';
import { PersonalInfoForm } from './steps/personal-info/PersonalInfoForm';
import { ContactInfoForm } from './steps/contact-info/ContactInfoForm';
import { EmploymentForm } from './steps/employment/EmploymentForm';
import { AdditionalInfoForm } from './steps/additional-info/AdditionalInfoForm';
import { ConfirmationForm } from './steps/confirmation/ConfirmationForm';

// Валидаторы
import { creditApplicationValidation } from './validators';

function CreditApplicationForm() {
  const navRef = useRef<FormNavigationHandle<CreditApplicationFormType>>(null);

  const form = useMemo(
    () =>
      createForm<CreditApplicationFormType>({
        form: creditApplicationSchema,
        behavior: creditApplicationBehaviors,
        validation: creditApplicationValidation,
      }),
    []
  );

  // Конфигурация навигации
  const navConfig = useMemo(
    () => ({
      stepValidations: STEP_VALIDATIONS,
      fullValidation: creditApplicationValidation,
    }),
    []
  );

  const handleSubmit = async () => {
    const result = await navRef.current?.submit(async (values) => {
      const response = await saveApplication(values);
      return response;
    });

    if (result) {
      alert('Заявка отправлена!');
    }
  };

  return (
    <FormNavigation ref={navRef} form={form} config={navConfig}>
      {/* Compound components здесь */}
    </FormNavigation>
  );
}
```

### FormNavigation.Indicator

Headless индикатор шагов с render props:

```tsx
<FormNavigation.Indicator steps={STEPS}>
  {({ steps, goToStep }) => (
    <div className="flex justify-between mb-4">
      {steps.map((step) => (
        <button
          key={step.number}
          onClick={() => step.canNavigate && goToStep(step.number)}
          disabled={!step.canNavigate}
          className={`px-4 py-2 rounded ${
            step.isCurrent
              ? 'bg-blue-600 text-white'
              : step.isCompleted
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-400'
          }`}
        >
          {step.isCompleted ? '✓' : step.icon} {step.title}
        </button>
      ))}
    </div>
  )}
</FormNavigation.Indicator>
```

**Render props:**

| Свойство       | Тип                          | Описание                      |
| -------------- | ---------------------------- | ----------------------------- |
| `steps`        | `StepWithState[]`            | Шаги с вычисленным состоянием |
| `goToStep`     | `(step: number) => boolean`  | Перейти к шагу                |
| `currentStep`  | `number`                     | Номер текущего шага           |
| `totalSteps`   | `number`                     | Общее количество шагов        |

**Состояние шага:**

| Свойство      | Тип       | Описание                        |
| ------------- | --------- | ------------------------------- |
| `number`      | `number`  | Номер шага (с 1)                |
| `title`       | `string`  | Заголовок шага                  |
| `icon`        | `string?` | Иконка (опционально)            |
| `isCurrent`   | `boolean` | Текущий шаг                     |
| `isCompleted` | `boolean` | Завершён                        |
| `canNavigate` | `boolean` | Можно перейти к этому шагу      |

### FormNavigation.Step

Рендерит компонент, когда шаг активен:

```tsx
<div className="bg-white p-8 rounded-lg shadow-md">
  <FormNavigation.Step component={BasicInfoForm} control={form} />
  <FormNavigation.Step component={PersonalInfoForm} control={form} />
  <FormNavigation.Step component={ContactInfoForm} control={form} />
  <FormNavigation.Step component={EmploymentForm} control={form} />
  <FormNavigation.Step component={AdditionalInfoForm} control={form} />
  <FormNavigation.Step component={ConfirmationForm} control={form} />
</div>
```

Шаги рендерятся по порядку — первый `Step` это шаг 1, второй — шаг 2 и т.д. Отображается только текущий шаг.

### FormNavigation.Actions

Headless кнопки навигации с render props:

```tsx
<FormNavigation.Actions onSubmit={handleSubmit}>
  {({ prev, next, submit, isFirstStep, isLastStep, isValidating }) => (
    <div className="flex justify-between mt-6">
      <Button
        onClick={prev.onClick}
        disabled={isFirstStep || prev.disabled}
        variant="secondary"
      >
        Назад
      </Button>

      {!isLastStep ? (
        <Button onClick={next.onClick} disabled={next.disabled}>
          {isValidating ? 'Проверка...' : 'Далее'}
        </Button>
      ) : (
        <Button onClick={submit.onClick} disabled={submit.disabled}>
          {submit.isSubmitting ? 'Отправка...' : 'Отправить'}
        </Button>
      )}
    </div>
  )}
</FormNavigation.Actions>
```

**Render props:**

| Свойство       | Тип                 | Описание                       |
| -------------- | ------------------- | ------------------------------ |
| `prev`         | `ButtonProps`       | Props кнопки "Назад"           |
| `next`         | `ButtonProps`       | Props кнопки "Далее"           |
| `submit`       | `SubmitButtonProps` | Props кнопки "Отправить"       |
| `isFirstStep`  | `boolean`           | На первом шаге                 |
| `isLastStep`   | `boolean`           | На последнем шаге              |
| `isValidating` | `boolean`           | Валидация в процессе           |

### FormNavigation.Progress

Headless отображение прогресса:

```tsx
<FormNavigation.Progress>
  {({ current, total, percent }) => (
    <div className="mt-4 text-center text-sm text-gray-600">
      Шаг {current} из {total} • {percent}% завершено
    </div>
  )}
</FormNavigation.Progress>
```

## Полный пример

```tsx title="src/forms/credit-application/CreditApplicationForm.tsx"
import { useMemo, useRef } from 'react';
import { createForm } from '@reformer/core';
import { FormNavigation, type FormNavigationHandle } from '@reformer/ui/form-navigation';
import { Button } from '@/components/ui/button';

// Импорты шагов и валидаторов...

const STEPS = [
  { number: 1, title: 'Кредит', icon: '💰' },
  { number: 2, title: 'Личные данные', icon: '👤' },
  { number: 3, title: 'Контакты', icon: '📞' },
  { number: 4, title: 'Занятость', icon: '💼' },
  { number: 5, title: 'Дополнительно', icon: '📋' },
  { number: 6, title: 'Подтверждение', icon: '✅' },
];

const STEP_VALIDATIONS = {
  1: loanValidation,
  2: personalValidation,
  3: contactValidation,
  4: employmentValidation,
  5: additionalValidation,
};

function CreditApplicationForm() {
  const navRef = useRef<FormNavigationHandle<CreditApplicationFormType>>(null);

  const form = useMemo(
    () =>
      createForm<CreditApplicationFormType>({
        form: creditApplicationSchema,
        behavior: creditApplicationBehaviors,
        validation: creditApplicationValidation,
      }),
    []
  );

  const navConfig = useMemo(
    () => ({
      stepValidations: STEP_VALIDATIONS,
      fullValidation: creditApplicationValidation,
    }),
    []
  );

  const submitApplication = async () => {
    const result = await navRef.current?.submit(async (values) => {
      const response = await saveApplication(values);
      alert(`Заявка отправлена! ID: ${response.id}`);
      return response;
    });

    if (!result) {
      alert('Пожалуйста, исправьте ошибки в форме');
    }
  };

  return (
    <FormNavigation ref={navRef} form={form} config={navConfig}>
      {/* Индикатор шагов */}
      <FormNavigation.Indicator steps={STEPS}>
        {({ steps, goToStep }) => (
          <div className="flex justify-between mb-4">
            {steps.map((step) => (
              <button
                key={step.number}
                onClick={() => step.canNavigate && goToStep(step.number)}
                disabled={!step.canNavigate}
                className={`px-4 py-2 rounded transition-colors ${
                  step.isCurrent
                    ? 'bg-blue-600 text-white'
                    : step.isCompleted
                      ? 'bg-green-100 text-green-800 hover:bg-green-200'
                      : step.canNavigate
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {step.isCompleted ? '✓' : step.icon} {step.title}
              </button>
            ))}
          </div>
        )}
      </FormNavigation.Indicator>

      {/* Контент шага */}
      <div className="bg-white p-8 rounded-lg shadow-md">
        <FormNavigation.Step component={BasicInfoForm} control={form} />
        <FormNavigation.Step component={PersonalInfoForm} control={form} />
        <FormNavigation.Step component={ContactInfoForm} control={form} />
        <FormNavigation.Step component={EmploymentForm} control={form} />
        <FormNavigation.Step component={AdditionalInfoForm} control={form} />
        <FormNavigation.Step component={ConfirmationForm} control={form} />
      </div>

      {/* Кнопки навигации */}
      <FormNavigation.Actions onSubmit={submitApplication}>
        {({ prev, next, submit, isFirstStep, isLastStep, isValidating }) => (
          <div className="flex justify-between mt-6">
            <Button
              onClick={prev.onClick}
              disabled={isFirstStep || prev.disabled}
              variant="secondary"
            >
              Назад
            </Button>

            {!isLastStep ? (
              <Button onClick={next.onClick} disabled={next.disabled}>
                {isValidating ? 'Проверка...' : 'Далее'}
              </Button>
            ) : (
              <Button onClick={submit.onClick} disabled={submit.disabled}>
                {submit.isSubmitting ? 'Отправка...' : 'Отправить заявку'}
              </Button>
            )}
          </div>
        )}
      </FormNavigation.Actions>

      {/* Прогресс */}
      <FormNavigation.Progress>
        {({ current, total, percent }) => (
          <div className="mt-4 text-center text-sm text-gray-600">
            Шаг {current} из {total} • {percent}% завершено
          </div>
        )}
      </FormNavigation.Progress>
    </FormNavigation>
  );
}

export default CreditApplicationForm;
```

## Программная навигация

Используйте ref handle для внешнего управления:

```tsx
const navRef = useRef<FormNavigationHandle<MyForm>>(null);

// Программная навигация
navRef.current?.goToStep(2);
navRef.current?.goToNextStep();
navRef.current?.goToPreviousStep();

// Отправка с валидацией
const result = await navRef.current?.submit(async (values) => {
  return api.submit(values);
});
```

### API FormNavigationHandle

| Свойство/Метод       | Тип                  | Описание                     |
| -------------------- | -------------------- | ---------------------------- |
| `currentStep`        | `number`             | Текущий шаг (с 1)            |
| `completedSteps`     | `number[]`           | Завершённые шаги             |
| `isFirstStep`        | `boolean`            | На первом шаге               |
| `isLastStep`         | `boolean`            | На последнем шаге            |
| `isValidating`       | `boolean`            | Валидация в процессе         |
| `goToNextStep()`     | `Promise<boolean>`   | Валидация и переход далее    |
| `goToPreviousStep()` | `void`               | Переход назад                |
| `goToStep(step)`     | `boolean`            | Переход к шагу               |
| `submit(onSubmit)`   | `Promise<R \| null>` | Полная валидация и отправка  |

## Ключевые преимущества

1. **Headless** — полный контроль над UI, любые стили
2. **Compound Components** — декларативный, композируемый API
3. **Render Props** — доступ ко всему состоянию для кастомного рендеринга
4. **Type Safety** — полная поддержка TypeScript с дженериками
5. **Переиспользуемость** — работает с любой формой с пошаговой валидацией

## Что дальше?

Теперь, когда навигация готова, следующие разделы охватывают:

- **Работа с данными** — загрузка, сохранение и сброс данных формы
- **Отправка** — обработка отправки формы, ошибок и повторов

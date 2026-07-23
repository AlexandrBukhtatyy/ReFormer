---
sidebar_position: 3
---

# FormWizard

Headless compound component для multi-step form wizard.

## Базовое использование

```tsx
import { FormWizard, type FormWizardConfig } from '@reformer/cdk/form-wizard';
import { validateModel } from '@reformer/core/validation';

// Конфиг — пара колбэков валидации, а НЕ схемы. Каждый возвращает
// boolean | Promise<boolean> (true = валидно). validateModel(model, schema)
// возвращает Promise<boolean> и сам разносит ошибки по нодам формы —
// колбэк лишь пробрасывает результат.
const config: FormWizardConfig = {
  validateStep: (step) => validateModel(model, STEP_SCHEMAS[step - 1]),
  validateAll: () => validateModel(model, fullSchema),
};

<FormWizard form={form} config={config}>
  <FormWizard.Step component={Step1Form} control={form} />
  <FormWizard.Step component={Step2Form} control={form} />

  <FormWizard.Actions onSubmit={handleSubmit}>
    <FormWizard.Prev>Назад</FormWizard.Prev>
    <FormWizard.Next>Далее</FormWizard.Next>
    <FormWizard.Submit>Отправить</FormWizard.Submit>
  </FormWizard.Actions>
</FormWizard>;
```

## Sub-компоненты

| Компонент              | Назначение                                                 |
| ---------------------- | ---------------------------------------------------------- |
| `FormWizard`           | Root provider                                              |
| `FormWizard.Step`      | Рендерит компонент когда шаг активен                       |
| `FormWizard.Indicator` | Headless индикатор шагов (render props)                    |
| `FormWizard.Actions`   | Контейнер для кнопок навигации (compound или render props) |
| `FormWizard.Prev`      | Кнопка "Назад"                                             |
| `FormWizard.Next`      | Кнопка "Далее"                                             |
| `FormWizard.Submit`    | Кнопка отправки формы                                      |
| `FormWizard.Progress`  | Headless отображение прогресса (render props)              |

## FormWizard.Indicator

```tsx
<FormWizard.Indicator steps={STEPS}>
  {({ steps, goToStep, currentStep }) => (
    <nav>
      {steps.map((step) => (
        <button
          key={step.number}
          onClick={() => goToStep(step.number)}
          disabled={!step.canNavigate}
          aria-current={step.isCurrent ? 'step' : undefined}
        >
          {step.isCompleted ? '✓' : step.number} {step.title}
        </button>
      ))}
    </nav>
  )}
</FormWizard.Indicator>
```

### Определение шагов

```typescript
interface FormWizardIndicatorStep {
  number: number; // Номер шага (1-based)
  title: string;
  icon?: string;
}
```

### Render Props

```typescript
interface FormWizardIndicatorRenderProps {
  steps: FormWizardIndicatorStepWithState[];
  goToStep: (step: number) => boolean;
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
}

interface FormWizardIndicatorStepWithState {
  number: number;
  title: string;
  icon?: string;
  isCurrent: boolean;
  isCompleted: boolean;
  canNavigate: boolean;
}
```

## FormWizard.Actions

Поддерживает два режима: **Compound Components** (рекомендуется) и **Render Props** (для сложных случаев).

### Compound Components (рекомендуется)

```tsx
<FormWizard.Actions onSubmit={handleSubmit} className="flex gap-4">
  <FormWizard.Prev>← Назад</FormWizard.Prev>
  <FormWizard.Next>Далее →</FormWizard.Next>
  <FormWizard.Submit loadingText="Отправка...">Отправить</FormWizard.Submit>
</FormWizard.Actions>
```

Кнопки автоматически становятся `disabled` когда недоступны:

- `Prev` — на первом шаге
- `Next` — на последнем шаге
- `Submit` — не на последнем шаге

### С кастомными кнопками (asChild)

```tsx
<FormWizard.Actions onSubmit={handleSubmit} className="flex gap-4">
  <FormWizard.Prev asChild>
    <Button variant="ghost">← Назад</Button>
  </FormWizard.Prev>
  <FormWizard.Next asChild>
    <Button variant="primary">Далее →</Button>
  </FormWizard.Next>
  <FormWizard.Submit asChild loadingText="Отправка...">
    <Button variant="success">Отправить</Button>
  </FormWizard.Submit>
</FormWizard.Actions>
```

### Props кнопок

```typescript
interface FormWizardPrevProps {
  children: ReactNode;
  asChild?: boolean; // Использовать child как элемент
  disabled?: boolean; // Дополнительное disabled (OR с автоматическим)
  // + все остальные button props
}

interface FormWizardNextProps {
  children: ReactNode;
  asChild?: boolean;
  disabled?: boolean;
}

interface FormWizardSubmitProps {
  children: ReactNode;
  asChild?: boolean;
  disabled?: boolean;
  loadingText?: ReactNode; // Контент во время отправки
}
```

### Render Props (для сложных layout)

```tsx
<FormWizard.Actions onSubmit={handleSubmit}>
  {({ prev, next, submit, isFirstStep, isLastStep, isValidating }) => (
    <div>
      {!isFirstStep && (
        <button onClick={prev.onClick} disabled={prev.disabled}>
          Назад
        </button>
      )}
      {!isLastStep ? (
        <button onClick={next.onClick} disabled={next.disabled}>
          {isValidating ? 'Проверка...' : 'Далее'}
        </button>
      ) : (
        <button onClick={submit.onClick} disabled={submit.disabled}>
          {submit.isSubmitting ? 'Отправка...' : 'Отправить'}
        </button>
      )}
    </div>
  )}
</FormWizard.Actions>
```

### Render Props типы

```typescript
interface FormWizardActionsRenderProps {
  prev: { onClick: () => void; disabled: boolean };
  next: { onClick: () => void; disabled: boolean };
  submit: { onClick: () => void; disabled: boolean; isSubmitting: boolean };
  isFirstStep: boolean;
  isLastStep: boolean;
  isValidating: boolean;
  isSubmitting: boolean;
}
```

## FormWizard.Progress

```tsx
<FormWizard.Progress>
  {({ current, total, percent }) => (
    <div>
      Шаг {current} из {total} ({percent}%)
      <div style={{ width: `${percent}%` }} />
    </div>
  )}
</FormWizard.Progress>
```

### Render Props

```typescript
interface FormWizardProgressRenderProps {
  current: number;
  total: number;
  percent: number;
  completedCount: number;
  isFirstStep: boolean;
  isLastStep: boolean;
}
```

## Внешнее управление через Ref

```tsx
const navRef = useRef<FormWizardHandle<FormType>>(null);

// Программная навигация
navRef.current?.goToStep(2);
navRef.current?.goToNextStep();
navRef.current?.goToPreviousStep();

// Submit с валидацией
const result = await navRef.current?.submit(async (values) => {
  return api.submit(values);
});

<FormWizard ref={navRef} form={form} config={config}>
  ...
</FormWizard>;
```

## Конфигурация

```typescript
interface FormWizardConfig {
  /** Валидация шага N (1-based). Нет колбэка → шаг считается валидным (warn в консоль). */
  validateStep?: (step: number) => boolean | Promise<boolean>;
  /** Валидация всей формы перед submit. Нет колбэка → submit без блокировки. */
  validateAll?: () => boolean | Promise<boolean>;
}
```

`FormWizardConfig` — это пара опциональных колбэков валидации (не дженерик, не схемы).
Каждый возвращает `boolean | Promise<boolean>`, где `true` означает «валидно». Обычно оба
оборачивают `validateModel(model, schema)` из `@reformer/core/validation` и замыкаются на
схему текущего шага. `validateModel` уже возвращает `Promise<boolean>`, сам разносит каждую
ошибку в соответствующую ноду формы и не считает `severity: 'warning'` блокирующей — поэтому
колбэк просто пробрасывает результат (никакого объекта `errors` разбирать не нужно):

```typescript
import { validateModel } from '@reformer/core/validation';

// STEP_SCHEMAS[i] и fullSchema — это ValidationSchema<Root>, собранные через
// defineValidationSchema / apply (см. доки валидации @reformer/core).
const config: FormWizardConfig = {
  validateStep: (step) => validateModel(model, STEP_SCHEMAS[step - 1]),
  validateAll: () => validateModel(model, fullSchema),
};
```

Сами схемы — обычные функции `defineValidationSchema<Root>(({ model }) => …)`; `fullSchema`
композирует пошаговые схемы через `apply(...STEP_SCHEMAS)`. Конфиг wizard'а никогда не видит
валидаторы напрямую — layout и валидация живут в раздельных слоях.

Валидация происходит автоматически:

- При `next.onClick` / `FormWizard.Next`: запускается `validateStep(currentStep)`; при неуспехе вызывается `form.markAsTouched()` и wizard остаётся на текущем шаге.
- При `submit` (ref `submit()` или `onSubmit` у `FormWizard.Actions`): запускается `validateAll()`; при успехе делегирует в `form.submit(onSubmit, { skipValidation: true })`.

> Высокоуровневый `FormWizard` из `@reformer/ui-kit` принимает тот же `config`.

## Полный пример

```tsx
const STEPS = [
  { number: 1, title: 'Основное', icon: '📋' },
  { number: 2, title: 'Контакты', icon: '📞' },
  { number: 3, title: 'Подтверждение', icon: '✅' },
];

// Пошаговые схемы (defineValidationSchema<MyForm>), определены отдельно;
// fullSchema = apply(...STEP_SCHEMAS) — полная схема формы.
const STEP_SCHEMAS = [basicInfoSchema, contactSchema, confirmationSchema];

function MultiStepForm() {
  const navRef = useRef<FormWizardHandle<MyForm>>(null);
  const { form, model } = useMemo(() => createForm(), []);

  // config: { validateStep, validateAll } — оба оборачивают validateModel(model, schema).
  const config = useMemo<FormWizardConfig>(
    () => ({
      validateStep: (step) => validateModel(model, STEP_SCHEMAS[step - 1]),
      validateAll: () => validateModel(model, fullSchema),
    }),
    [model]
  );

  const handleSubmit = async () => {
    const result = await navRef.current?.submit(async (values) => {
      return api.createApplication(values);
    });
    if (result) {
      alert('Успешно!');
    }
  };

  return (
    <FormWizard ref={navRef} form={form} config={config}>
      {/* Stepper */}
      <FormWizard.Indicator steps={STEPS}>
        {({ steps, goToStep }) => (
          <div className="flex gap-4">
            {steps.map((step) => (
              <button
                key={step.number}
                onClick={() => goToStep(step.number)}
                disabled={!step.canNavigate}
                className={step.isCurrent ? 'active' : ''}
              >
                {step.icon} {step.title}
              </button>
            ))}
          </div>
        )}
      </FormWizard.Indicator>

      {/* Steps */}
      <FormWizard.Step component={BasicInfoForm} control={form} />
      <FormWizard.Step component={ContactForm} control={form} />
      <FormWizard.Step component={ConfirmationForm} control={form} />

      {/* Navigation (compound components) */}
      <FormWizard.Actions onSubmit={handleSubmit} className="flex justify-between mt-8">
        <FormWizard.Prev asChild>
          <Button>← Назад</Button>
        </FormWizard.Prev>
        <div className="flex-1" />
        <FormWizard.Next asChild>
          <Button>Далее →</Button>
        </FormWizard.Next>
        <FormWizard.Submit asChild loadingText="Отправка...">
          <Button>Отправить</Button>
        </FormWizard.Submit>
      </FormWizard.Actions>

      {/* Progress */}
      <FormWizard.Progress>
        {({ current, total, percent }) => (
          <div className="text-center mt-4 text-gray-600">
            Шаг {current} из {total} • {percent}% завершено
          </div>
        )}
      </FormWizard.Progress>
    </FormWizard>
  );
}
```

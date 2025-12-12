---
sidebar_position: 3
---

# FormNavigation

Headless compound component для multi-step form wizard.

## Базовое использование

```tsx
import { FormNavigation } from '@reformer/ui/form-navigation';

const config = {
  stepValidations: {
    1: step1Schema,
    2: step2Schema,
  },
  fullValidation: fullFormSchema,
};

<FormNavigation form={form} config={config}>
  <FormNavigation.Step component={Step1Form} control={form} />
  <FormNavigation.Step component={Step2Form} control={form} />

  <FormNavigation.Actions onSubmit={handleSubmit}>
    {({ prev, next, submit, isFirstStep, isLastStep }) => (
      <div>
        {!isFirstStep && <button {...prev}>Назад</button>}
        {!isLastStep ? (
          <button {...next}>Далее</button>
        ) : (
          <button {...submit}>Отправить</button>
        )}
      </div>
    )}
  </FormNavigation.Actions>
</FormNavigation>
```

## Sub-компоненты

| Компонент | Назначение |
|-----------|------------|
| `FormNavigation` | Root provider |
| `FormNavigation.Step` | Рендерит компонент когда шаг активен |
| `FormNavigation.Indicator` | Headless индикатор шагов (render props) |
| `FormNavigation.Actions` | Headless кнопки навигации (render props) |
| `FormNavigation.Progress` | Headless отображение прогресса (render props) |

## FormNavigation.Indicator

```tsx
<FormNavigation.Indicator steps={STEPS}>
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
</FormNavigation.Indicator>
```

### Определение шагов

```typescript
interface FormNavigationIndicatorStep {
  number: number;   // Номер шага (1-based)
  title: string;
  icon?: string;
}
```

### Render Props

```typescript
interface FormNavigationIndicatorRenderProps {
  steps: FormNavigationIndicatorStepWithState[];
  goToStep: (step: number) => boolean;
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
}

interface FormNavigationIndicatorStepWithState {
  number: number;
  title: string;
  icon?: string;
  isCurrent: boolean;
  isCompleted: boolean;
  canNavigate: boolean;
}
```

## FormNavigation.Actions

```tsx
<FormNavigation.Actions onSubmit={handleSubmit}>
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
</FormNavigation.Actions>
```

### Render Props

```typescript
interface FormNavigationActionsRenderProps {
  prev: { onClick: () => void; disabled: boolean };
  next: { onClick: () => void; disabled: boolean };
  submit: { onClick: () => void; disabled: boolean; isSubmitting: boolean };
  isFirstStep: boolean;
  isLastStep: boolean;
  isValidating: boolean;
  isSubmitting: boolean;
}
```

## FormNavigation.Progress

```tsx
<FormNavigation.Progress>
  {({ current, total, percent }) => (
    <div>
      Шаг {current} из {total} ({percent}%)
      <div style={{ width: `${percent}%` }} />
    </div>
  )}
</FormNavigation.Progress>
```

### Render Props

```typescript
interface FormNavigationProgressRenderProps {
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
const navRef = useRef<FormNavigationHandle<FormType>>(null);

// Программная навигация
navRef.current?.goToStep(2);
navRef.current?.goToNextStep();
navRef.current?.goToPreviousStep();

// Submit с валидацией
const result = await navRef.current?.submit(async (values) => {
  return api.submit(values);
});

<FormNavigation ref={navRef} form={form} config={config}>
  ...
</FormNavigation>
```

## Конфигурация

```typescript
interface FormNavigationConfig<T> {
  stepValidations: Record<number, ValidationSchemaFn<T>>;
  fullValidation: ValidationSchemaFn<T>;
}
```

Валидация происходит автоматически:
- При `next.onClick`: валидируется текущий шаг
- При `submit.onClick`: валидируется вся форма

## Полный пример

```tsx
const STEPS = [
  { number: 1, title: 'Основное', icon: '📋' },
  { number: 2, title: 'Контакты', icon: '📞' },
  { number: 3, title: 'Подтверждение', icon: '✅' },
];

function MultiStepForm() {
  const navRef = useRef<FormNavigationHandle<MyForm>>(null);
  const form = useMemo(() => createForm(), []);

  const config = useMemo(() => ({
    stepValidations: {
      1: basicInfoSchema,
      2: contactSchema,
      3: confirmationSchema,
    },
    fullValidation: fullSchema,
  }), []);

  const handleSubmit = async () => {
    const result = await navRef.current?.submit(async (values) => {
      return api.createApplication(values);
    });
    if (result) {
      alert('Успешно!');
    }
  };

  return (
    <FormNavigation ref={navRef} form={form} config={config}>
      {/* Stepper */}
      <FormNavigation.Indicator steps={STEPS}>
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
      </FormNavigation.Indicator>

      {/* Steps */}
      <FormNavigation.Step component={BasicInfoForm} control={form} />
      <FormNavigation.Step component={ContactForm} control={form} />
      <FormNavigation.Step component={ConfirmationForm} control={form} />

      {/* Navigation */}
      <FormNavigation.Actions onSubmit={handleSubmit}>
        {({ prev, next, submit, isFirstStep, isLastStep }) => (
          <div className="flex justify-between mt-8">
            {!isFirstStep && <Button {...prev}>← Назад</Button>}
            <div className="flex-1" />
            {!isLastStep ? (
              <Button {...next}>Далее →</Button>
            ) : (
              <Button {...submit}>Отправить</Button>
            )}
          </div>
        )}
      </FormNavigation.Actions>

      {/* Progress */}
      <FormNavigation.Progress>
        {({ current, total, percent }) => (
          <div className="text-center mt-4 text-gray-600">
            Шаг {current} из {total} • {percent}% завершено
          </div>
        )}
      </FormNavigation.Progress>
    </FormNavigation>
  );
}
```

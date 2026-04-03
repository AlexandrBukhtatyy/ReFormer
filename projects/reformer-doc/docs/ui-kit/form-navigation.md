---
sidebar_position: 3
---

# FormWizard

Headless compound component для multi-step form wizard.

## Базовое использование

```tsx
import { FormWizard } from '@reformer/ui/form-wizard';

const config = {
  stepValidations: {
    1: step1Schema,
    2: step2Schema,
  },
  fullValidation: fullFormSchema,
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
interface FormWizardConfig<T> {
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
  const navRef = useRef<FormWizardHandle<MyForm>>(null);
  const form = useMemo(() => createForm(), []);

  const config = useMemo(
    () => ({
      stepValidations: {
        1: basicInfoSchema,
        2: contactSchema,
        3: confirmationSchema,
      },
      fullValidation: fullSchema,
    }),
    []
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

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
    <FormNavigation.Prev>Назад</FormNavigation.Prev>
    <FormNavigation.Next>Далее</FormNavigation.Next>
    <FormNavigation.Submit>Отправить</FormNavigation.Submit>
  </FormNavigation.Actions>
</FormNavigation>
```

## Sub-компоненты

| Компонент | Назначение |
|-----------|------------|
| `FormNavigation` | Root provider |
| `FormNavigation.Step` | Рендерит компонент когда шаг активен |
| `FormNavigation.Indicator` | Headless индикатор шагов (render props) |
| `FormNavigation.Actions` | Контейнер для кнопок навигации (compound или render props) |
| `FormNavigation.Prev` | Кнопка "Назад" |
| `FormNavigation.Next` | Кнопка "Далее" |
| `FormNavigation.Submit` | Кнопка отправки формы |
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

Поддерживает два режима: **Compound Components** (рекомендуется) и **Render Props** (для сложных случаев).

### Compound Components (рекомендуется)

```tsx
<FormNavigation.Actions onSubmit={handleSubmit} className="flex gap-4">
  <FormNavigation.Prev>← Назад</FormNavigation.Prev>
  <FormNavigation.Next>Далее →</FormNavigation.Next>
  <FormNavigation.Submit loadingText="Отправка...">
    Отправить
  </FormNavigation.Submit>
</FormNavigation.Actions>
```

Кнопки автоматически становятся `disabled` когда недоступны:
- `Prev` — на первом шаге
- `Next` — на последнем шаге
- `Submit` — не на последнем шаге

### С кастомными кнопками (asChild)

```tsx
<FormNavigation.Actions onSubmit={handleSubmit} className="flex gap-4">
  <FormNavigation.Prev asChild>
    <Button variant="ghost">← Назад</Button>
  </FormNavigation.Prev>
  <FormNavigation.Next asChild>
    <Button variant="primary">Далее →</Button>
  </FormNavigation.Next>
  <FormNavigation.Submit asChild loadingText="Отправка...">
    <Button variant="success">Отправить</Button>
  </FormNavigation.Submit>
</FormNavigation.Actions>
```

### Props кнопок

```typescript
interface FormNavigationPrevProps {
  children: ReactNode;
  asChild?: boolean;      // Использовать child как элемент
  disabled?: boolean;     // Дополнительное disabled (OR с автоматическим)
  // + все остальные button props
}

interface FormNavigationNextProps {
  children: ReactNode;
  asChild?: boolean;
  disabled?: boolean;
}

interface FormNavigationSubmitProps {
  children: ReactNode;
  asChild?: boolean;
  disabled?: boolean;
  loadingText?: ReactNode; // Контент во время отправки
}
```

### Render Props (для сложных layout)

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

### Render Props типы

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

      {/* Navigation (compound components) */}
      <FormNavigation.Actions onSubmit={handleSubmit} className="flex justify-between mt-8">
        <FormNavigation.Prev asChild>
          <Button>← Назад</Button>
        </FormNavigation.Prev>
        <div className="flex-1" />
        <FormNavigation.Next asChild>
          <Button>Далее →</Button>
        </FormNavigation.Next>
        <FormNavigation.Submit asChild loadingText="Отправка...">
          <Button>Отправить</Button>
        </FormNavigation.Submit>
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

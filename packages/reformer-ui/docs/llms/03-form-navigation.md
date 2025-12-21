# FormNavigation

Headless compound component for multi-step form wizards.

## Basic Usage

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
        {!isFirstStep && <button {...prev}>Back</button>}
        {!isLastStep ? (
          <button {...next}>Next</button>
        ) : (
          <button {...submit}>Submit</button>
        )}
      </div>
    )}
  </FormNavigation.Actions>
</FormNavigation>
```

## Sub-components

| Component | Purpose |
|-----------|---------|
| `FormNavigation` | Root provider |
| `FormNavigation.Step` | Renders component when step is current |
| `FormNavigation.Indicator` | Headless step indicator (render props) |
| `FormNavigation.Actions` | Headless navigation buttons (render props) |
| `FormNavigation.Progress` | Headless progress display (render props) |

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

### Step Definition

```typescript
interface FormNavigationIndicatorStep {
  number: number;   // 1-based step number
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
          Back
        </button>
      )}
      {!isLastStep ? (
        <button onClick={next.onClick} disabled={next.disabled}>
          {isValidating ? 'Validating...' : 'Next'}
        </button>
      ) : (
        <button onClick={submit.onClick} disabled={submit.disabled}>
          {submit.isSubmitting ? 'Submitting...' : 'Submit'}
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
      Step {current} of {total} ({percent}%)
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

## External Control via Ref

```tsx
const navRef = useRef<FormNavigationHandle<FormType>>(null);

// Programmatic navigation
navRef.current?.goToStep(2);
navRef.current?.goToNextStep();
navRef.current?.goToPreviousStep();

// Submit with validation
const result = await navRef.current?.submit(async (values) => {
  return api.submit(values);
});

<FormNavigation ref={navRef} form={form} config={config}>
  ...
</FormNavigation>
```

## Configuration

```typescript
interface FormNavigationConfig<T> {
  stepValidations: Record<number, ValidationSchemaFn<T>>;
  fullValidation: ValidationSchemaFn<T>;
}
```

Validation happens automatically:
- On `next.onClick`: validates current step
- On `submit.onClick`: validates entire form

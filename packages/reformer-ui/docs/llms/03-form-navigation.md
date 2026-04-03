# FormWizard

Headless compound component for multi-step form wizards.

## Basic Usage

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
    {({ prev, next, submit, isFirstStep, isLastStep }) => (
      <div>
        {!isFirstStep && <button {...prev}>Back</button>}
        {!isLastStep ? <button {...next}>Next</button> : <button {...submit}>Submit</button>}
      </div>
    )}
  </FormWizard.Actions>
</FormWizard>;
```

## Sub-components

| Component              | Purpose                                    |
| ---------------------- | ------------------------------------------ |
| `FormWizard`           | Root provider                              |
| `FormWizard.Step`      | Renders component when step is current     |
| `FormWizard.Indicator` | Headless step indicator (render props)     |
| `FormWizard.Actions`   | Headless navigation buttons (render props) |
| `FormWizard.Progress`  | Headless progress display (render props)   |

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

### Step Definition

```typescript
interface FormWizardIndicatorStep {
  number: number; // 1-based step number
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

```tsx
<FormWizard.Actions onSubmit={handleSubmit}>
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
</FormWizard.Actions>
```

### Render Props

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
      Step {current} of {total} ({percent}%)
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

## External Control via Ref

```tsx
const navRef = useRef<FormWizardHandle<FormType>>(null);

// Programmatic navigation
navRef.current?.goToStep(2);
navRef.current?.goToNextStep();
navRef.current?.goToPreviousStep();

// Submit with validation
const result = await navRef.current?.submit(async (values) => {
  return api.submit(values);
});

<FormWizard ref={navRef} form={form} config={config}>
  ...
</FormWizard>;
```

## Configuration

```typescript
interface FormWizardConfig<T> {
  stepValidations: Record<number, ValidationSchemaFn<T>>;
  fullValidation: ValidationSchemaFn<T>;
}
```

Validation happens automatically:

- On `next.onClick`: validates current step
- On `submit.onClick`: validates entire form

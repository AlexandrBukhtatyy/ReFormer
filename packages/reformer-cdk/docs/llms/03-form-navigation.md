# FormWizard

Headless compound component for multi-step form wizards.

## Basic Usage

```tsx
import { FormWizard, type FormWizardConfig } from '@reformer/cdk/form-wizard';

// Config is a pair of validation callbacks — NOT schemas.
// Each returns boolean | Promise<boolean> (true = valid).
const config: FormWizardConfig = {
  validateStep: (step) => validateFormModel(model, stepSchema(step)),
  validateAll: () => validateFormModel(model, fullSchema),
};

<FormWizard form={form} config={config}>
  <FormWizard.Step component={Step1Form} control={form} />
  <FormWizard.Step component={Step2Form} control={form} />

  <FormWizard.Actions onSubmit={handleSubmit}>
    {({ prev, next, submit, isFirstStep, isLastStep }) => (
      <div>
        {!isFirstStep && <button onClick={prev.onClick} disabled={prev.disabled}>Back</button>}
        {!isLastStep ? (
          <button onClick={next.onClick} disabled={next.disabled}>Next</button>
        ) : (
          <button onClick={submit.onClick} disabled={submit.disabled}>Submit</button>
        )}
      </div>
    )}
  </FormWizard.Actions>
</FormWizard>;
```

> Note: `prev`/`next`/`submit` are `{ onClick, disabled }` objects (submit also has
> `isSubmitting`). They are not DOM-attribute bags — do not `{...prev}`-spread them
> onto `<button>` (that would set an invalid `disabled`/`onClick` mix). Read the
> members explicitly as shown, or use the compound `FormWizard.Prev/Next/Submit`.

## Sub-components

| Component              | Purpose                                                |
| ---------------------- | ------------------------------------------------------ |
| `FormWizard`           | Root provider                                          |
| `FormWizard.Step`      | Renders component/children when step is current        |
| `FormWizard.Indicator` | Headless step indicator (render props)                 |
| `FormWizard.Actions`   | Navigation container: render props OR compound buttons |
| `FormWizard.Prev`      | Compound "Back" button (inside `Actions`)              |
| `FormWizard.Next`      | Compound "Next" button (inside `Actions`)              |
| `FormWizard.Submit`    | Compound "Submit" button (inside `Actions`)            |
| `FormWizard.Progress`  | Headless progress display (render props)               |

`FormWizard.Prev` / `Next` / `Submit` are compound children of `FormWizard.Actions`
(they read the Actions context) — they cannot be used standalone. They are not
top-level exports; access them as members: `FormWizard.Prev`, etc.

### Actions: compound mode

```tsx
<FormWizard.Actions onSubmit={handleSubmit} className="flex justify-between">
  <FormWizard.Prev>Back</FormWizard.Prev>
  <FormWizard.Next>Next</FormWizard.Next>
  <FormWizard.Submit loadingText="Submitting…">Submit</FormWizard.Submit>
</FormWizard.Actions>
```

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

`FormWizardConfig` is a pair of optional validation callbacks (not generic, not
schema-based). Each returns `boolean | Promise<boolean>` — `true` means valid.

```typescript
interface FormWizardConfig {
  /** Validate step N (1-based). Missing → step treated as valid (warns in console). */
  validateStep?: (step: number) => boolean | Promise<boolean>;
  /** Validate the whole form before submit. Missing → submit not blocked. */
  validateAll?: () => boolean | Promise<boolean>;
}
```

Typically both wrap `validateFormModel(model, schema)` from `@reformer/core` and
close over the current step's schema:

```typescript
const config: FormWizardConfig = {
  validateStep: async (step) => {
    const res = await validateFormModel(model, stepSchemas[step - 1]);
    return Object.keys(res.errors).length === 0;
  },
  validateAll: async () => {
    const res = await validateFormModel(model, fullSchema);
    return Object.keys(res.errors).length === 0;
  },
};
```

Validation happens automatically:

- On `next.onClick` / `FormWizard.Next`: runs `validateStep(currentStep)`; on failure calls `form.markAsTouched()` and stays on the step.
- On `submit` (ref `submit()` or `FormWizard.Actions` `onSubmit`): runs `validateAll()`; on success delegates to `form.submit(onSubmit, { skipValidation: true })`.

> The higher-level `@reformer/ui-kit` `FormWizard` accepts the same `config`; the
> credit-application example builds it via `makeCreditValidationConfig(model)`.

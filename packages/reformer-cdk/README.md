# @reformer/cdk

Headless UI components for `@reformer/core` - build accessible, fully customizable form interfaces.

## Features

- **Headless** - No default styles, complete design freedom
- **Compound Components** - Declarative, composable API
- **Render Props** - Full control over rendering
- **TypeScript** - Fully typed with generics support
- **Tree-shakable** - Import only what you need

## Installation

```bash
npm install @reformer/cdk @reformer/core
```

## Components

### FormArray

Manage dynamic form arrays with add/remove functionality.

```tsx
import { FormArray } from '@reformer/cdk/form-array';

<FormArray.Root control={form.items}>
  <FormArray.Empty>
    <p>No items yet</p>
  </FormArray.Empty>

  <FormArray.List>
    {({ control, index, remove }) => (
      <div>
        <span>Item #{index + 1}</span>
        <ItemForm control={control} />
        <button onClick={remove}>Remove</button>
      </div>
    )}
  </FormArray.List>

  <FormArray.AddButton>Add Item</FormArray.AddButton>
</FormArray.Root>;
```

### FormWizard

Build multi-step form wizards with validation.

```tsx
import { FormWizard } from '@reformer/cdk/form-wizard';

<FormWizard form={form} config={config}>
  <FormWizard.Indicator steps={STEPS}>
    {({ steps, goToStep }) => (
      <nav>
        {steps.map((step) => (
          <button
            key={step.number}
            onClick={() => goToStep(step.number)}
            disabled={!step.canNavigate}
          >
            {step.title}
          </button>
        ))}
      </nav>
    )}
  </FormWizard.Indicator>

  <FormWizard.Step component={Step1} control={form} />
  <FormWizard.Step component={Step2} control={form} />

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

#### Validation config

`config` is a plain `FormWizardConfig` of callbacks — `{ validateStep?, validateAll? }` — so the
wizard stays decoupled from any particular validation engine. Wire those callbacks to the
`@reformer/core/validation` contract: describe the rules once as a `defineValidationSchema`, then run
them on demand with `validateModel(model, schema)`. The runner returns `Promise<boolean>`, routes
errors onto the form nodes itself, and treats `severity: 'warning'` as non-blocking (stale runs of the
same schema are cancelled automatically).

```tsx
import { type FormModel } from '@reformer/core';
import { defineValidationSchema, validate, validateModel, apply } from '@reformer/core/validation';
import { required, min, email } from '@reformer/core/validators';

type Root = { loanAmount: number; email: string };

const step1 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.loanAmount, [required(), min(50000)]);
});
const step2 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.email, [required(), email()]);
});

const STEP_SCHEMAS = [step1, step2] as const;
const fullSchema = defineValidationSchema<Root>(() => apply(...STEP_SCHEMAS));

// Returns exactly the { validateStep, validateAll } shape FormWizardConfig expects.
function makeValidationConfig(model: FormModel<Root>) {
  return {
    validateStep: (step: number) => validateModel(model, STEP_SCHEMAS[step - 1]),
    validateAll: () => validateModel(model, fullSchema),
  };
}
```

`FormWizard` calls `config.validateStep(n)` before advancing a step and `config.validateAll()` before
submit — nothing else drives validation. Note that `form.validate()` / `form.submit()` no longer run
schema validation on their own; the only thing that runs a schema is an explicit `validateModel(...)`
call (here, through these callbacks — the wizard's built-in submit passes `skipValidation`).

## Hooks

For full customization, use the hooks directly:

```tsx
import { useFormArray } from '@reformer/cdk/form-array';
import { useFormWizard } from '@reformer/cdk/form-wizard';
```

## License

MIT

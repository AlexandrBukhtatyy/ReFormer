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

### FieldArray

Manage dynamic form arrays with add/remove functionality.

```tsx
import { FieldArray } from '@reformer/cdk/field-array';

<FieldArray.Root control={form.items}>
  <FieldArray.Empty>
    <p>No items yet</p>
  </FieldArray.Empty>

  <FieldArray.List>
    {({ control, index, remove }) => (
      <div>
        <span>Item #{index + 1}</span>
        <ItemForm control={control} />
        <button onClick={remove}>Remove</button>
      </div>
    )}
  </FieldArray.List>

  <FieldArray.AddButton>Add Item</FieldArray.AddButton>
</FieldArray.Root>;
```

### FormWizard

Build multi-step form wizards with validation. The wizard renders the step flow of the form bundle:
`createForm({ flow })` declares the steps and their rules, the wizard draws them and calls the
flow's transitions.

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, min, email } from '@reformer/core/validators';
import { FormWizard } from '@reformer/cdk/form-wizard';

type Root = { loanAmount: number; email: string };

const loanRules = defineValidation<Root>(({ model }) => {
  validate(model.$.loanAmount, [required({ code: 'loanAmount.required' }), min(50000)]);
});
const contactsRules = defineValidation<Root>(({ model }) => {
  validate(model.$.email, [required(), email()]);
});

function CreditWizard() {
  const bundle = useFormBundle(() =>
    createForm<Root>({
      initial: { loanAmount: 0, email: '' },
      flow: {
        steps: [
          { id: 'loan', rules: loanRules },
          { id: 'contacts', rules: contactsRules },
        ],
      },
    })
  );

  return (
    <FormWizard form={bundle.form} flow={bundle.flow}>
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

      <FormWizard.Step component={LoanStep} control={bundle.form} />
      <FormWizard.Step component={ContactsStep} control={bundle.form} />

      {/* Outside the bundle context onSubmit runs on click: the check is bundle.submit. */}
      <FormWizard.Actions onSubmit={() => void bundle.submit(api.send)}>
        <FormWizard.Prev>Back</FormWizard.Prev>
        <FormWizard.Next>Next</FormWizard.Next>
        <FormWizard.Submit>Submit</FormWizard.Submit>
      </FormWizard.Actions>
    </FormWizard>
  );
}
```

#### Steps and validation

- **Next** runs `flow.next()`: the current step's `rules` are checked; on blocking issues the
  wizard stays on the step, and the checked fields of the step are marked touched. A step without
  `rules` passes without a check.
- **Submit** — `bundle.submit(handler)`: one run of the full rule set (every step's `rules` plus
  `validation.extras`, or `validation.rules` when given), then the handler with the model values.
  It resolves to a `SubmitResult`: `{ status: 'submitted', result }`,
  `{ status: 'invalid' | 'error' | 'cancelled', validation }` or `{ status: 'failed', error }`.
  Inside the bundle context (`FormRenderer`) the wizard submits through `bundle.submit` itself and
  calls `onSubmit` only after the check passed.
- **Where the flow comes from:** the `flow` prop, otherwise the bundle in `FormBundleContext`,
  otherwise a positional flow by the number of `FormWizard.Step` children — without any rules.
- **External control** — the flow itself, not a ref: `bundle.flow.next()`,
  `bundle.flow.goTo('contacts')`, `bundle.flow.previous()`; state for rendering —
  `useFormFlow(bundle.flow)` from `@reformer/core/react`.

The previous contract (`config` prop with `FormWizardConfig`, `ref` with `FormWizardHandle`,
`defineSteps`, `useWizardStepValidation`) is removed — see
[docs/llms/03-form-navigation.md](docs/llms/03-form-navigation.md).

### Validation messages

Issues carry a `code`, not text. `FormField.Error` and `FieldArray.Error` show the text from the
locale (`I18nProvider` from `@reformer/core/react`); form-specific texts come from a dictionary:

```tsx
import { defineIssueMessages } from '@reformer/core/i18n';
import { ValidationMessagesProvider } from '@reformer/cdk';

const messages = defineIssueMessages({
  'loanAmount.required': 'Enter the loan amount',
  minLength: 'At least {minLength} characters',
});

<ValidationMessagesProvider messages={messages}>
  <CreditWizard />
</ValidationMessagesProvider>;
```

`<ValidationMessagesProvider resolver={(issue) => …}>` replaces the text source for the subtree
completely; `useIssueMessageResolver()` returns the active resolver for custom rendering.

## Hooks

For full customization, use the hooks directly:

```tsx
import { useFieldArray } from '@reformer/cdk/field-array';
import { useFormWizard } from '@reformer/cdk/form-wizard';
```

## License

MIT

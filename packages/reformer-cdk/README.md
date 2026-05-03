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

## Hooks

For full customization, use the hooks directly:

```tsx
import { useFormArray } from '@reformer/cdk/form-array';
import { useFormWizard } from '@reformer/cdk/form-wizard';
```

## License

MIT

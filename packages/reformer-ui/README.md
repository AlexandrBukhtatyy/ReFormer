# @reformer/ui

Headless UI components for `@reformer/core` - build accessible, fully customizable form interfaces.

## Features

- **Headless** - No default styles, complete design freedom
- **Compound Components** - Declarative, composable API
- **Render Props** - Full control over rendering
- **TypeScript** - Fully typed with generics support
- **Tree-shakable** - Import only what you need

## Installation

```bash
npm install @reformer/ui @reformer/core
```

## Components

### FormArray

Manage dynamic form arrays with add/remove functionality.

```tsx
import { FormArray } from '@reformer/ui/form-array';

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
</FormArray.Root>
```

### FormNavigation

Build multi-step form wizards with validation.

```tsx
import { FormNavigation } from '@reformer/ui/form-navigation';

<FormNavigation form={form} config={config}>
  <FormNavigation.Indicator steps={STEPS}>
    {({ steps, goToStep }) => (
      <nav>
        {steps.map(step => (
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
  </FormNavigation.Indicator>

  <FormNavigation.Step component={Step1} control={form} />
  <FormNavigation.Step component={Step2} control={form} />

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

## Hooks

For full customization, use the hooks directly:

```tsx
import { useFormArray } from '@reformer/ui/form-array';
import { useFormNavigation } from '@reformer/ui/form-navigation';
```

## License

MIT

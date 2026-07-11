# @reformer/ui-kit

Styled, ready-to-use form components for `@reformer/core`, built with Tailwind CSS and Radix UI.

Where [`@reformer/cdk`](https://www.npmjs.com/package/@reformer/cdk) gives you headless primitives,
`@reformer/ui-kit` gives you drop-in, accessible, pre-styled controls (inputs, selects, checkboxes,
buttons, layout) that bind straight to a ReFormer `FieldNode`.

## Features

- **Styled out of the box** — Tailwind CSS design tokens, sensible defaults
- **Accessible** — built on Radix UI primitives (Select, Slot, …)
- **Form-aware** — controlled `value` / `onChange` that plug into `useFormControl`
- **TypeScript** — fully typed, discriminated props (e.g. `Input` narrows by `type`)
- **Tree-shakable** — import the whole kit or individual components via subpaths

## Installation

```bash
npm install @reformer/ui-kit @reformer/core
```

`@reformer/ui-kit` renders with Tailwind CSS — make sure Tailwind is configured in your app so the
component classes are generated. `@reformer/cdk` and `@reformer/renderer-react` are optional peers
(needed only if you use the re-exported `FormArray` / `FormWizard`).

## Components

| Component                     | Purpose                                                   |
| ----------------------------- | --------------------------------------------------------- |
| `Input`                       | Text / email / number input (discriminated by `type`)     |
| `InputMask`                   | Masked text input                                         |
| `InputPassword`               | Password input with show/hide toggle                      |
| `Textarea`                    | Multi-line text input                                     |
| `Select`                      | Radix-based dropdown (`+ SelectItem`, `SelectTrigger`, …) |
| `Checkbox`                    | Boolean checkbox                                          |
| `RadioGroup`                  | Single-choice radio group                                 |
| `Button`                      | Styled button                                             |
| `Box` / `Section`             | Layout containers                                         |
| `Collapsible`                 | Expand/collapse container                                 |
| `AsyncBoundary`               | Loading / error boundary for async UI                     |
| `FormField`                   | Label + control + error wrapper                           |
| `ErrorState` / `LoadingState` | State display components (`@reformer/ui-kit/state`)       |

## Imports

```tsx
// The whole kit
import { Input, Select, Checkbox, Button, FormField } from '@reformer/ui-kit';

// Or individual components via subpaths (tree-shaking)
import { Input } from '@reformer/ui-kit/input';
import { Select } from '@reformer/ui-kit/select';
import { Checkbox } from '@reformer/ui-kit/checkbox';
```

## Quick example

Bind a component to a ReFormer field via `useFormControl`:

```tsx
import { useFormControl, type FieldNode } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

function EmailField({ control }: { control: FieldNode<string> }) {
  const { value, disabled, errors, shouldShowError } = useFormControl(control);

  return (
    <Input
      type="email"
      value={value}
      disabled={disabled}
      onChange={(v) => control.setValue(v ?? '')}
      onBlur={() => control.markAsTouched()}
      aria-invalid={shouldShowError}
      placeholder={shouldShowError ? errors[0]?.message : 'you@example.com'}
    />
  );
}
```

## License

MIT

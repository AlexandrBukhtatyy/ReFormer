---
sidebar_position: 2
---

# Reactive State

ReFormer uses [Preact Signals](https://preactjs.com/guide/v10/signals/) for fine-grained reactivity.

## How It Works

Every node property is a Signal:

```typescript
import { FieldNode } from 'reformer';
import { effect } from '@preact/signals-react';

const name = new FieldNode({ value: '' });

// Subscribe to changes
effect(() => {
  console.log('Name changed:', name.value);
});

name.setValue('John'); // logs: "Name changed: John"
name.setValue('Jane'); // logs: "Name changed: Jane"
```

## Reactive Properties

All these properties are reactive:

```typescript
const field = new FieldNode({ value: '' });

// Value
field.value;      // reactive

// Validation state
field.valid;      // reactive
field.invalid;    // reactive
field.errors;     // reactive

// Interaction state
field.touched;    // reactive
field.dirty;      // reactive

// UI state
field.disabled;   // reactive
field.visible;    // reactive
```

## Computed Values

GroupNode and ArrayNode compute their value from children:

```typescript
const form = new GroupNode({
  schema: {
    firstName: new FieldNode({ value: '' }),
    lastName: new FieldNode({ value: '' }),
  },
});

// form.value is computed from children
effect(() => {
  console.log('Form value:', form.value);
});

form.controls.firstName.setValue('John');
// logs: { firstName: 'John', lastName: '' }

form.controls.lastName.setValue('Doe');
// logs: { firstName: 'John', lastName: 'Doe' }
```

## React Integration

The `useFormControl` hook subscribes to all field changes:

```tsx
import { useFormControl } from 'reformer';

function Input({ field }: { field: FieldNode<string> }) {
  const control = useFormControl(field);

  // Component re-renders when any property changes
  return (
    <div>
      <input
        value={control.value}
        onChange={(e) => control.setValue(e.target.value)}
        disabled={control.disabled}
      />
      {control.touched && control.errors?.required && (
        <span>Required</span>
      )}
    </div>
  );
}
```

## Performance

Signals provide fine-grained updates — only components using changed values re-render:

```tsx
function Form() {
  // This component doesn't re-render on field changes
  return (
    <form>
      <NameField />
      <EmailField />
      <SubmitButton />
    </form>
  );
}

function NameField() {
  const name = useFormControl(form.controls.name);
  // Only re-renders when name changes
  return <input value={name.value} />;
}

function EmailField() {
  const email = useFormControl(form.controls.email);
  // Only re-renders when email changes
  return <input value={email.value} />;
}
```

## Next Steps

- [Nodes](/docs/core-concepts/nodes) — Learn about node types
- [Validation](/docs/validation/overview) — Add validation rules

---
sidebar_position: 3
sidebar_label: Custom Fields
---

# Custom Fields

Basic guide for creating custom form field components with ReFormer.

## Basic Custom Field

A minimal reusable field component:

```tsx
import { FieldNode, useFormControl } from 'reformer';

interface TextFieldProps {
  field: FieldNode<string>;
  label: string;
  type?: 'text' | 'email' | 'password';
}

export function TextField({ field, label, type = 'text' }: TextFieldProps) {
  const { value, disabled, errors, shouldShowError, pending } = useFormControl(field);

  return (
    <div className="field">
      <label>{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => field.setValue(e.target.value)}
        onBlur={() => field.markAsTouched()}
        disabled={disabled}
      />
      {shouldShowError && errors.length > 0 && (
        <span className="error">{errors[0].message}</span>
      )}
      {pending && <span className="loading">Validating...</span>}
    </div>
  );
}
```

## Key Principles

### 1. Get State from useFormControl

```tsx
const { value, disabled, errors, shouldShowError, pending } = useFormControl(field);
```

| Property          | Description                              |
| ----------------- | ---------------------------------------- |
| `value`           | Current field value                      |
| `disabled`        | Is field disabled                        |
| `errors`          | Array of validation errors               |
| `shouldShowError` | Show error (field touched and invalid)   |
| `pending`         | Async validation in progress             |

### 2. Call Methods on the Field Node

```tsx
// Update value
field.setValue(newValue);

// Mark as touched (call on blur)
field.markAsTouched();
```

### 3. Handle Null Values

```tsx
// Always provide fallback for null/undefined
<input value={value ?? ''} />
```

### 4. Mark as Touched on Blur

```tsx
<input
  onBlur={() => field.markAsTouched()}
/>
```

This triggers error display after user interaction.

## Usage

```tsx
function MyForm() {
  const form = useMemo(() => createMyForm(), []);

  return (
    <form>
      <TextField field={form.controls.name} label="Name" />
      <TextField field={form.controls.email} label="Email" type="email" />
    </form>
  );
}
```

## Next Steps

- [Hooks](/docs/react/hooks) — useFormControl and useFormControlValue details

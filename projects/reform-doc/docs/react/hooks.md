---
sidebar_position: 1
sidebar_label: Hooks
---

# Hooks

ReFormer provides React hooks for seamless integration.

## useFormControl

Subscribe to field state changes.

```typescript
import { useFormControl } from 'reformer';

function TextField({ field }: { field: FieldNode<string> }) {
  const control = useFormControl(field);

  return (
    <input
      value={control.value}
      onChange={(e) => control.setValue(e.target.value)}
      onBlur={() => control.markAsTouched()}
      disabled={control.disabled}
    />
  );
}
```

### Returned Object

`useFormControl` returns the field with all reactive properties:

| Property | Type | Description |
|----------|------|-------------|
| `value` | `T` | Current value |
| `setValue(v)` | `function` | Update value |
| `valid` | `boolean` | Is valid |
| `invalid` | `boolean` | Has errors |
| `errors` | `object \| null` | Error object |
| `touched` | `boolean` | User interacted |
| `dirty` | `boolean` | Value changed |
| `disabled` | `boolean` | Is disabled |
| `visible` | `boolean` | Is visible |
| `pending` | `boolean` | Async validation running |

### Example: Complete Field

```tsx
function FormField({
  field,
  label,
}: {
  field: FieldNode<string>;
  label: string;
}) {
  const control = useFormControl(field);

  if (!control.visible) return null;

  return (
    <div className="form-field">
      <label>{label}</label>
      <input
        value={control.value}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
        disabled={control.disabled}
        className={control.invalid && control.touched ? 'error' : ''}
      />
      {control.touched && control.errors?.required && (
        <span className="error-message">This field is required</span>
      )}
      {control.touched && control.errors?.minLength && (
        <span className="error-message">
          Minimum {control.errors.minLength.required} characters
        </span>
      )}
      {control.pending && <span className="loading">Validating...</span>}
    </div>
  );
}
```

## Using with GroupNode

Access controls from GroupNode:

```tsx
function UserForm() {
  const form = useMemo(() => createUserForm(), []);

  return (
    <form>
      <FormField field={form.controls.firstName} label="First Name" />
      <FormField field={form.controls.lastName} label="Last Name" />
      <FormField field={form.controls.email} label="Email" />
    </form>
  );
}
```

## Using with ArrayNode

Render dynamic arrays:

```tsx
function PhoneList({ array }: { array: ArrayNode<PhoneSchema> }) {
  const control = useFormControl(array);

  return (
    <div>
      {control.controls.map((phone, index) => (
        <div key={phone.id}>
          <FormField field={phone.controls.type} label="Type" />
          <FormField field={phone.controls.number} label="Number" />
          <button onClick={() => array.removeAt(index)}>Remove</button>
        </div>
      ))}
      <button onClick={() => array.push({ type: 'mobile', number: '' })}>
        Add Phone
      </button>
    </div>
  );
}
```

## Form Submission

Handle form submit:

```tsx
function ContactForm() {
  const form = useMemo(() => createContactForm(), []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Show all validation errors
    form.markAllAsTouched();

    if (form.valid) {
      // Submit data
      console.log(form.value);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField field={form.controls.name} label="Name" />
      <FormField field={form.controls.email} label="Email" />

      <button type="submit" disabled={form.invalid}>
        Submit
      </button>
    </form>
  );
}
```

## Performance

`useFormControl` only re-renders when subscribed field changes:

```tsx
function Form() {
  // This component doesn't re-render on field changes
  return (
    <form>
      <NameField />  {/* Re-renders only when name changes */}
      <EmailField /> {/* Re-renders only when email changes */}
    </form>
  );
}
```

## Next Steps

- [Components](/docs/react/components) — Reusable form components
- [Examples](https://stackblitz.com/github/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-examples) — Live playground

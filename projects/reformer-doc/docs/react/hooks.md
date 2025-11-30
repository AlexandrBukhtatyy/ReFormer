---
sidebar_position: 1
sidebar_label: Hooks
---

# Hooks

ReFormer provides React hooks for seamless integration with React 18+.

## useFormControl

Subscribe to all field state changes. The component re-renders only when control data actually changes.

```typescript
import { useFormControl } from 'reformer';

function TextField({ field }: { field: FieldNode<string> }) {
  const { value, disabled, errors, shouldShowError } = useFormControl(field);

  return (
    <div>
      <input
        value={value}
        onChange={(e) => field.setValue(e.target.value)}
        onBlur={() => field.markAsTouched()}
        disabled={disabled}
      />
      {shouldShowError && errors.length > 0 && (
        <span className="error">{errors[0].message}</span>
      )}
    </div>
  );
}
```

### Return Value for FieldNode

| Property          | Type                     | Description                        |
| ----------------- | ------------------------ | ---------------------------------- |
| `value`           | `T`                      | Current value                      |
| `valid`           | `boolean`                | Is valid                           |
| `invalid`         | `boolean`                | Has errors                         |
| `errors`          | `ValidationError[]`      | Array of validation errors         |
| `touched`         | `boolean`                | User interacted with field         |
| `disabled`        | `boolean`                | Is disabled                        |
| `pending`         | `boolean`                | Async validation in progress       |
| `shouldShowError` | `boolean`                | Should display error (touched + invalid) |
| `componentProps`  | `Record<string, any>`    | Custom props for component         |

### Return Value for ArrayNode

| Property   | Type                | Description                  |
| ---------- | ------------------- | ---------------------------- |
| `value`    | `T[]`               | Current array value          |
| `length`   | `number`            | Number of items in array     |
| `valid`    | `boolean`           | Is valid                     |
| `invalid`  | `boolean`           | Has errors                   |
| `errors`   | `ValidationError[]` | Array of validation errors   |
| `touched`  | `boolean`           | User interacted              |
| `dirty`    | `boolean`           | Value changed from initial   |
| `pending`  | `boolean`           | Async validation in progress |

### Example: Complete Field Component

```tsx
function FormField({ field, label }: { field: FieldNode<string>; label: string }) {
  const { value, disabled, errors, shouldShowError, pending } = useFormControl(field);

  return (
    <div className="form-field">
      <label>{label}</label>
      <input
        value={value}
        onChange={(e) => field.setValue(e.target.value)}
        onBlur={() => field.markAsTouched()}
        disabled={disabled}
      />
      {shouldShowError && errors.length > 0 && (
        <span className="error-message">{errors[0].message}</span>
      )}
      {pending && <span className="loading">Validating...</span>}
    </div>
  );
}
```

---

## useFormControlValue

Subscribe to field value only, without tracking errors, valid, touched, etc. Use this when you need only the value for conditional rendering — it provides better performance by avoiding unnecessary re-renders.

```typescript
import { useFormControlValue } from 'reformer';

function ConditionalField({
  showWhenField,
  field
}: {
  showWhenField: FieldNode<string>;
  field: FieldNode<string>;
}) {
  // Re-renders only when showWhenField.value changes
  const showWhenValue = useFormControlValue(showWhenField);

  if (showWhenValue !== 'show') {
    return null;
  }

  return <TextField field={field} />;
}
```

### Return Value

| Type | Description      |
| ---- | ---------------- |
| `T`  | Current value    |

### When to Use

Use `useFormControlValue` instead of `useFormControl` when:

- You need only the value for conditional rendering
- You want to minimize re-renders
- You don't need validation state or other properties

```tsx
// ❌ Inefficient - re-renders on any state change
function BadExample({ field }: { field: FieldNode<string> }) {
  const { value } = useFormControl(field);
  return <span>Selected: {value}</span>;
}

// ✅ Efficient - re-renders only on value change
function GoodExample({ field }: { field: FieldNode<string> }) {
  const value = useFormControlValue(field);
  return <span>Selected: {value}</span>;
}
```

---

## Usage Examples

### With GroupNode

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

### With ArrayNode

Render dynamic arrays:

```tsx
function PhoneList({ array }: { array: ArrayNode<PhoneSchema> }) {
  const { length } = useFormControl(array);

  return (
    <div>
      {array.map((phone, index) => (
        <div key={phone.id}>
          <FormField field={phone.controls.type} label="Type" />
          <FormField field={phone.controls.number} label="Number" />
          <button onClick={() => array.removeAt(index)}>Remove</button>
        </div>
      ))}
      {length === 0 && <span>No phones added</span>}
      <button onClick={() => array.push({ type: 'mobile', number: '' })}>
        Add Phone
      </button>
    </div>
  );
}
```

### Form Submission

Handle form submit:

```tsx
function ContactForm() {
  const form = useMemo(() => createContactForm(), []);
  const { invalid } = useFormControl(form.controls.email);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.markAsTouched();

    if (form.valid) {
      console.log(form.value);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField field={form.controls.name} label="Name" />
      <FormField field={form.controls.email} label="Email" />
      <button type="submit" disabled={invalid}>Submit</button>
    </form>
  );
}
```

---

## Performance

Both hooks use `useSyncExternalStore` for optimal React 18+ integration:

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

- [Custom Fields](/docs/react/custom-fields) — Building custom form fields
- [Examples](https://stackblitz.com/~/github.com/AButsai/ReFormer/tree/main/projects/react-playground) — Live playground
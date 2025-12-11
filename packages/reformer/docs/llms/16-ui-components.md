## 14.5 UI COMPONENT PATTERNS

ReFormer does NOT provide UI components - you create them yourself or use a UI library.

### Generic FormField Component

```tsx
import type { FieldNode } from '@reformer/core';
import { useFormControl } from '@reformer/core';

interface FormFieldProps<T> {
  control: FieldNode<T>;
  label?: string;
  type?: 'text' | 'email' | 'number' | 'password';
  placeholder?: string;
}

function FormField<T extends string | number>({
  control,
  label,
  type = 'text',
  placeholder
}: FormFieldProps<T>) {
  const { value, errors, disabled, touched } = useFormControl(control);
  const showError = touched && errors.length > 0;

  return (
    <div className="form-field">
      {label && <label>{label}</label>}
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => {
          const val = type === 'number'
            ? Number(e.target.value) as T
            : e.target.value as T;
          control.setValue(val);
        }}
        onBlur={() => control.markAsTouched()}
        disabled={disabled}
        placeholder={placeholder}
        className={showError ? 'error' : ''}
      />
      {showError && (
        <span className="error-message">{errors[0].message}</span>
      )}
    </div>
  );
}

// Usage
<FormField control={form.email} label="Email" type="email" />
<FormField control={form.age} label="Age" type="number" />
```

### FormField for Select

```tsx
interface SelectFieldProps<T extends string> {
  control: FieldNode<T>;
  label?: string;
  options: Array<{ value: T; label: string }>;
}

function SelectField<T extends string>({ control, label, options }: SelectFieldProps<T>) {
  const { value, errors, disabled, touched } = useFormControl(control);

  return (
    <div className="form-field">
      {label && <label>{label}</label>}
      <select
        value={value}
        onChange={(e) => control.setValue(e.target.value as T)}
        disabled={disabled}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {touched && errors[0] && <span className="error-message">{errors[0].message}</span>}
    </div>
  );
}
```

### Integration with UI Libraries

```tsx
// With shadcn/ui
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function ShadcnFormField({ control, label }: FormFieldProps<string>) {
  const { value, errors, disabled } = useFormControl(control);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => control.setValue(e.target.value)} disabled={disabled} />
      {errors[0] && <p className="text-red-500">{errors[0].message}</p>}
    </div>
  );
}
```

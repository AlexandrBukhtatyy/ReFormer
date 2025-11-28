---
sidebar_position: 2
---

# Field Components

Creating basic components for form fields.

## Overview

Field components in ReFormer:

- Wrap native elements or UI library components
- Follow a standard interface (value, onChange, onBlur, disabled)
- Can be styled and customized freely

This pattern is essential for:

- Consistent look and behavior across all forms
- Full control over styling and accessibility
- Easy integration with any UI library

## How Field Components Work

The field component pattern consists of three parts:

1. **Props interface** — defines required props: `value`, `onChange`, `onBlur`, `disabled`
2. **Component** — controlled component with null handling
3. **forwardRef + displayName** — for DOM access and debugging

```tsx
import * as React from 'react';

// 1. Props interface
interface InputProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

// 2. Component
const InputComponent = React.forwardRef<HTMLInputElement, InputProps>(
  ({ value, onChange, onBlur, disabled, placeholder, className }, ref) => {
    return (
      <input
        ref={ref}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value || null)}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
      />
    );
  }
);

// 3. displayName
InputComponent.displayName = 'Input';

export const Input = InputComponent;
```

### Props Reference

| Prop | Type | Description |
|------|------|-------------|
| `value` | `T` | Current field value |
| `onChange` | `(value: T) => void` | Handler for value changes |
| `onBlur` | `() => void` | Handler for blur event (triggers validation) |
| `disabled` | `boolean` | Whether the field is disabled |

Additional props like `placeholder`, `label`, `options` are passed through `componentProps` in the schema.

### Usage in Form Schema

A field component is connected to the form through the schema:

```tsx
import { Input } from './components/ui/Input';

const form = createForm<{ email: string }>({
  email: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Email',
      type: 'email',
      placeholder: 'Enter your email'
    }
  }
});
```

## Tutorial Implementations

All components shown below use native HTML elements for clarity. You can replace them with your preferred UI library.

### Input

A text input that handles both text and number types:

```tsx title="src/components/ui/Input.tsx"
import * as React from 'react';

export interface InputProps {
  value?: string | number | null;
  onChange?: (value: string | number | null) => void;
  onBlur?: () => void;
  type?: 'text' | 'email' | 'number' | 'tel' | 'url' | 'password';
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ value, onChange, onBlur, type = 'text', placeholder, disabled, className }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;

      if (type === 'number') {
        // Convert to number or null for empty value
        onChange?.(newValue === '' ? null : Number(newValue));
      } else {
        onChange?.(newValue || null);
      }
    };

    // Convert value to string for display
    const displayValue = value ?? '';

    return (
      <input
        ref={ref}
        type={type}
        value={displayValue}
        onChange={handleChange}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
      />
    );
  }
);

Input.displayName = 'Input';
```

### Textarea

A multi-line text input:

```tsx title="src/components/ui/Textarea.tsx"
import * as React from 'react';

export interface TextareaProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  className?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ value, onChange, onBlur, placeholder, disabled, rows = 3, className }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(event.target.value || null);
    };

    return (
      <textarea
        ref={ref}
        value={value || ''}
        onChange={handleChange}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        className={className}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
```

### Select

A dropdown select component with options:

```tsx title="src/components/ui/Select.tsx"
import * as React from 'react';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  options?: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ value, onChange, onBlur, options = [], placeholder, disabled, className }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
      const newValue = event.target.value;
      onChange?.(newValue || null);
    };

    return (
      <select
        ref={ref}
        value={value || ''}
        onChange={handleChange}
        onBlur={onBlur}
        disabled={disabled}
        className={className}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
);

Select.displayName = 'Select';
```

### Checkbox

A checkbox component for boolean values:

```tsx title="src/components/ui/Checkbox.tsx"
import * as React from 'react';

export interface CheckboxProps {
  value?: boolean;
  onChange?: (value: boolean) => void;
  onBlur?: () => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ value, onChange, onBlur, label, disabled, className }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event.target.checked);
    };

    return (
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          type="checkbox"
          checked={value || false}
          onChange={handleChange}
          onBlur={onBlur}
          disabled={disabled}
          className={className}
        />
        {label && <label>{label}</label>}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
```

### RadioGroup

A group of radio buttons:

```tsx title="src/components/ui/RadioGroup.tsx"
import * as React from 'react';

export interface RadioOption {
  value: string;
  label: string;
}

export interface RadioGroupProps {
  value?: string | null;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  options: RadioOption[];
  disabled?: boolean;
  className?: string;
}

export const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ value, onChange, onBlur, options, disabled, className }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event.target.value);
    };

    return (
      <div ref={ref} className={className}>
        {options.map((option) => (
          <div key={option.value} className="flex items-center gap-2">
            <input
              type="radio"
              value={option.value}
              checked={value === option.value}
              onChange={handleChange}
              onBlur={onBlur}
              disabled={disabled}
            />
            <label>{option.label}</label>
          </div>
        ))}
      </div>
    );
  }
);

RadioGroup.displayName = 'RadioGroup';
```

## Using UI Libraries

You can use existing UI libraries like Radix UI, shadcn/ui, or Material UI. Just ensure your wrapper components follow the interface pattern described above.

Example adapting a Radix UI Select:

```tsx
import * as SelectPrimitive from '@radix-ui/react-select';

interface SelectProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}

export function Select({ value, onChange, onBlur, options, placeholder, disabled }: SelectProps) {
  return (
    <SelectPrimitive.Root
      value={value || ''}
      onValueChange={(val) => onChange?.(val || null)}
      onOpenChange={(open) => !open && onBlur?.()}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger>
        <SelectPrimitive.Value placeholder={placeholder} />
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content>
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item key={option.value} value={option.value}>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
```

The reform-tutorial project uses shadcn/ui components built on Radix UI primitives.

## Best Practices

### 1. Controlled Components

All components should be controlled — they receive `value` and call `onChange` to update it. Never store local state for the field value:

```tsx
// Good - controlled
const Input = ({ value, onChange }) => (
  <input value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} />
);

// Bad - uncontrolled with local state
const Input = ({ defaultValue }) => {
  const [value, setValue] = useState(defaultValue);
  return <input value={value} onChange={(e) => setValue(e.target.value)} />;
};
```

### 2. Null Handling

Empty values should be represented as `null`, not empty strings. This helps with validation and data processing:

```tsx
// Good
onChange?.(newValue || null);

// Avoid
onChange?.(newValue);
```

### 3. Forward Refs

Use `React.forwardRef` to allow parent components to access the underlying DOM element:

```tsx
export const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return <input ref={ref} {...props} />;
});
```

### 4. Display Name

Set `displayName` for easier debugging in React DevTools:

```tsx
Input.displayName = 'Input';
```

### 5. Accessibility

Support `aria-invalid` for validation states:

```tsx
<input
  aria-invalid={hasError}
  className={cn(baseStyles, hasError && errorStyles)}
  {...props}
/>
```

## Next Step

Now that you have your field components, let's create the `FormField` component that connects them to the form state.

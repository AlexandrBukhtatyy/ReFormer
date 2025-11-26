---
sidebar_position: 2
---

# Field Components

Creating basic components for form fields.

## Overview

ReFormer uses your own components to render form fields. This gives you full control over styling and behavior. In this section, we'll create the basic components needed for our Credit Application form.

## Component Requirements

For a component to work with `FormField`, it must accept these props:

| Prop | Type | Description |
|------|------|-------------|
| `value` | `T` | Current field value |
| `onChange` | `(value: T) => void` | Handler for value changes |
| `onBlur` | `() => void` | Handler for blur event (triggers validation) |
| `disabled` | `boolean` | Whether the field is disabled |

Additional props like `placeholder`, `label`, `options` are passed through `componentProps`.

## Input Component

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

### Usage in Form Schema

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

## Select Component

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

### Usage in Form Schema

```tsx
import { Select } from './components/ui/Select';

const form = createForm<{ loanType: string }>({
  loanType: {
    value: '',
    component: Select,
    componentProps: {
      label: 'Loan Type',
      placeholder: 'Select loan type',
      options: [
        { value: 'consumer', label: 'Consumer Loan' },
        { value: 'mortgage', label: 'Mortgage' },
        { value: 'car', label: 'Car Loan' }
      ]
    }
  }
});
```

## Checkbox Component

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

### Usage in Form Schema

```tsx
import { Checkbox } from './components/ui/Checkbox';

const form = createForm<{ agreeToTerms: boolean }>({
  agreeToTerms: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'I agree to the terms and conditions'
    }
  }
});
```

## Textarea Component

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

## RadioGroup Component

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

### Usage in Form Schema

```tsx
import { RadioGroup } from './components/ui/RadioGroup';

const form = createForm<{ gender: string }>({
  gender: {
    value: '',
    component: RadioGroup,
    componentProps: {
      label: 'Gender',
      options: [
        { value: 'male', label: 'Male' },
        { value: 'female', label: 'Female' }
      ]
    }
  }
});
```

## Key Patterns

### 1. Controlled Components

All components should be controlled — they receive `value` and call `onChange` to update it. Never store local state for the field value.

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
  return <input ref={ref} {...} />;
});
```

### 4. Display Name

Set `displayName` for easier debugging:

```tsx
Input.displayName = 'Input';
```

## Using UI Libraries

You can use existing UI libraries like Radix UI, shadcn/ui, or Material UI. Just ensure your wrapper components follow the interface pattern above.

Example with Radix UI Select:

```tsx
import * as SelectPrimitive from '@radix-ui/react-select';

export const Select = ({ value, onChange, onBlur, options, ...props }) => {
  return (
    <SelectPrimitive.Root
      value={value || ''}
      onValueChange={onChange}
      onOpenChange={(open) => !open && onBlur?.()}
    >
      {/* ... Radix UI implementation */}
    </SelectPrimitive.Root>
  );
};
```

## Next Steps

Now that you have your field components and `FormField`, you're ready to define the form schema for the Credit Application form.

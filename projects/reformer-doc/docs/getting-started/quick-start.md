---
sidebar_position: 2
---

# Quick Start

Build a simple contact form in 5 minutes.

## Step 1: Create Field Components

ReFormer uses your own components to render form fields.

### Basic Components

```tsx title="src/components/ui/Input.tsx"
import * as React from 'react';

interface InputProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ value, onChange, onBlur, placeholder, disabled }, ref) => (
    <input
      ref={ref}
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      disabled={disabled}
      className="border rounded px-3 py-2 w-full"
    />
  )
);
```

```tsx title="src/components/ui/Textarea.tsx"
import * as React from 'react';

interface TextareaProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ value, onChange, onBlur, placeholder, disabled }, ref) => (
    <textarea
      ref={ref}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      disabled={disabled}
      rows={4}
      className="border rounded px-3 py-2 w-full"
    />
  )
);
```

### Universal FormField Component

```tsx title="src/components/ui/FormField.tsx"
import * as React from 'react';
import { useFormControl, type FieldNode } from 'reformer';

interface FormFieldProps {
  control: FieldNode<any>;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({ control, className }) => {
  const { value, errors, disabled, shouldShowError, componentProps } =
    useFormControl(control);

  const Component = control.component;

  return (
    <div className={className}>
      {componentProps.label && (
        <label className="block mb-1 text-sm font-medium">
          {componentProps.label}
        </label>
      )}

      <Component
        {...componentProps}
        value={value ?? ''}
        onChange={(e: unknown) => {
          const newValue = (e as { target?: { value?: unknown } })?.target?.value ?? e;
          control.setValue(newValue);
        }}
        onBlur={() => control.markAsTouched()}
        disabled={disabled}
      />

      {shouldShowError && (
        <span className="text-red-500 text-sm mt-1 block">
          {errors[0]?.message}
        </span>
      )}
    </div>
  );
};
```

:::tip Why FormField?
`FormField` automatically:
- Renders label from `componentProps`
- Binds value to form state
- Calls `markAsTouched()` on blur
- Shows validation errors
:::

## Step 2: Define Form Interface

```typescript
type ContactFormType = {
  name: string;
  email: string;
  message: string;
};
```

## Step 3: Create Form Definition

```typescript title="src/forms/contact-form.ts"
import { createForm } from 'reformer';
import { required, email, minLength } from 'reformer/validators';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

type ContactFormType = {
  name: string;
  email: string;
  message: string;
};

export const createContactForm = () =>
  createForm<ContactFormType>({
    form: {
      name: { value: '', component: Input, componentProps: { label: 'Name' } },
      email: { value: '', component: Input, componentProps: { label: 'Email' } },
      message: { value: '', component: Textarea, componentProps: { label: 'Message' } },
    },
    validation: (path) => {
      required(path.name);
      minLength(path.name, 2);
      required(path.email);
      email(path.email);
      required(path.message);
      minLength(path.message, 10);
    },
  });
```

:::info Key Points
- **`createForm<T>`** — factory function with automatic typing
- **`component`** — React component to render the field
- **`componentProps`** — props passed to the component (label, placeholder, etc.)
- **`validation`** — declarative validation schema
:::

## Step 4: Create Form Component

```tsx title="src/components/ContactForm.tsx"
import { useMemo } from 'react';
import { createContactForm } from '@/forms/contact-form';
import { FormField } from '@/components/ui/FormField';

export function ContactForm() {
  const form = useMemo(() => createContactForm(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    form.markAsTouched();
    await form.validate();

    if (form.valid.value) {
      console.log('Submit:', form.value.value);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <FormField control={form.name} />
      <FormField control={form.email} />
      <FormField control={form.message} />

      <button
        type="submit"
        disabled={form.invalid.value}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        Submit
      </button>
    </form>
  );
}
```

## Result

You've created a form with:
- ✅ TypeScript type safety
- ✅ Declarative validation
- ✅ Automatic error display
- ✅ Clean and minimal code

## Next Steps

- [Core Concepts](/docs/core-concepts/nodes) — Learn about Nodes in depth
- [Validation](/docs/validation/overview) — All built-in validators
- [Behaviors](/docs/behaviors/overview) — Computed fields and conditional logic

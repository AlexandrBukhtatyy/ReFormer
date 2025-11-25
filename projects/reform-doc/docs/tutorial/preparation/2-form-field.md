---
sidebar_position: 1
---

# FormField Component

Universal component for rendering form fields with validation.

## Overview

The `FormField` component is a universal wrapper that connects your UI components to ReFormer's form state. It:

- Renders labels from `componentProps`
- Binds values to form state
- Handles `onChange` and `onBlur` events
- Displays validation errors
- Shows pending state during async validation

## useFormControl Hook

The `useFormControl` hook extracts reactive state from a `FieldNode`:

```tsx
import { useFormControl, type FieldNode } from 'reformer';

const { value, errors, pending, disabled, shouldShowError, componentProps } = useFormControl(control);
```

### Return Values

| Property | Type | Description |
|----------|------|-------------|
| `value` | `T` | Current field value |
| `errors` | `ValidationError[]` | Array of validation errors |
| `pending` | `boolean` | `true` during async validation |
| `disabled` | `boolean` | Whether the field is disabled |
| `shouldShowError` | `boolean` | `true` if field is touched and has errors |
| `componentProps` | `object` | Props passed to component (label, placeholder, etc.) |

## FormField Implementation

```tsx title="src/components/ui/FormField.tsx"
import * as React from 'react';
import { useFormControl, type FieldNode } from 'reformer';
import { Checkbox } from './checkbox';

export interface FormFieldProps {
  control: FieldNode<any>;
  className?: string;
}

const FormFieldComponent: React.FC<FormFieldProps> = ({ control, className }) => {
  const { value, errors, pending, disabled, shouldShowError, componentProps } =
    useFormControl(control);

  const Component = control.component;
  const isCheckbox = Component === Checkbox;

  // Convert null/undefined to safe values
  const safeValue = value ?? (isCheckbox ? false : '');

  return (
    <div className={className}>
      {/* Render label (except for checkboxes which have built-in labels) */}
      {componentProps.label && !isCheckbox && (
        <label className="block mb-1 text-sm font-medium">
          {componentProps.label}
        </label>
      )}

      {/* Render the actual component */}
      <Component
        {...componentProps}
        value={safeValue}
        onChange={(e: unknown) => {
          // For checkboxes, e is a boolean directly
          // For regular inputs, e is an event with target.value
          const newValue = isCheckbox
            ? e
            : ((e as { target?: { value?: unknown } })?.target?.value ?? e);
          control.setValue(newValue);
        }}
        onBlur={() => {
          control.markAsTouched();
        }}
        disabled={disabled}
        aria-invalid={shouldShowError}
      />

      {/* Show validation error */}
      {shouldShowError && (
        <span className="text-red-500 text-sm mt-1 block">
          {errors[0]?.message}
        </span>
      )}

      {/* Show pending state during async validation */}
      {pending && (
        <span className="text-gray-500 text-sm mt-1 block">
          Validating...
        </span>
      )}
    </div>
  );
};
```

## Memoization

To prevent unnecessary re-renders when other fields change, wrap the component with `React.memo`:

```tsx title="src/components/ui/FormField.tsx"
export const FormField = React.memo(FormFieldComponent, (prevProps, nextProps) => {
  // Return true if props have NOT changed (skip re-render)
  return (
    prevProps.control === nextProps.control &&
    prevProps.className === nextProps.className
  );
});
```

This optimization is important because:
- Each `FieldNode` is a stable reference
- The component only re-renders when its specific field changes
- Other fields changing won't cause this component to re-render

## Usage

```tsx
import { FormField } from './components/ui/FormField';

function MyForm() {
  const form = createForm<PersonalInfo>({
    firstName: {
      value: '',
      component: Input,
      componentProps: { label: 'First Name', placeholder: 'Enter your name' }
    },
    agreeToTerms: {
      value: false,
      component: Checkbox,
      componentProps: { label: 'I agree to terms' }
    }
  });

  return (
    <form>
      <FormField control={form.controls.firstName} className="mb-4" />
      <FormField control={form.controls.agreeToTerms} className="mb-4" />
    </form>
  );
}
```

## Key Concepts

### Value Binding

The `FormField` reads the current value from `useFormControl` and passes it to the component. When the user changes the value, it calls `control.setValue()` to update the form state.

### Touch State

Calling `control.markAsTouched()` on blur marks the field as "touched". This is used by `shouldShowError` to only show validation errors after the user has interacted with the field.

### Error Display

The `shouldShowError` flag is `true` when:
- The field has been touched (`touched = true`)
- The field has validation errors (`errors.length > 0`)

This prevents showing errors before the user has had a chance to fill in the field.

## Next Steps

Now that you have the `FormField` component, you need to create the actual UI components (Input, Select, Checkbox, etc.) that will be rendered inside it.

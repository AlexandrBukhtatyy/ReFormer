---
sidebar_position: 6
---

# Error Handling

Strategies for handling and displaying validation errors effectively.

## Basic Error Display

### Inline Field Errors

Show errors below each field:

```tsx
import { useFormControl } from 'reformer';
import { FieldNode } from 'reformer';

interface TextFieldProps {
  field: FieldNode<string>;
  label: string;
}

export function TextField({ field, label }: TextFieldProps) {
  const control = useFormControl(field);

  const showError = control.touched && control.invalid;

  return (
    <div className="text-field">
      <label>{label}</label>
      <input
        value={control.value ?? ''}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
        className={showError ? 'error' : ''}
      />
      {showError && control.errors && (
        <span className="error-message">
          {getErrorMessage(control.errors)}
        </span>
      )}
    </div>
  );
}
```

### Error Message Mapper

Centralized error message handling:

```typescript title="utils/error-messages.ts"
export type ErrorKey =
  | 'required'
  | 'email'
  | 'minLength'
  | 'maxLength'
  | 'min'
  | 'max'
  | 'pattern'
  | 'usernameTaken'
  | 'emailTaken'
  | 'passwordMismatch';

export const errorMessages: Record<
  ErrorKey,
  (params: any) => string
> = {
  required: () => 'This field is required',
  email: () => 'Please enter a valid email address',
  minLength: (p) => `Must be at least ${p.required} characters`,
  maxLength: (p) => `Must be no more than ${p.required} characters`,
  min: (p) => `Must be at least ${p.min}`,
  max: (p) => `Must be no more than ${p.max}`,
  pattern: (p) => p.message || 'Invalid format',
  usernameTaken: () => 'This username is already taken',
  emailTaken: () => 'This email is already registered',
  passwordMismatch: () => 'Passwords do not match',
};

export function getErrorMessage(errors: Record<string, any>): string {
  const [key, params] = Object.entries(errors)[0];
  const getMessage = errorMessages[key as ErrorKey];
  return getMessage ? getMessage(params) : 'Invalid value';
}
```

## Field-Level Error Handling

### Multiple Errors Display

Show all errors for a field:

```tsx
interface ErrorListProps {
  errors: Record<string, any>;
}

export function ErrorList({ errors }: ErrorListProps) {
  if (!errors || Object.keys(errors).length === 0) return null;

  return (
    <ul className="error-list">
      {Object.entries(errors).map(([key, params]) => {
        const message = errorMessages[key as ErrorKey]?.(params) || 'Invalid value';
        return (
          <li key={key} className="error-list__item">
            {message}
          </li>
        );
      })}
    </ul>
  );
}

// Usage
<TextField field={form.controls.password} label="Password" />
{password.touched && password.errors && (
  <ErrorList errors={password.errors} />
)}
```

### Error Icons

Visual error indicators:

```tsx
import { XCircle, CheckCircle, Loader } from 'lucide-react';

export function TextField({ field, label }: TextFieldProps) {
  const control = useFormControl(field);

  return (
    <div className="text-field">
      <label>{label}</label>
      <div className="text-field__input-wrapper">
        <input
          value={control.value ?? ''}
          onChange={(e) => control.setValue(e.target.value)}
          onBlur={() => control.markAsTouched()}
        />
        <div className="text-field__icon">
          {control.pending && <Loader className="spin" />}
          {!control.pending && control.touched && control.valid && (
            <CheckCircle className="success" />
          )}
          {!control.pending && control.touched && control.invalid && (
            <XCircle className="error" />
          )}
        </div>
      </div>
      {control.touched && control.errors && (
        <ErrorMessage errors={control.errors} />
      )}
    </div>
  );
}
```

### Tooltip Errors

Show errors in tooltips:

```tsx
import { Tooltip } from '@radix-ui/react-tooltip';

export function TextField({ field, label }: TextFieldProps) {
  const control = useFormControl(field);

  const showError = control.touched && control.invalid;

  return (
    <div className="text-field">
      <label>{label}</label>
      <Tooltip open={showError}>
        <Tooltip.Trigger asChild>
          <input
            value={control.value ?? ''}
            onChange={(e) => control.setValue(e.target.value)}
            onBlur={() => control.markAsTouched()}
            className={showError ? 'error' : ''}
          />
        </Tooltip.Trigger>
        {showError && control.errors && (
          <Tooltip.Content className="tooltip-error">
            {getErrorMessage(control.errors)}
          </Tooltip.Content>
        )}
      </Tooltip>
    </div>
  );
}
```

## Form-Level Error Handling

### Error Summary

Display all form errors at top:

```tsx
interface ErrorSummaryProps {
  form: GroupNode<any>;
}

export function ErrorSummary({ form }: ErrorSummaryProps) {
  const formErrors = useFormControl(form).errors;

  if (!formErrors) return null;

  const allErrors = collectAllErrors(form);

  if (allErrors.length === 0) return null;

  return (
    <div className="error-summary" role="alert">
      <h3>Please fix the following errors:</h3>
      <ul>
        {allErrors.map((error, index) => (
          <li key={index}>
            <a href={`#field-${error.fieldName}`}>
              {error.fieldLabel}: {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Helper to collect all errors
function collectAllErrors(form: GroupNode<any>) {
  const errors: Array<{
    fieldName: string;
    fieldLabel: string;
    message: string;
  }> = [];

  // Recursively collect errors from all fields
  const collectFromNode = (node: any, path: string[] = []) => {
    if (node.errors?.value) {
      const fieldName = path.join('.');
      const message = getErrorMessage(node.errors.value);
      errors.push({
        fieldName,
        fieldLabel: path[path.length - 1],
        message,
      });
    }

    if (node.controls) {
      Object.entries(node.controls).forEach(([key, child]) => {
        collectFromNode(child, [...path, key]);
      });
    }
  };

  collectFromNode(form);
  return errors;
}
```

### Toast Notifications

Show errors as toast notifications:

```tsx
import { toast } from 'react-hot-toast';

export function FormWithToasts() {
  const form = useMemo(() => createMyForm(), []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.markAllAsTouched();

    if (form.invalid.value) {
      const errors = collectAllErrors(form);
      errors.forEach((error) => {
        toast.error(`${error.fieldLabel}: ${error.message}`);
      });
      return;
    }

    // Submit form
    console.log('Valid:', form.getValue());
  };

  return <form onSubmit={handleSubmit}>{/* fields */}</form>;
}
```

### Modal Error Dialog

Show errors in a modal:

```tsx
import { Dialog } from '@radix-ui/react-dialog';
import { useState } from 'react';

export function FormWithErrorModal() {
  const form = useMemo(() => createMyForm(), []);
  const [showErrors, setShowErrors] = useState(false);
  const [errors, setErrors] = useState<any[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.markAllAsTouched();

    if (form.invalid.value) {
      const allErrors = collectAllErrors(form);
      setErrors(allErrors);
      setShowErrors(true);
      return;
    }

    // Submit form
  };

  return (
    <>
      <form onSubmit={handleSubmit}>{/* fields */}</form>

      <Dialog open={showErrors} onOpenChange={setShowErrors}>
        <Dialog.Content>
          <Dialog.Title>Form Errors</Dialog.Title>
          <Dialog.Description>
            Please fix the following errors:
          </Dialog.Description>
          <ul>
            {errors.map((error, index) => (
              <li key={index}>
                <strong>{error.fieldLabel}:</strong> {error.message}
              </li>
            ))}
          </ul>
          <Dialog.Close asChild>
            <button>Close</button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog>
    </>
  );
}
```

## Server Error Handling

### Set Server Errors

Handle errors from server:

```tsx
const form = useMemo(() => createRegistrationForm(), []);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  form.markAllAsTouched();

  if (form.invalid.value) return;

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      body: JSON.stringify(form.getValue()),
    });

    if (!response.ok) {
      const errors = await response.json();

      // Set server errors on fields
      if (errors.username) {
        form.controls.username.setErrors({ serverError: errors.username });
      }
      if (errors.email) {
        form.controls.email.setErrors({ serverError: errors.email });
      }

      return;
    }

    // Success
    console.log('Registered!');
  } catch (error) {
    console.error('Network error:', error);
  }
};
```

### Generic Server Error

Show generic server error:

```tsx
const [serverError, setServerError] = useState<string | null>(null);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setServerError(null);
  form.markAllAsTouched();

  if (form.invalid.value) return;

  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      body: JSON.stringify(form.getValue()),
    });

    if (!response.ok) {
      const error = await response.json();
      setServerError(error.message || 'An error occurred');
      return;
    }

    // Success
  } catch (error) {
    setServerError('Network error. Please try again.');
  }
};

return (
  <form onSubmit={handleSubmit}>
    {serverError && (
      <div className="alert alert-error" role="alert">
        {serverError}
      </div>
    )}
    {/* fields */}
  </form>
);
```

## Error Localization

### Localized Error Messages

Support multiple languages:

```typescript title="utils/error-messages-i18n.ts"
type Locale = 'en' | 'es' | 'fr';

const errorMessagesLocalized: Record<
  Locale,
  Record<ErrorKey, (params: any) => string>
> = {
  en: {
    required: () => 'This field is required',
    email: () => 'Please enter a valid email',
    minLength: (p) => `Must be at least ${p.required} characters`,
    // ...
  },
  es: {
    required: () => 'Este campo es obligatorio',
    email: () => 'Por favor ingrese un email válido',
    minLength: (p) => `Debe tener al menos ${p.required} caracteres`,
    // ...
  },
  fr: {
    required: () => 'Ce champ est requis',
    email: () => 'Veuillez entrer un email valide',
    minLength: (p) => `Doit contenir au moins ${p.required} caractères`,
    // ...
  },
};

export function getLocalizedErrorMessage(
  errors: Record<string, any>,
  locale: Locale = 'en'
): string {
  const [key, params] = Object.entries(errors)[0];
  const getMessage = errorMessagesLocalized[locale][key as ErrorKey];
  return getMessage ? getMessage(params) : 'Invalid value';
}
```

### Using with React Context

```tsx
import { createContext, useContext } from 'react';

const LocaleContext = createContext<Locale>('en');

export function ErrorMessage({ errors }: { errors: Record<string, any> }) {
  const locale = useContext(LocaleContext);
  const message = getLocalizedErrorMessage(errors, locale);

  return <span className="error-message">{message}</span>;
}

// App wrapper
<LocaleContext.Provider value="es">
  <MyForm />
</LocaleContext.Provider>
```

## Error Styling

### CSS Classes

Style errors with CSS:

```css
/* Error input */
.input-error {
  border-color: #dc2626;
  background-color: #fef2f2;
}

.input-error:focus {
  outline-color: #dc2626;
  border-color: #dc2626;
}

/* Error message */
.error-message {
  color: #dc2626;
  font-size: 0.875rem;
  margin-top: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* Error icon */
.error-icon {
  color: #dc2626;
  width: 1rem;
  height: 1rem;
}

/* Success state */
.input-success {
  border-color: #16a34a;
}

.success-icon {
  color: #16a34a;
}

/* Error summary */
.error-summary {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.error-summary h3 {
  color: #dc2626;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.error-summary ul {
  list-style: disc;
  padding-left: 1.5rem;
}

.error-summary a {
  color: #dc2626;
  text-decoration: underline;
}
```

### Tailwind CSS

Use Tailwind utility classes:

```tsx
export function TextField({ field, label }: TextFieldProps) {
  const control = useFormControl(field);
  const showError = control.touched && control.invalid;

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        value={control.value ?? ''}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
        className={`
          block w-full rounded-md px-3 py-2
          focus:outline-none focus:ring-2
          ${
            showError
              ? 'border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          }
        `}
      />
      {showError && control.errors && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <XCircle className="h-4 w-4" />
          {getErrorMessage(control.errors)}
        </p>
      )}
    </div>
  );
}
```

## Accessibility

### ARIA Attributes

Make errors accessible:

```tsx
export function TextField({ field, label }: TextFieldProps) {
  const control = useFormControl(field);
  const showError = control.touched && control.invalid;
  const errorId = `${field.id}-error`;

  return (
    <div className="text-field">
      <label htmlFor={field.id}>{label}</label>
      <input
        id={field.id}
        value={control.value ?? ''}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
        aria-invalid={showError}
        aria-describedby={showError ? errorId : undefined}
      />
      {showError && control.errors && (
        <span id={errorId} className="error-message" role="alert">
          {getErrorMessage(control.errors)}
        </span>
      )}
    </div>
  );
}
```

### Focus Management

Auto-focus first error:

```tsx
import { useEffect, useRef } from 'react';

export function FormWithAutoFocus() {
  const form = useMemo(() => createMyForm(), []);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.markAllAsTouched();

    if (form.invalid.value) {
      // Focus first error
      setTimeout(() => {
        const firstError = formRef.current?.querySelector(
          '[aria-invalid="true"]'
        ) as HTMLElement;
        firstError?.focus();
      }, 0);
      return;
    }

    // Submit
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      {/* fields */}
    </form>
  );
}
```

### Screen Reader Announcements

Announce errors to screen readers:

```tsx
import { useEffect } from 'react';

export function FormWithAnnouncements() {
  const form = useMemo(() => createMyForm(), []);
  const [announcement, setAnnouncement] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.markAllAsTouched();

    if (form.invalid.value) {
      const errors = collectAllErrors(form);
      setAnnouncement(
        `Form has ${errors.length} error${errors.length > 1 ? 's' : ''}. Please fix them and try again.`
      );
      return;
    }

    setAnnouncement('Form submitted successfully');
  };

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
      <form onSubmit={handleSubmit}>{/* fields */}</form>
    </>
  );
}
```

## Best Practices

### 1. Show Errors After Interaction

```tsx
// ✅ Good - show after touched
{control.touched && control.errors && (
  <ErrorMessage errors={control.errors} />
)}

// ❌ Bad - show immediately
{control.errors && <ErrorMessage errors={control.errors} />}
```

### 2. Provide Helpful Messages

```typescript
// ✅ Good - specific and helpful
return { passwordTooWeak: {
  message: 'Password must contain uppercase, lowercase, number, and be at least 8 characters'
}};

// ❌ Bad - vague
return { invalid: true };
```

### 3. Use Visual Indicators

```tsx
// ✅ Good - multiple indicators
<input className={showError ? 'error' : ''} aria-invalid={showError} />
{showError && <XCircle className="error-icon" />}
{showError && <ErrorMessage />}

// ❌ Bad - text only
{showError && <span>Error</span>}
```

### 4. Handle Server Errors Gracefully

```typescript
// ✅ Good - set field-specific errors
if (serverErrors.username) {
  form.controls.username.setErrors({ serverError: serverErrors.username });
}

// ❌ Bad - generic alert
alert('Server error');
```

### 5. Make Errors Accessible

```tsx
// ✅ Good - ARIA attributes
<input
  aria-invalid={showError}
  aria-describedby={errorId}
/>
<span id={errorId} role="alert">
  {errorMessage}
</span>

// ❌ Bad - no accessibility
<input className={showError ? 'error' : ''} />
<span>{errorMessage}</span>
```

## Next Steps

- [Validation Strategies](/docs/patterns/validation-strategies) — Advanced validation patterns
- [Custom Validators](/docs/validation/custom) — Create custom validation logic
- [Form Composition](/docs/patterns/form-composition) — Build complex forms

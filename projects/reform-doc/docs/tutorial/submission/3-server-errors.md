---
sidebar_position: 3
---

# Server Error Handling

Handling server-side validation errors and displaying them in your form.

## Overview

Server-side errors need special handling:

- **Field-specific errors** - API returns errors for specific fields
- **Global errors** - API returns general form-level errors
- **Error mapping** - Convert API error format to form error format
- **Error display** - Show errors to users clearly
- **Error recovery** - Allow users to fix errors and resubmit

## Basic Error Handling

### Simple Error Response

Handle a basic API error response:

```typescript title="src/components/CreditApplicationForm.tsx"
import { useMemo, useState } from 'react';
import { createCreditApplicationForm } from '../schemas/create-form';

interface ApiErrorResponse {
  errors: {
    field: string;
    message: string;
  }[];
}

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    form.markAsTouched();
    await form.validate();

    if (!form.valid.value) {
      return;
    }

    try {
      await submitApplication(form.value.value);
      // Success
      form.reset();
    } catch (error: any) {
      // Handle server error
      if (error.response?.data?.errors) {
        const serverErrors = error.response.data.errors;
        handleServerErrors(serverErrors);
      } else {
        setGlobalError('Submission failed. Please try again.');
      }
    }
  };

  const handleServerErrors = (errors: ApiErrorResponse['errors']) => {
    errors.forEach(({ field, message }) => {
      // Set error on specific field
      const formField = form.field(field as any);
      if (formField) {
        formField.setErrors([{ message }]);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {globalError && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {globalError}
        </div>
      )}
      {/* Form fields */}
      <button type="submit">Submit Application</button>
    </form>
  );
}
```

## Using setErrors

### Set Errors on Single Field

```typescript
// Set error on email field
form.field('email').setErrors([
  { message: 'This email is already registered' }
]);

// Set multiple errors on one field
form.field('passportNumber').setErrors([
  { message: 'Invalid passport format' },
  { message: 'Passport number must be unique' }
]);
```

### Set Errors on Multiple Fields

```typescript
// Set errors on multiple fields at once
form.setErrors({
  email: [{ message: 'Email already exists' }],
  phoneMain: [{ message: 'Phone number is invalid' }],
  passportNumber: [{ message: 'Passport already registered' }],
});
```

### Clear Specific Field Errors

```typescript
// Clear errors from a field when user fixes it
form.field('email').clearErrors();

// Or clear all form errors
form.clearErrors();
```

## Mapping Server Errors

### Map API Error Format to Form Errors

Different APIs return errors in different formats. Create a mapping function:

```typescript title="src/utils/map-server-errors.ts"
import type { FormNode } from 'reformer';

// API returns errors in this format
interface ApiFieldError {
  field: string;
  code: string;
  message: string;
}

interface ApiErrorResponse {
  status: 'error';
  errors: ApiFieldError[];
}

// Map snake_case API field names to camelCase form field names
const fieldNameMap: Record<string, string> = {
  loan_amount: 'loanAmount',
  loan_term: 'loanTerm',
  first_name: 'firstName',
  last_name: 'lastName',
  middle_name: 'middleName',
  email: 'email',
  phone_main: 'phoneMain',
  passport_number: 'passportNumber',
  birth_date: 'birthDate',
};

export function mapServerErrors(
  form: FormNode<any>,
  apiResponse: ApiErrorResponse
): void {
  // Clear existing errors first
  form.clearErrors();

  apiResponse.errors.forEach((error) => {
    // Map API field name to form field name
    const formFieldName = fieldNameMap[error.field] || error.field;

    // Get the form field
    const field = form.field(formFieldName);

    if (field) {
      // Set error on the field
      field.setErrors([{ message: error.message }]);
    } else {
      console.warn(`Unknown field in server error: ${error.field}`);
    }
  });
}

// Usage
try {
  await submitApplication(form.value.value);
} catch (error: any) {
  if (error.response?.data) {
    mapServerErrors(form, error.response.data);
  }
}
```

### Handle Nested Field Errors

Map errors for nested form structures:

```typescript title="src/utils/map-nested-errors.ts"
// API error format for nested fields
interface ApiNestedError {
  'personalData.firstName': string;
  'personalData.lastName': string;
  'registrationAddress.city': string;
}

export function mapNestedServerErrors(
  form: FormNode<any>,
  errors: Record<string, string>
): void {
  for (const [fieldPath, message] of Object.entries(errors)) {
    // Convert dot notation to field path
    const field = getFieldByPath(form, fieldPath);

    if (field) {
      field.setErrors([{ message }]);
    }
  }
}

function getFieldByPath(form: FormNode<any>, path: string): any {
  const parts = path.split('.');
  let current: any = form;

  for (const part of parts) {
    current = current.field?.(part);
    if (!current) break;
  }

  return current;
}

// Usage
const errors = {
  'personalData.firstName': 'First name is required',
  'personalData.lastName': 'Last name is too long',
  'registrationAddress.city': 'Invalid city',
};

mapNestedServerErrors(form, errors);
```

### Handle Array Field Errors

Map errors for array fields like co-borrowers:

```typescript title="src/utils/map-array-errors.ts"
// API returns errors like: "coBorrowers[0].email": "Invalid email"
interface ArrayFieldError {
  field: string; // e.g., "coBorrowers[0].email"
  message: string;
}

export function mapArrayFieldErrors(
  form: FormNode<any>,
  errors: ArrayFieldError[]
): void {
  errors.forEach(({ field, message }) => {
    // Parse: "coBorrowers[0].email" → array: "coBorrowers", index: 0, field: "email"
    const match = field.match(/^(\w+)\[(\d+)\]\.(\w+)$/);

    if (match) {
      const [, arrayName, indexStr, fieldName] = match;
      const index = parseInt(indexStr, 10);

      // Get array field
      const arrayField = form.field(arrayName);
      if (arrayField) {
        // Get specific item in array
        const itemField = arrayField.at(index);
        if (itemField) {
          // Set error on nested field
          const nestedField = itemField.field(fieldName);
          if (nestedField) {
            nestedField.setErrors([{ message }]);
          }
        }
      }
    }
  });
}

// Usage
const errors = [
  { field: 'coBorrowers[0].email', message: 'Email is required' },
  { field: 'coBorrowers[0].monthlyIncome', message: 'Income must be positive' },
  { field: 'coBorrowers[1].phoneMain', message: 'Invalid phone format' },
];

mapArrayFieldErrors(form, errors);
```

## Displaying Errors

### Field-Level Error Display

Errors are automatically displayed if your field components read the `errors` property:

```tsx title="src/components/FormField.tsx"
import { useFormControl } from 'reformer';

function FormField({ control }: { control: any }) {
  const { value, errors } = useFormControl(control);

  return (
    <div className="mb-4">
      <input
        value={value}
        onChange={(e) => control.setValue(e.target.value)}
        className={errors ? 'border-red-500' : 'border-gray-300'}
      />
      {errors && (
        <div className="text-red-600 text-sm mt-1">
          {errors.map((err: any, i: number) => (
            <div key={i}>{err.message}</div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Global Error Summary

Display all form errors in one place:

```tsx title="src/components/GlobalErrorSummary.tsx"
import { useFormControl } from 'reformer';
import type { FormNode } from 'reformer';

interface GlobalErrorSummaryProps {
  form: FormNode<any>;
}

function GlobalErrorSummary({ form }: GlobalErrorSummaryProps) {
  const { value: errors } = useFormControl(form.errors);

  if (!errors || Object.keys(errors).length === 0) {
    return null;
  }

  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">
            There {Object.keys(errors).length === 1 ? 'is' : 'are'}{' '}
            {Object.keys(errors).length} error{Object.keys(errors).length === 1 ? '' : 's'}{' '}
            with your submission
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <ul className="list-disc list-inside space-y-1">
              {Object.entries(errors).map(([field, error]: [string, any]) => (
                <li key={field}>
                  <strong>{field}:</strong> {error.message || 'Invalid value'}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Toast Notifications for Server Errors

Show temporary notifications:

```typescript title="src/utils/show-server-errors.ts"
import toast from 'react-hot-toast';

export function showServerErrors(errors: { field: string; message: string }[]): void {
  if (errors.length === 0) return;

  if (errors.length === 1) {
    // Single error - show as one toast
    toast.error(errors[0].message);
  } else {
    // Multiple errors - show summary
    toast.error(`${errors.length} validation errors. Please check the form.`);
  }
}

// Usage
try {
  await submitApplication(form.value.value);
} catch (error: any) {
  const serverErrors = error.response?.data?.errors || [];
  mapServerErrors(form, error.response.data);
  showServerErrors(serverErrors);
}
```

## Global vs Field Errors

### Distinguish Between Global and Field Errors

```typescript title="src/utils/categorize-errors.ts"
interface ServerError {
  field?: string;
  message: string;
  code: string;
}

interface CategorizedErrors {
  fieldErrors: Map<string, string[]>;
  globalErrors: string[];
}

export function categorizeServerErrors(
  errors: ServerError[]
): CategorizedErrors {
  const fieldErrors = new Map<string, string[]>();
  const globalErrors: string[] = [];

  errors.forEach((error) => {
    if (error.field) {
      // Field-specific error
      const existing = fieldErrors.get(error.field) || [];
      fieldErrors.set(error.field, [...existing, error.message]);
    } else {
      // Global error (no field specified)
      globalErrors.push(error.message);
    }
  });

  return { fieldErrors, globalErrors };
}

// Usage
const handleServerErrors = (errors: ServerError[]) => {
  const { fieldErrors, globalErrors } = categorizeServerErrors(errors);

  // Set field errors
  fieldErrors.forEach((messages, field) => {
    const formField = form.field(field as any);
    if (formField) {
      formField.setErrors(messages.map((message) => ({ message })));
    }
  });

  // Display global errors
  if (globalErrors.length > 0) {
    setGlobalError(globalErrors.join('. '));
  }
};
```

## Error Recovery

### Auto-Clear Errors on Field Change

Clear server errors when user starts fixing them:

```typescript title="src/hooks/useAutoClearErrors.ts"
import { useEffect } from 'react';
import type { FormNode } from 'reformer';

export function useAutoClearErrors(form: FormNode<any>): void {
  useEffect(() => {
    // Subscribe to value changes
    const subscription = form.value.subscribe(() => {
      // Clear all server errors when user changes any field
      // This allows them to see if their fix resolves the issue
      const errors = form.errors.value;

      if (errors && Object.keys(errors).length > 0) {
        // Optional: only clear errors for changed fields
        // For simplicity, we clear all errors
        form.clearErrors();
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);
}

// Usage
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Auto-clear server errors on field change
  useAutoClearErrors(form);

  return <FormContent form={form} />;
}
```

### Retry Submission

Allow users to retry after fixing errors:

```typescript title="src/components/CreditApplicationForm.tsx"
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [submitAttempts, setSubmitAttempts] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    form.markAsTouched();
    await form.validate();

    if (!form.valid.value) {
      return;
    }

    setSubmitAttempts((prev) => prev + 1);

    try {
      await submitApplication(form.value.value);
      // Success
      form.reset();
      setLastError(null);
      setSubmitAttempts(0);
    } catch (error: any) {
      // Handle error
      if (error.response?.data?.errors) {
        mapServerErrors(form, error.response.data);
        setLastError('Please fix the errors and try again.');
      } else {
        setLastError('Submission failed. Please try again later.');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {lastError && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {lastError}
          {submitAttempts > 1 && (
            <span className="text-sm ml-2">
              (Attempt {submitAttempts})
            </span>
          )}
        </div>
      )}
      {/* Form fields */}
      <button type="submit">
        {submitAttempts > 0 ? 'Try Again' : 'Submit Application'}
      </button>
    </form>
  );
}
```

## Common Error Scenarios

### Handle Duplicate Entry Errors

```typescript
// API returns: { email: 'Email already exists' }
const handleDuplicateError = (error: any) => {
  if (error.response?.status === 409) {
    // 409 Conflict - duplicate entry
    const field = error.response.data.field;
    const message = error.response.data.message;

    form.field(field).setErrors([{ message }]);

    // Focus the field with error
    const element = document.querySelector(`[name="${field}"]`);
    if (element) {
      (element as HTMLElement).focus();
    }
  }
};
```

### Handle Rate Limiting

```typescript
const handleRateLimitError = (error: any) => {
  if (error.response?.status === 429) {
    // 429 Too Many Requests
    const retryAfter = error.response.headers['retry-after'];

    setGlobalError(
      `Too many attempts. Please try again in ${retryAfter} seconds.`
    );

    // Disable submit button temporarily
    setSubmitDisabled(true);
    setTimeout(() => {
      setSubmitDisabled(false);
      setGlobalError(null);
    }, parseInt(retryAfter) * 1000);
  }
};
```

### Handle Authentication Errors

```typescript
const handleAuthError = (error: any) => {
  if (error.response?.status === 401) {
    // 401 Unauthorized - session expired
    setGlobalError('Your session has expired. Please log in again.');

    // Redirect to login after delay
    setTimeout(() => {
      window.location.href = '/login';
    }, 2000);
  }
};
```

### Handle Network Errors

```typescript
const handleNetworkError = (error: any) => {
  if (error.message === 'Network Error' || !error.response) {
    setGlobalError(
      'Unable to connect to the server. Please check your internet connection.'
    );
  }
};
```

## Complete Error Handling Example

### Comprehensive Submit Handler

```typescript title="src/components/CreditApplicationForm.tsx"
import { useMemo, useState } from 'react';
import { createCreditApplicationForm } from '../schemas/create-form';
import { mapServerErrors } from '../utils/map-server-errors';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous global error
    setGlobalError(null);

    // Validate form
    form.markAsTouched();
    await form.validate();

    if (!form.valid.value) {
      setGlobalError('Please fix validation errors before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Submit to API
      const response = await submitApplication(form.value.value);

      // Success
      form.reset();
      showSuccessMessage('Application submitted successfully!');

      // Redirect or update UI
      setTimeout(() => {
        window.location.href = '/applications/success';
      }, 1500);

    } catch (error: any) {
      console.error('Submission error:', error);

      // Handle different error types
      if (!error.response) {
        // Network error
        setGlobalError(
          'Unable to connect to the server. Please check your connection and try again.'
        );
      } else if (error.response.status === 401) {
        // Authentication error
        setGlobalError('Your session has expired. Redirecting to login...');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else if (error.response.status === 429) {
        // Rate limiting
        const retryAfter = error.response.headers['retry-after'] || '60';
        setGlobalError(
          `Too many submission attempts. Please try again in ${retryAfter} seconds.`
        );
      } else if (error.response.status === 422 || error.response.status === 400) {
        // Validation errors
        if (error.response.data?.errors) {
          mapServerErrors(form, error.response.data);
          setGlobalError(
            'Please fix the errors highlighted below and try again.'
          );
        } else {
          setGlobalError(
            error.response.data?.message || 'Validation failed. Please check your input.'
          );
        }
      } else if (error.response.status === 500) {
        // Server error
        setGlobalError(
          'A server error occurred. Our team has been notified. Please try again later.'
        );
      } else {
        // Other errors
        setGlobalError(
          error.response.data?.message ||
          'An unexpected error occurred. Please try again.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <GlobalErrorSummary form={form} />

      {globalError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-red-700">{globalError}</p>
        </div>
      )}

      {/* Form fields */}
      <FormFields form={form} />

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {isSubmitting ? 'Submitting...' : 'Submit Application'}
      </button>
    </form>
  );
}
```

## Best Practices

### 1. Always Map Server Errors to Form Fields

```typescript
// ✅ GOOD: Map server errors to form fields
try {
  await submitApplication(formData);
} catch (error: any) {
  if (error.response?.data?.errors) {
    mapServerErrors(form, error.response.data);
  }
}

// ❌ BAD: Just show generic error message
try {
  await submitApplication(formData);
} catch (error) {
  alert('Submission failed'); // User doesn't know what to fix
}
```

### 2. Clear Errors on Field Change

```typescript
// ✅ GOOD: Clear server errors when user edits field
useEffect(() => {
  const subscription = form.value.subscribe(() => {
    form.clearErrors();
  });
  return () => subscription.unsubscribe();
}, [form]);

// ❌ BAD: Keep showing stale errors
// Server errors persist even after user fixes them
```

### 3. Distinguish Field and Global Errors

```typescript
// ✅ GOOD: Categorize errors
const { fieldErrors, globalErrors } = categorizeServerErrors(errors);

fieldErrors.forEach((messages, field) => {
  form.field(field).setErrors(messages.map(m => ({ message: m })));
});

setGlobalErrors(globalErrors);

// ❌ BAD: Treat all errors the same
setGlobalError(errors.map(e => e.message).join(', '));
```

### 4. Provide Helpful Error Messages

```typescript
// ✅ GOOD: Specific, actionable error messages
setGlobalError(
  'The email address you entered is already registered. Please use a different email or try logging in.'
);

// ❌ BAD: Vague error messages
setGlobalError('Error occurred');
```

### 5. Handle All Error Scenarios

```typescript
// ✅ GOOD: Handle different HTTP status codes
if (error.response?.status === 422) {
  // Validation errors
} else if (error.response?.status === 401) {
  // Auth errors
} else if (error.response?.status === 429) {
  // Rate limiting
} else if (error.response?.status === 500) {
  // Server errors
} else if (!error.response) {
  // Network errors
}

// ❌ BAD: Generic error handling
catch (error) {
  setError('Something went wrong');
}
```

## Next Steps

You've completed the submission section! Here's what to explore next:

- **[Form Behaviors](../behaviors/1-computed.md)** - Add computed fields and dynamic behaviors
- **[Advanced Validation](../validation/1-built-in.md)** - Deep dive into validation strategies
- **[Performance](../advanced/performance.md)** - Optimize form performance for large forms

---
sidebar_position: 4
---

# Server Error Handling

Handling server-side validation errors and mapping them to form fields.

## Overview

Server errors require special handling to provide helpful feedback:

- **Validation Errors (422)** - Field-specific validation failures
- **Server Errors (5xx)** - Internal server errors
- **Authentication Errors (401)** - Session expired or unauthorized
- **Rate Limiting (429)** - Too many requests
- **Network Errors** - Connection failures
- **Error Mapping** - Converting API errors to form errors
- **Error Recovery** - Allowing users to fix and resubmit

## Understanding Server Errors

### Error Types

Different HTTP status codes indicate different error types:

```typescript
// 400 Bad Request - Invalid request format
// 401 Unauthorized - Authentication required
// 403 Forbidden - Not allowed
// 422 Unprocessable Entity - Validation errors
// 429 Too Many Requests - Rate limiting
// 500 Internal Server Error - Server error
// 503 Service Unavailable - Server down
```

### Error Response Formats

APIs typically return errors in these formats:

```typescript
// Field-specific validation errors
{
  "error": "Validation failed",
  "statusCode": 422,
  "errors": [
    {
      "field": "email",
      "code": "email_already_exists",
      "message": "This email is already registered"
    },
    {
      "field": "phoneMain",
      "code": "invalid_format",
      "message": "Phone number must be 10 digits"
    }
  ]
}

// Generic server error
{
  "error": "Internal Server Error",
  "statusCode": 500,
  "message": "An unexpected error occurred"
}

// Form-level validation error
{
  "error": "Business rule violation",
  "statusCode": 422,
  "message": "Your income does not meet minimum requirements",
  "code": "insufficient_income"
}
```

## Creating Error Types

Define TypeScript types for different error scenarios.

### Error Type Definitions

```typescript title="src/errors/submission-errors.ts"
/**
 * Base submission error
 */
export class SubmissionError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'SubmissionError';
  }
}

/**
 * Validation error with field-level details
 */
export class ValidationSubmissionError extends SubmissionError {
  constructor(
    public errors: Array<{
      field: string;
      code: string;
      message: string;
    }>
  ) {
    super('Validation failed', 422, 'validation_error');
    this.name = 'ValidationSubmissionError';
  }
}

/**
 * Server error (5xx)
 */
export class ServerSubmissionError extends SubmissionError {
  constructor(message: string, code?: string) {
    super(message, 500, code);
    this.name = 'ServerSubmissionError';
  }

  get retryable(): boolean {
    return true; // Server errors are typically retryable
  }
}

/**
 * Network error (no response)
 */
export class NetworkSubmissionError extends SubmissionError {
  constructor(message: string = 'Network error occurred') {
    super(message, undefined, 'network_error');
    this.name = 'NetworkSubmissionError';
  }

  get retryable(): boolean {
    return true; // Network errors are retryable
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends SubmissionError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'authentication_required');
    this.name = 'AuthenticationError';
  }

  get retryable(): boolean {
    return false; // User needs to re-authenticate
  }
}

/**
 * Rate limiting error (429)
 */
export class RateLimitError extends SubmissionError {
  constructor(
    message: string = 'Too many requests',
    public retryAfter?: number // seconds
  ) {
    super(message, 429, 'rate_limit_exceeded');
    this.name = 'RateLimitError';
  }

  get retryable(): boolean {
    return true; // Can retry after waiting
  }
}
```

## Updating API Service

Update the API service to throw appropriate error types.

### Enhanced API Function

```typescript title="src/services/api/submission.api.ts"
import {
  ValidationSubmissionError,
  ServerSubmissionError,
  NetworkSubmissionError,
  AuthenticationError,
  RateLimitError,
} from '../../errors/submission-errors';

export async function submitApplication(
  data: SubmitApplicationRequest
): Promise<SubmitApplicationResponse> {
  let response: Response;

  try {
    response = await fetch('/api/applications/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  } catch (error) {
    // Network error - no response received
    throw new NetworkSubmissionError(
      'Unable to connect to the server. Please check your internet connection.'
    );
  }

  // Handle different HTTP status codes
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: 'An error occurred',
    }));

    switch (response.status) {
      case 401:
        // Authentication error
        throw new AuthenticationError(
          errorData.message || 'Your session has expired. Please log in again.'
        );

      case 422:
        // Validation errors
        if (errorData.errors && Array.isArray(errorData.errors)) {
          throw new ValidationSubmissionError(errorData.errors);
        }
        // Form-level validation error
        throw new ServerSubmissionError(
          errorData.message || 'Validation failed',
          errorData.code
        );

      case 429:
        // Rate limiting
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        throw new RateLimitError(
          errorData.message || 'Too many requests. Please try again later.',
          retryAfter
        );

      case 500:
      case 502:
      case 503:
      case 504:
        // Server errors
        throw new ServerSubmissionError(
          errorData.message || 'A server error occurred. Please try again later.',
          errorData.code
        );

      default:
        // Other errors
        throw new ServerSubmissionError(
          errorData.message || 'An unexpected error occurred',
          errorData.code
        );
    }
  }

  return await response.json();
}
```

## Mapping Server Errors to Form Fields

Create a utility to map server validation errors to form fields.

### Error Mapping Utility

```typescript title="src/utils/map-server-errors.ts"
import type { FormNode } from 'reformer';
import type { ValidationSubmissionError } from '../errors/submission-errors';

/**
 * Map API field names to form field paths
 * API uses snake_case, form uses camelCase
 */
const fieldNameMap: Record<string, string> = {
  // Loan Information
  loan_amount: 'step1.loanAmount',
  loan_term: 'step1.loanTerm',
  loan_type: 'step1.loanType',
  loan_purpose: 'step1.loanPurpose',

  // Personal Information
  first_name: 'step2.personalData.firstName',
  last_name: 'step2.personalData.lastName',
  middle_name: 'step2.personalData.middleName',
  birth_date: 'step2.personalData.birthDate',

  // Passport
  passport_series: 'step2.passportData.passportSeries',
  passport_number: 'step2.passportData.passportNumber',
  passport_issuer: 'step2.passportData.passportIssuer',
  passport_issue_date: 'step2.passportData.passportIssueDate',

  // Contact
  email: 'step3.email',
  phone_main: 'step3.phoneMain',
  phone_additional: 'step3.phoneAdditional',

  // Employment
  employment_type: 'step4.employmentType',
  company_name: 'step4.companyName',
  position: 'step4.position',
  monthly_income: 'step4.monthlyIncome',
  employment_start_date: 'step4.employmentStartDate',
};

/**
 * Get form field by path
 */
function getFieldByPath(form: FormNode, path: string): any {
  const parts = path.split('.');
  let current: any = form;

  for (const part of parts) {
    current = current.field?.(part) || current.group?.(part);
    if (!current) {
      console.warn(`Field not found: ${path}`);
      return null;
    }
  }

  return current;
}

/**
 * Map server validation errors to form fields
 */
export function mapServerErrors(
  form: FormNode,
  error: ValidationSubmissionError
): void {
  // Clear existing server errors first
  form.clearErrors();

  error.errors.forEach(({ field, code, message }) => {
    // Map API field name to form field path
    const formFieldPath = fieldNameMap[field] || field;

    // Get the form field
    const formField = getFieldByPath(form, formFieldPath);

    if (formField) {
      // Set error on the field
      formField.setErrors([
        {
          type: code,
          message: message,
        },
      ]);

      console.log(`Mapped error to ${formFieldPath}:`, message);
    } else {
      console.warn(`Could not map server error to form field: ${field}`);
    }
  });
}
```

## Handling Different Error Types

Update the submission handler to handle all error types.

### Enhanced Submission Handler

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCreditApplicationForm } from '../schemas/create-form';
import { creditApplicationTransformer } from '../utils/credit-application-transformer';
import { submitApplication } from '../services/api/submission.api';
import { mapServerErrors } from '../utils/map-server-errors';
import {
  ValidationSubmissionError,
  ServerSubmissionError,
  NetworkSubmissionError,
  AuthenticationError,
  RateLimitError,
} from '../errors/submission-errors';
import { useSubmissionState } from '../hooks/useSubmissionState';

export function CreditApplicationForm() {
  const navigate = useNavigate();
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const { state, submit } = useSubmissionState(form, async (data) => {
    const apiData = creditApplicationTransformer.serialize(data);
    return await submitApplication(apiData);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    try {
      const result = await submit();

      // Success - navigate after delay
      setTimeout(() => {
        navigate(`/applications/${result.id}/success`);
      }, 2000);
    } catch (error) {
      console.error('Submission error:', error);

      if (error instanceof ValidationSubmissionError) {
        // Field-specific validation errors
        mapServerErrors(form, error);
        setGlobalError(
          'Please fix the errors highlighted below and try again.'
        );
      } else if (error instanceof AuthenticationError) {
        // Session expired
        setGlobalError(
          'Your session has expired. Redirecting to login...'
        );
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else if (error instanceof RateLimitError) {
        // Rate limiting
        const retryMessage = error.retryAfter
          ? ` Please try again in ${error.retryAfter} seconds.`
          : ' Please try again later.';
        setGlobalError(error.message + retryMessage);
      } else if (error instanceof NetworkSubmissionError) {
        // Network error
        setGlobalError(
          'Unable to connect to the server. Please check your internet connection and try again.'
        );
      } else if (error instanceof ServerSubmissionError) {
        // Server error
        setGlobalError(
          'A server error occurred. Our team has been notified. Please try again later.'
        );
      } else {
        // Unknown error
        setGlobalError(
          'An unexpected error occurred. Please try again.'
        );
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Credit Application</h1>

      {/* Global error message */}
      {globalError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{globalError}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <FormRenderer form={form} />

        <SubmitButton form={form} state={state} />
      </form>
    </div>
  );
}
```

## Error Display Components

Create components to display different types of errors.

### Global Error Summary

```tsx title="src/components/GlobalErrorSummary.tsx"
import { useFormControl } from 'reformer';
import type { FormNode } from 'reformer';

interface GlobalErrorSummaryProps {
  form: FormNode;
}

export function GlobalErrorSummary({ form }: GlobalErrorSummaryProps) {
  const { value: errors } = useFormControl(form.errors);

  if (!errors || Object.keys(errors).length === 0) {
    return null;
  }

  const errorEntries = Object.entries(errors);

  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">
            There {errorEntries.length === 1 ? 'is' : 'are'} {errorEntries.length}{' '}
            error{errorEntries.length === 1 ? '' : 's'} with your submission
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <ul className="list-disc list-inside space-y-1">
              {errorEntries.map(([field, error]: [string, any]) => (
                <li key={field}>
                  <strong>{field}:</strong>{' '}
                  {Array.isArray(error)
                    ? error[0]?.message || 'Invalid value'
                    : error?.message || 'Invalid value'}
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

### Error Alert Component

```tsx title="src/components/ErrorAlert.tsx"
import type { SubmissionError } from '../errors/submission-errors';

interface ErrorAlertProps {
  error: SubmissionError;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorAlert({ error, onRetry, onDismiss }: ErrorAlertProps) {
  const isRetryable = 'retryable' in error && error.retryable;

  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            {error.name.replace(/Error$/, '')}
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{error.message}</p>
          </div>
          {(isRetryable || onDismiss) && (
            <div className="mt-4 flex gap-2">
              {isRetryable && onRetry && (
                <button
                  onClick={onRetry}
                  className="bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200 text-sm font-medium"
                >
                  Try Again
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="text-red-700 px-3 py-1 text-sm font-medium hover:underline"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

## Auto-Clear Errors on Field Change

Clear server errors when users start fixing them.

### Auto-Clear Hook

```typescript title="src/hooks/useAutoClearErrors.ts"
import { useEffect } from 'react';
import type { FormNode } from 'reformer';

/**
 * Automatically clear server errors when user changes any field
 * This provides immediate feedback that their changes are being considered
 */
export function useAutoClearErrors(form: FormNode): void {
  useEffect(() => {
    // Track previous value
    let previousValue = form.value.value;

    // Subscribe to value changes
    const subscription = form.value.subscribe((currentValue) => {
      // Only clear if value actually changed
      if (currentValue !== previousValue) {
        // Clear all errors (they'll be re-validated on next submit)
        const errors = form.errors.value;
        if (errors && Object.keys(errors).length > 0) {
          form.clearErrors();
        }

        previousValue = currentValue;
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);
}
```

### Using Auto-Clear

```tsx title="src/components/CreditApplicationForm.tsx"
import { useAutoClearErrors } from '../hooks/useAutoClearErrors';

export function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Auto-clear server errors when user edits fields
  useAutoClearErrors(form);

  // ... rest of component
}
```

## Complete Integration Example

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCreditApplicationForm } from '../schemas/create-form';
import { creditApplicationTransformer } from '../utils/credit-application-transformer';
import { submitApplication } from '../services/api/submission.api';
import { mapServerErrors } from '../utils/map-server-errors';
import {
  ValidationSubmissionError,
  ServerSubmissionError,
  NetworkSubmissionError,
  AuthenticationError,
  RateLimitError,
  SubmissionError,
} from '../errors/submission-errors';
import { useSubmissionState } from '../hooks/useSubmissionState';
import { useAutoClearErrors } from '../hooks/useAutoClearErrors';
import { GlobalErrorSummary } from './GlobalErrorSummary';
import { ErrorAlert } from './ErrorAlert';
import { SubmitButton } from './SubmitButton';
import { FormRenderer } from './FormRenderer';

export function CreditApplicationForm() {
  const navigate = useNavigate();
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [globalError, setGlobalError] = useState<SubmissionError | null>(null);

  // Auto-clear server errors on field change
  useAutoClearErrors(form);

  const { state, submit, reset } = useSubmissionState(form, async (data) => {
    const apiData = creditApplicationTransformer.serialize(data);
    return await submitApplication(apiData);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    try {
      const result = await submit();

      // Success - navigate to success page
      setTimeout(() => {
        navigate(`/applications/${result.id}/success`);
      }, 2000);
    } catch (error) {
      console.error('Submission error:', error);

      if (error instanceof ValidationSubmissionError) {
        // Map field-specific errors
        mapServerErrors(form, error);
        setGlobalError(
          new SubmissionError(
            'Please fix the validation errors below and try again.'
          )
        );
      } else if (error instanceof AuthenticationError) {
        // Handle auth error
        setGlobalError(error);
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else if (error instanceof RateLimitError) {
        // Handle rate limiting
        setGlobalError(error);
      } else if (error instanceof NetworkSubmissionError) {
        // Handle network error
        setGlobalError(error);
      } else if (error instanceof ServerSubmissionError) {
        // Handle server error
        setGlobalError(error);
      } else {
        // Unknown error
        setGlobalError(
          new SubmissionError('An unexpected error occurred. Please try again.')
        );
      }
    }
  };

  const handleRetry = async () => {
    setGlobalError(null);
    try {
      await submit();
    } catch (error) {
      // Error handling is done above
    }
  };

  const handleDismissError = () => {
    setGlobalError(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Credit Application</h1>

      {/* Global error alert */}
      {globalError && (
        <ErrorAlert
          error={globalError}
          onRetry={'retryable' in globalError && globalError.retryable ? handleRetry : undefined}
          onDismiss={handleDismissError}
        />
      )}

      {/* Field error summary */}
      <GlobalErrorSummary form={form} />

      <form onSubmit={handleSubmit}>
        {/* Form fields */}
        <FormRenderer form={form} state={state} />

        {/* Submit button */}
        <div className="mt-6">
          <SubmitButton form={form} state={state} />
        </div>
      </form>
    </div>
  );
}
```

## Testing Error Handling

### Test Different Error Types

```typescript title="src/components/CreditApplicationForm.test.tsx"
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreditApplicationForm } from './CreditApplicationForm';
import { submitApplication } from '../services/api/submission.api';
import {
  ValidationSubmissionError,
  NetworkSubmissionError,
  RateLimitError,
} from '../errors/submission-errors';

jest.mock('../services/api/submission.api');

describe('CreditApplicationForm - Error Handling', () => {
  test('handles validation errors', async () => {
    const validationError = new ValidationSubmissionError([
      { field: 'email', code: 'email_exists', message: 'Email already registered' },
      { field: 'phone_main', code: 'invalid_format', message: 'Invalid phone format' },
    ]);

    (submitApplication as jest.Mock).mockRejectedValue(validationError);

    render(<CreditApplicationForm />);

    // Submit form
    fireEvent.click(screen.getByText('Submit Application'));

    // Should show field errors
    await waitFor(() => {
      expect(screen.getByText(/Email already registered/i)).toBeInTheDocument();
      expect(screen.getByText(/Invalid phone format/i)).toBeInTheDocument();
    });
  });

  test('handles network errors', async () => {
    const networkError = new NetworkSubmissionError();

    (submitApplication as jest.Mock).mockRejectedValue(networkError);

    render(<CreditApplicationForm />);

    fireEvent.click(screen.getByText('Submit Application'));

    await waitFor(() => {
      expect(screen.getByText(/Unable to connect/i)).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  test('handles rate limiting', async () => {
    const rateLimitError = new RateLimitError('Too many requests', 60);

    (submitApplication as jest.Mock).mockRejectedValue(rateLimitError);

    render(<CreditApplicationForm />);

    fireEvent.click(screen.getByText('Submit Application'));

    await waitFor(() => {
      expect(screen.getByText(/Too many requests/i)).toBeInTheDocument();
      expect(screen.getByText(/60 seconds/i)).toBeInTheDocument();
    });
  });

  test('auto-clears errors on field change', async () => {
    const validationError = new ValidationSubmissionError([
      { field: 'email', code: 'required', message: 'Email is required' },
    ]);

    (submitApplication as jest.Mock).mockRejectedValue(validationError);

    const { container } = render(<CreditApplicationForm />);

    // Submit and get error
    fireEvent.click(screen.getByText('Submit Application'));

    await waitFor(() => {
      expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
    });

    // Change field value
    const emailInput = container.querySelector('[name="email"]');
    fireEvent.change(emailInput!, { target: { value: 'test@example.com' } });

    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByText(/Email is required/i)).not.toBeInTheDocument();
    });
  });
});
```

## Best Practices

### 1. Create Specific Error Types

```typescript
// ✅ GOOD: Specific error types
throw new ValidationSubmissionError(errors);
throw new NetworkSubmissionError();
throw new RateLimitError(message, retryAfter);

// ❌ BAD: Generic errors
throw new Error('Validation failed');
throw new Error('Network error');
```

### 2. Map All Field Errors

```typescript
// ✅ GOOD: Map all field names
const fieldNameMap = {
  email: 'step3.email',
  phone_main: 'step3.phoneMain',
  // ... all fields
};

// ❌ BAD: Partial mapping
const fieldNameMap = {
  email: 'email', // Missing nested structure
};
```

### 3. Provide Actionable Messages

```typescript
// ✅ GOOD: Clear, actionable message
'This email is already registered. Please use a different email or try logging in.'

// ❌ BAD: Vague message
'Error occurred'
```

### 4. Enable Retry for Retryable Errors

```tsx
// ✅ GOOD: Show retry for network/server errors
{error.retryable && <button onClick={retry}>Try Again</button>}

// ❌ BAD: No retry option
{error && <span>Error occurred</span>}
```

### 5. Clear Stale Errors

```typescript
// ✅ GOOD: Auto-clear on field change
useAutoClearErrors(form);

// ❌ BAD: Keep stale errors
// Old server errors still showing after user fixes them
```

## Key Takeaways

- Create specific error types for different scenarios
- Map server validation errors to form fields
- Provide clear, actionable error messages
- Enable retry for network and server errors
- Auto-clear errors when users fix them
- Handle all HTTP status codes appropriately
- Test all error scenarios

## What's Next?

You've implemented comprehensive server error handling! Next, we'll add **Retry Logic**:

- Automatic retry with exponential backoff
- Maximum retry attempts
- Retry indicators
- Manual retry buttons
- Retryable vs non-retryable errors
- Retry state management

In the next section, we'll make your form resilient to temporary network issues and server failures.

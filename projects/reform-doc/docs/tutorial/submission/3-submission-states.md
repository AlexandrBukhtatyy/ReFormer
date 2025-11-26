---
sidebar_position: 3
---

# Submission States

Managing the complete lifecycle of form submission with state tracking.

## Overview

Submission states provide clear feedback to users during the submission process:

- **Idle** - Form not yet submitted
- **Submitting** - Submission in progress
- **Success** - Submission completed successfully
- **Error** - Submission failed
- **State Transitions** - Moving between states
- **UI Feedback** - Visual indicators for each state

## Understanding Submission States

### The Four States

```typescript
type SubmissionState =
  | { status: 'idle' }                      // Initial state
  | { status: 'submitting'; progress?: number }  // In progress
  | { status: 'success'; data: any }        // Completed successfully
  | { status: 'error'; error: Error };      // Failed with error
```

### State Transitions

```
┌─────────────────────────────────────────────────┐
│             Submission State Machine             │
└─────────────────────────────────────────────────┘

    ┌──────────┐
    │   IDLE   │  ← Initial state
    └────┬─────┘
         │
         │ User clicks Submit
         ▼
    ┌────────────┐
    │ SUBMITTING │  ← Validation + Network request
    └─┬────────┬─┘
      │        │
      │        │ Server error / Network failure
      │        ▼
      │   ┌────────┐
      │   │ ERROR  │  ← Can retry
      │   └───┬────┘
      │       │
      │       │ User clicks Retry
      │       └──────────┐
      │                  │
      │ Success          │
      ▼                  │
  ┌─────────┐            │
  │ SUCCESS │            │
  └─────────┘            │
      │                  │
      │ Navigate away    │
      │ or Reset         │
      ▼                  ▼
  ┌──────────┐      ┌──────────┐
  │   IDLE   │ ←────┤   IDLE   │
  └──────────┘      └──────────┘
```

## Creating useSubmissionState Hook

Let's create a reusable hook to manage submission states.

### Basic Implementation

```typescript title="src/hooks/useSubmissionState.ts"
import { useState, useCallback } from 'react';
import type { FormNode } from 'reformer';

/**
 * Submission state type
 */
export type SubmissionState<T = any> =
  | { status: 'idle' }
  | { status: 'submitting'; progress?: number }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

/**
 * Hook return type
 */
export interface UseSubmissionStateResult<T> {
  state: SubmissionState<T>;
  submit: () => Promise<T>;
  reset: () => void;
  isIdle: boolean;
  isSubmitting: boolean;
  isSuccess: boolean;
  isError: boolean;
}

/**
 * Hook to manage form submission state
 * @param form The form node
 * @param submitFn Function to execute on submission
 * @returns Submission state and controls
 */
export function useSubmissionState<T>(
  form: FormNode,
  submitFn: (data: any) => Promise<T>
): UseSubmissionStateResult<T> {
  const [state, setState] = useState<SubmissionState<T>>({ status: 'idle' });

  const submit = useCallback(async () => {
    // Set submitting state
    setState({ status: 'submitting' });

    try {
      // Use form.submit() for automatic validation
      const result = await form.submit(async (validData) => {
        return await submitFn(validData);
      });

      // Set success state
      setState({ status: 'success', data: result });

      return result;
    } catch (error) {
      // Set error state
      setState({
        status: 'error',
        error: error instanceof Error ? error : new Error('Submission failed')
      });

      // Re-throw so caller can handle if needed
      throw error;
    }
  }, [form, submitFn]);

  const reset = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  return {
    state,
    submit,
    reset,
    // Convenience flags
    isIdle: state.status === 'idle',
    isSubmitting: state.status === 'submitting',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
  };
}
```

### Using the Hook

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo } from 'react';
import { createCreditApplicationForm } from '../schemas/create-form';
import { creditApplicationTransformer } from '../utils/credit-application-transformer';
import { submitApplication } from '../services/api/submission.api';
import { useSubmissionState } from '../hooks/useSubmissionState';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const {
    state,
    submit,
    reset,
    isIdle,
    isSubmitting,
    isSuccess,
    isError
  } = useSubmissionState(form, async (data) => {
    const apiData = creditApplicationTransformer.serialize(data);
    return await submitApplication(apiData);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await submit();
      // Success! Can add additional logic here
    } catch (error) {
      // Error is already captured in state
      console.error('Submission failed:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <FormRenderer form={form} />

      {/* Submit button changes based on state */}
      <button
        type="submit"
        disabled={isSubmitting || !form.valid.value}
      >
        {isSubmitting ? 'Submitting...' : 'Submit Application'}
      </button>

      {/* Show success message */}
      {isSuccess && state.status === 'success' && (
        <div className="text-green-600">
          Application {state.data.id} submitted successfully!
        </div>
      )}

      {/* Show error message */}
      {isError && state.status === 'error' && (
        <div className="text-red-600">
          Error: {state.error.message}
          <button onClick={() => submit()}>Retry</button>
        </div>
      )}
    </form>
  );
}
```

## Creating State-Aware Components

### SubmitButton with States

```tsx title="src/components/SubmitButton.tsx"
import { useFormControl } from 'reformer';
import type { FormNode } from 'reformer';
import type { SubmissionState } from '../hooks/useSubmissionState';

interface SubmitButtonProps {
  form: FormNode;
  state: SubmissionState;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function SubmitButton({
  form,
  state,
  onClick,
  children = 'Submit'
}: SubmitButtonProps) {
  const { value: isValid } = useFormControl(form.valid);

  // Idle state - normal button
  if (state.status === 'idle') {
    return (
      <button
        type="submit"
        onClick={onClick}
        disabled={!isValid}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
      >
        {children}
      </button>
    );
  }

  // Submitting state - loading button
  if (state.status === 'submitting') {
    return (
      <button
        type="button"
        disabled
        className="bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2"
      >
        <svg
          className="animate-spin h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        Submitting...
        {state.progress && <span>({state.progress}%)</span>}
      </button>
    );
  }

  // Success state - success button
  if (state.status === 'success') {
    return (
      <button
        type="button"
        disabled
        className="bg-green-600 text-white px-6 py-3 rounded-lg flex items-center gap-2"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        Submitted!
      </button>
    );
  }

  // Error state - retry button
  if (state.status === 'error') {
    return (
      <button
        type="submit"
        onClick={onClick}
        className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700"
      >
        Retry Submission
      </button>
    );
  }

  return null;
}
```

### SubmissionStatus Component

```tsx title="src/components/SubmissionStatus.tsx"
import type { SubmissionState } from '../hooks/useSubmissionState';

interface SubmissionStatusProps {
  state: SubmissionState;
  onReset?: () => void;
}

export function SubmissionStatus({ state, onReset }: SubmissionStatusProps) {
  // Idle - no message
  if (state.status === 'idle') {
    return null;
  }

  // Submitting - loading message
  if (state.status === 'submitting') {
    return (
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
        <div className="flex items-center">
          <svg
            className="animate-spin h-5 w-5 text-blue-600 mr-3"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <div>
            <p className="text-blue-800 font-medium">Submitting your application...</p>
            <p className="text-blue-600 text-sm">Please wait while we process your request.</p>
          </div>
        </div>
      </div>
    );
  }

  // Success - success message
  if (state.status === 'success') {
    return (
      <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-green-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">
              Application submitted successfully!
            </h3>
            <div className="mt-2 text-sm text-green-700">
              <p>
                Your application has been received and is being processed.
                We'll contact you soon with an update.
              </p>
              {state.data?.id && (
                <p className="mt-1">
                  Reference ID: <span className="font-mono">{state.data.id}</span>
                </p>
              )}
            </div>
            {onReset && (
              <div className="mt-4">
                <button
                  onClick={onReset}
                  className="text-green-700 underline text-sm hover:text-green-900"
                >
                  Submit another application
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Error - error message
  if (state.status === 'error') {
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
              Submission failed
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{state.error.message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
```

## Form Locking During Submission

Prevent users from editing the form while submission is in progress.

### Lock Form Fields

```tsx title="src/components/FormRenderer.tsx"
import { useFormControl } from 'reformer';
import type { FormNode } from 'reformer';
import type { SubmissionState } from '../hooks/useSubmissionState';

interface FormRendererProps {
  form: FormNode;
  state?: SubmissionState;
}

export function FormRenderer({ form, state }: FormRendererProps) {
  const isLocked = state?.status === 'submitting';

  return (
    <div className={isLocked ? 'opacity-60 pointer-events-none' : ''}>
      {/* Overlay to prevent interaction */}
      {isLocked && (
        <div className="absolute inset-0 bg-white bg-opacity-50 cursor-not-allowed z-10" />
      )}

      {/* Form fields */}
      <div className="space-y-6">
        {/* Your form fields here */}
      </div>
    </div>
  );
}
```

### Disable Individual Fields

```tsx title="src/components/FormField.tsx"
import { useFormControl } from 'reformer';

interface FormFieldProps {
  control: any;
  label: string;
  locked?: boolean;
}

export function FormField({ control, label, locked = false }: FormFieldProps) {
  const { value, errors, setValue } = useFormControl(control);

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={locked}
        className={`
          w-full px-3 py-2 border rounded-lg
          ${errors ? 'border-red-500' : 'border-gray-300'}
          ${locked ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
        `}
      />
      {errors && (
        <p className="text-red-600 text-sm mt-1">{errors[0]?.message}</p>
      )}
    </div>
  );
}
```

## Progress Indicator

Show upload/submission progress for long-running operations.

### Progress Bar Component

```tsx title="src/components/ProgressBar.tsx"
interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
}

export function ProgressBar({ progress, label }: ProgressBarProps) {
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-sm font-medium text-gray-700">{progress}%</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
```

### With Submission State

```tsx title="src/components/CreditApplicationForm.tsx"
import { ProgressBar } from './ProgressBar';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const { state, submit } = useSubmissionState(form, submitFn);

  return (
    <form onSubmit={handleSubmit}>
      <FormRenderer form={form} />

      {/* Show progress during submission */}
      {state.status === 'submitting' && state.progress && (
        <ProgressBar
          progress={state.progress}
          label="Uploading application"
        />
      )}

      <SubmitButton form={form} state={state} />
    </form>
  );
}
```

## Complete Integration Example

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCreditApplicationForm } from '../schemas/create-form';
import { creditApplicationTransformer } from '../utils/credit-application-transformer';
import { submitApplication } from '../services/api/submission.api';
import { useSubmissionState } from '../hooks/useSubmissionState';
import { SubmitButton } from './SubmitButton';
import { SubmissionStatus } from './SubmissionStatus';
import { FormRenderer } from './FormRenderer';

export function CreditApplicationForm() {
  const navigate = useNavigate();
  const form = useMemo(() => createCreditApplicationForm(), []);

  const {
    state,
    submit,
    reset,
    isIdle,
    isSubmitting,
    isSuccess,
    isError
  } = useSubmissionState(form, async (data) => {
    const apiData = creditApplicationTransformer.serialize(data);
    return await submitApplication(apiData);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const result = await submit();

      // Navigate to success page after a short delay
      setTimeout(() => {
        navigate(`/applications/${result.id}/success`);
      }, 2000);
    } catch (error) {
      // Error is already captured in state
      console.error('Submission failed:', error);
    }
  };

  const handleReset = () => {
    reset();
    form.reset();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Credit Application</h1>

      {/* Status Messages */}
      <SubmissionStatus state={state} onReset={handleReset} />

      <form onSubmit={handleSubmit}>
        {/* Form Fields - locked during submission */}
        <FormRenderer form={form} state={state} />

        {/* Submit Button - changes based on state */}
        <div className="mt-6">
          <SubmitButton form={form} state={state} />
        </div>
      </form>
    </div>
  );
}
```

## Testing State Transitions

### Test Scenarios

```typescript title="src/components/CreditApplicationForm.test.tsx"
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreditApplicationForm } from './CreditApplicationForm';
import { submitApplication } from '../services/api/submission.api';

jest.mock('../services/api/submission.api');

describe('CreditApplicationForm - Submission States', () => {
  test('transitions from idle to submitting to success', async () => {
    (submitApplication as jest.Mock).mockResolvedValue({
      id: 'app-123',
      status: 'pending',
    });

    render(<CreditApplicationForm />);

    // Initial state: Idle
    expect(screen.getByText('Submit Application')).toBeInTheDocument();

    // Fill form and submit
    const submitButton = screen.getByText('Submit Application');
    fireEvent.click(submitButton);

    // Submitting state
    await waitFor(() => {
      expect(screen.getByText('Submitting...')).toBeInTheDocument();
    });

    // Success state
    await waitFor(() => {
      expect(screen.getByText(/submitted successfully/i)).toBeInTheDocument();
    });
  });

  test('transitions from submitting to error on failure', async () => {
    (submitApplication as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    render(<CreditApplicationForm />);

    // Submit form
    const submitButton = screen.getByText('Submit Application');
    fireEvent.click(submitButton);

    // Error state
    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      expect(screen.getByText('Retry Submission')).toBeInTheDocument();
    });
  });

  test('allows retry from error state', async () => {
    let attempts = 0;
    (submitApplication as jest.Mock).mockImplementation(() => {
      attempts++;
      if (attempts === 1) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({ id: 'app-123', status: 'pending' });
    });

    render(<CreditApplicationForm />);

    // First attempt - fails
    fireEvent.click(screen.getByText('Submit Application'));

    await waitFor(() => {
      expect(screen.getByText('Retry Submission')).toBeInTheDocument();
    });

    // Retry - succeeds
    fireEvent.click(screen.getByText('Retry Submission'));

    await waitFor(() => {
      expect(screen.getByText(/submitted successfully/i)).toBeInTheDocument();
    });
  });

  test('locks form during submission', async () => {
    (submitApplication as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    const { container } = render(<CreditApplicationForm />);

    // Submit form
    fireEvent.click(screen.getByText('Submit Application'));

    // Form should be locked
    await waitFor(() => {
      const formInputs = container.querySelectorAll('input');
      formInputs.forEach(input => {
        expect(input).toBeDisabled();
      });
    });
  });
});
```

## Best Practices

### 1. Always Track All States

```typescript
// ✅ GOOD: Track all states
const { state, isIdle, isSubmitting, isSuccess, isError } = useSubmissionState(form, submitFn);

// ❌ BAD: Only track loading
const [loading, setLoading] = useState(false);
```

### 2. Provide Clear Visual Feedback

```tsx
// ✅ GOOD: Different UI for each state
{state.status === 'submitting' && <LoadingSpinner />}
{state.status === 'success' && <SuccessMessage />}
{state.status === 'error' && <ErrorMessage />}

// ❌ BAD: Generic message
{loading && <span>Please wait...</span>}
```

### 3. Lock Form During Submission

```tsx
// ✅ GOOD: Disable all interactions
<FormRenderer form={form} locked={isSubmitting} />

// ❌ BAD: Allow editing during submission
<FormRenderer form={form} />
```

### 4. Enable Retry on Error

```tsx
// ✅ GOOD: Show retry button
{isError && <button onClick={submit}>Retry</button>}

// ❌ BAD: No way to retry
{isError && <span>Error occurred</span>}
```

### 5. Clear Success Before New Submission

```typescript
// ✅ GOOD: Reset state before new submission
const handleReset = () => {
  reset();
  form.reset();
};

// ❌ BAD: Keep stale success state
// Previous success message still showing
```

## Key Takeaways

- Use state machines to track submission lifecycle
- Provide clear visual feedback for each state
- Lock form during submission to prevent conflicts
- Enable retry from error state
- Show progress for long-running operations
- Test all state transitions
- Handle navigation after success

## What's Next?

You've implemented comprehensive submission state management! Next, we'll handle **Server Errors**:

- Server-side validation errors
- Mapping errors to form fields
- Generic server errors
- Error recovery strategies
- Different HTTP status codes
- Field-specific vs global errors

In the next section, we'll ensure your form handles all types of server responses gracefully and provides helpful feedback to users.

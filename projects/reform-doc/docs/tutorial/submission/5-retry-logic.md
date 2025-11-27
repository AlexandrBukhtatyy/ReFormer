---
sidebar_position: 5
---

# Retry Logic

Implementing automatic and manual retry mechanisms for failed submissions.

## Overview

Retry logic makes your form resilient to temporary failures:

- **Automatic Retry** - Retry failed requests automatically
- **Exponential Backoff** - Increase delay between retries
- **Maximum Attempts** - Limit retry attempts
- **Manual Retry** - Allow user-triggered retries
- **Retry Indicators** - Show retry progress to users
- **Selective Retry** - Only retry appropriate errors

## Understanding Retry Strategies

### When to Retry

```typescript
// ✅ RETRY these errors
- Network errors (connection failed)
- Server errors (500, 502, 503, 504)
- Timeout errors
- Rate limiting (429) - after waiting

// ❌ DON'T RETRY these errors
- Validation errors (422)
- Authentication errors (401)
- Authorization errors (403)
- Client errors (400, 404)
```

### Exponential Backoff

Exponential backoff prevents overwhelming the server:

```
Attempt 1: Wait 1 second   (1 × 2^0)
Attempt 2: Wait 2 seconds  (1 × 2^1)
Attempt 3: Wait 4 seconds  (1 × 2^2)
Attempt 4: Wait 8 seconds  (1 × 2^3)
Max delay: 10 seconds (cap)
```

```typescript
const delay = Math.min(
  initialDelay * Math.pow(backoffMultiplier, attemptNumber),
  maxDelay
);
```

## Creating useRetry Hook

Build a reusable hook for retry logic.

### Retry Options

```typescript title="src/hooks/useRetry.ts"
export interface RetryOptions {
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxAttempts: number;

  /**
   * Initial delay in milliseconds
   * @default 1000
   */
  initialDelay: number;

  /**
   * Maximum delay in milliseconds
   * @default 10000
   */
  maxDelay: number;

  /**
   * Backoff multiplier
   * @default 2
   */
  backoffMultiplier: number;

  /**
   * Function to determine if an error is retryable
   */
  shouldRetry?: (error: Error) => boolean;

  /**
   * Callback fired before each retry
   */
  onRetry?: (attempt: number, error: Error) => void;
}
```

### Hook Implementation

```typescript title="src/hooks/useRetry.ts"
import { useState, useCallback } from 'react';
import {
  ValidationSubmissionError,
  AuthenticationError,
} from '../errors/submission-errors';

export interface UseRetryResult<T> {
  submit: () => Promise<T>;
  attempt: number;
  retrying: boolean;
  reset: () => void;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Default retry strategy - don't retry validation or auth errors
 */
function defaultShouldRetry(error: Error): boolean {
  // Never retry validation errors
  if (error instanceof ValidationSubmissionError) {
    return false;
  }

  // Never retry authentication errors
  if (error instanceof AuthenticationError) {
    return false;
  }

  // Retry errors with retryable flag
  if ('retryable' in error) {
    return (error as any).retryable === true;
  }

  // By default, retry other errors
  return true;
}

/**
 * Hook to add retry logic to a submit function
 */
export function useRetry<T>(
  submitFn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): UseRetryResult<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);

  const submit = useCallback(async (): Promise<T> => {
    let lastError: Error | undefined;

    for (let i = 0; i < maxAttempts; i++) {
      setAttempt(i + 1);

      try {
        // Try to submit
        const result = await submitFn();

        // Success! Reset and return
        setAttempt(0);
        setRetrying(false);
        return result;
      } catch (error) {
        lastError = error as Error;

        console.log(`Attempt ${i + 1}/${maxAttempts} failed:`, error);

        // Check if we should retry this error
        if (!shouldRetry(lastError)) {
          console.log('Error is not retryable, stopping');
          setAttempt(0);
          setRetrying(false);
          throw lastError;
        }

        // Last attempt - don't wait, just throw
        if (i === maxAttempts - 1) {
          console.log('Max attempts reached, stopping');
          setAttempt(0);
          setRetrying(false);
          throw lastError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          initialDelay * Math.pow(backoffMultiplier, i),
          maxDelay
        );

        console.log(`Retrying in ${delay}ms...`);

        // Call retry callback
        if (onRetry) {
          onRetry(i + 1, lastError);
        }

        // Wait before next attempt
        setRetrying(true);
        await sleep(delay);
        setRetrying(false);
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError!;
  }, [submitFn, maxAttempts, initialDelay, maxDelay, backoffMultiplier, shouldRetry, onRetry]);

  const reset = useCallback(() => {
    setAttempt(0);
    setRetrying(false);
  }, []);

  return {
    submit,
    attempt,
    retrying,
    reset,
  };
}
```

## Using the Retry Hook

### Basic Usage

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo } from 'react';
import { createCreditApplicationForm } from '../schemas/create-form';
import { creditApplicationTransformer } from '../utils/credit-application-transformer';
import { submitApplication } from '../services/api/submission.api';
import { useRetry } from '../hooks/useRetry';

export function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const { submit, attempt, retrying } = useRetry(
    async () => {
      form.touchAll();
      const data = form.getValue();
      const apiData = creditApplicationTransformer.serialize(data);
      return await submitApplication(apiData);
    },
    {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 5000,
      backoffMultiplier: 2,
      onRetry: (attempt, error) => {
        console.log(`Retry attempt ${attempt}:`, error.message);
      },
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const result = await submit();
      console.log('Success:', result);
    } catch (error) {
      console.error('All retry attempts failed:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormRenderer form={form} />

      {/* Show retry indicator */}
      {retrying && (
        <div className="text-blue-600">
          Retrying... (Attempt {attempt}/3)
        </div>
      )}

      <button type="submit" disabled={retrying}>
        Submit Application
      </button>
    </form>
  );
}
```

## Retry Indicator Component

Create a visual indicator for retry progress.

### RetryIndicator Component

```tsx title="src/components/RetryIndicator.tsx"
interface RetryIndicatorProps {
  attempt: number;
  maxAttempts: number;
  retrying: boolean;
}

export function RetryIndicator({
  attempt,
  maxAttempts,
  retrying
}: RetryIndicatorProps) {
  if (attempt === 0) {
    return null;
  }

  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
      <div className="flex items-center">
        {retrying && (
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
        )}
        <div>
          <p className="text-blue-800 font-medium">
            {retrying ? 'Retrying submission...' : 'Submitting...'}
          </p>
          <p className="text-blue-600 text-sm">
            Attempt {attempt} of {maxAttempts}
          </p>
        </div>
      </div>
    </div>
  );
}
```

### Using RetryIndicator

```tsx title="src/components/CreditApplicationForm.tsx"
import { RetryIndicator } from './RetryIndicator';

export function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const { submit, attempt, retrying } = useRetry(submitFn, {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 5000,
  });

  return (
    <form onSubmit={handleSubmit}>
      {/* Show retry progress */}
      <RetryIndicator
        attempt={attempt}
        maxAttempts={3}
        retrying={retrying}
      />

      <FormRenderer form={form} />

      <SubmitButton disabled={retrying} />
    </form>
  );
}
```

## Manual Retry Button

Allow users to manually retry after all automatic attempts fail.

### Manual Retry Component

```tsx title="src/components/ManualRetryButton.tsx"
interface ManualRetryButtonProps {
  onRetry: () => void;
  error: Error;
  disabled?: boolean;
}

export function ManualRetryButton({
  onRetry,
  error,
  disabled = false
}: ManualRetryButtonProps) {
  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-yellow-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Automatic retry failed
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>{error.message}</p>
            <p className="mt-1">
              The submission failed after multiple attempts. You can try again manually.
            </p>
          </div>
          <div className="mt-4">
            <button
              onClick={onRetry}
              disabled={disabled}
              className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Combining Retry with Submission State

Integrate retry logic with submission state management.

### Enhanced useSubmissionState

```typescript title="src/hooks/useSubmissionState.ts"
import { useState, useCallback } from 'react';
import type { FormNode } from 'reformer';
import { useRetry, type RetryOptions } from './useRetry';

export interface UseSubmissionStateWithRetryOptions {
  retry?: Partial<RetryOptions>;
}

export function useSubmissionState<T>(
  form: FormNode,
  submitFn: (data: any) => Promise<T>,
  options: UseSubmissionStateWithRetryOptions = {}
): UseSubmissionStateResult<T> & {
  attempt: number;
  retrying: boolean;
} {
  const [state, setState] = useState<SubmissionState<T>>({ status: 'idle' });

  // Wrap submitFn with form methods
  const wrappedSubmit = useCallback(async () => {
    form.touchAll();
    const data = form.getValue();
    return await submitFn(data);
  }, [form, submitFn]);

  // Add retry logic
  const { submit: submitWithRetry, attempt, retrying } = useRetry(
    wrappedSubmit,
    {
      ...options.retry,
      onRetry: (attemptNum, error) => {
        // Update state to show retry progress
        setState({
          status: 'submitting',
          progress: (attemptNum / (options.retry?.maxAttempts || 3)) * 100,
        });

        // Call user's onRetry if provided
        options.retry?.onRetry?.(attemptNum, error);
      },
    }
  );

  const submit = useCallback(async () => {
    setState({ status: 'submitting' });

    try {
      const result = await submitWithRetry();
      setState({ status: 'success', data: result });
      return result;
    } catch (error) {
      setState({
        status: 'error',
        error: error instanceof Error ? error : new Error('Submission failed')
      });
      throw error;
    }
  }, [submitWithRetry]);

  const reset = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  return {
    state,
    submit,
    reset,
    attempt,
    retrying,
    isIdle: state.status === 'idle',
    isSubmitting: state.status === 'submitting',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
  };
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
import { ValidationSubmissionError } from '../errors/submission-errors';
import { useSubmissionState } from '../hooks/useSubmissionState';
import { RetryIndicator } from './RetryIndicator';
import { ManualRetryButton } from './ManualRetryButton';
import { SubmitButton } from './SubmitButton';
import { FormRenderer } from './FormRenderer';

export function CreditApplicationForm() {
  const navigate = useNavigate();
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [manualRetryNeeded, setManualRetryNeeded] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);

  const {
    state,
    submit,
    attempt,
    retrying,
    isSubmitting,
    isSuccess,
  } = useSubmissionState(
    form,
    async (data) => {
      const apiData = creditApplicationTransformer.serialize(data);
      return await submitApplication(apiData);
    },
    {
      retry: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 5000,
        backoffMultiplier: 2,
        onRetry: (attempt, error) => {
          console.log(`Retry attempt ${attempt}:`, error.message);
        },
      },
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualRetryNeeded(false);
    setLastError(null);

    try {
      const result = await submit();

      // Success - navigate to success page
      setTimeout(() => {
        navigate(`/applications/${result.id}/success`);
      }, 2000);
    } catch (error) {
      console.error('Submission failed after retries:', error);
      setLastError(error as Error);

      // Handle validation errors (not retryable)
      if (error instanceof ValidationSubmissionError) {
        mapServerErrors(form, error);
      } else {
        // Other errors - offer manual retry
        setManualRetryNeeded(true);
      }
    }
  };

  const handleManualRetry = async () => {
    setManualRetryNeeded(false);
    await handleSubmit({ preventDefault: () => {} } as React.FormEvent);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Credit Application</h1>

      {/* Retry indicator */}
      <RetryIndicator
        attempt={attempt}
        maxAttempts={3}
        retrying={retrying}
      />

      {/* Manual retry button */}
      {manualRetryNeeded && lastError && (
        <ManualRetryButton
          onRetry={handleManualRetry}
          error={lastError}
          disabled={isSubmitting}
        />
      )}

      {/* Success message */}
      {isSuccess && state.status === 'success' && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
          <p className="text-green-700">
            Application {state.data.id} submitted successfully!
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Form fields */}
        <FormRenderer form={form} state={state} />

        {/* Submit button */}
        <div className="mt-6">
          <SubmitButton
            form={form}
            state={state}
          />
        </div>
      </form>
    </div>
  );
}
```

## Advanced Retry Strategies

### Custom Retry Logic

```typescript title="src/hooks/useCustomRetry.ts"
import { useRetry } from './useRetry';
import type { RetryOptions } from './useRetry';

/**
 * Retry only network and server errors
 */
export function useNetworkRetry<T>(submitFn: () => Promise<T>) {
  return useRetry(submitFn, {
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 10000,
    shouldRetry: (error) => {
      // Only retry network errors and 5xx errors
      return (
        error.name === 'NetworkSubmissionError' ||
        ('statusCode' in error && (error as any).statusCode >= 500)
      );
    },
  });
}

/**
 * Aggressive retry for critical submissions
 */
export function useAggressiveRetry<T>(submitFn: () => Promise<T>) {
  return useRetry(submitFn, {
    maxAttempts: 10,
    initialDelay: 500,
    maxDelay: 30000,
    backoffMultiplier: 1.5,
  });
}

/**
 * Conservative retry for non-critical submissions
 */
export function useConservativeRetry<T>(submitFn: () => Promise<T>) {
  return useRetry(submitFn, {
    maxAttempts: 2,
    initialDelay: 2000,
    maxDelay: 5000,
    backoffMultiplier: 2,
  });
}
```

### Rate Limit Aware Retry

```typescript title="src/hooks/useRateLimitRetry.ts"
import { useRetry } from './useRetry';
import { RateLimitError } from '../errors/submission-errors';

/**
 * Retry with rate limit awareness
 */
export function useRateLimitRetry<T>(submitFn: () => Promise<T>) {
  return useRetry(submitFn, {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 60000, // Allow up to 1 minute wait
    shouldRetry: (error) => {
      // Always retry rate limit errors
      if (error instanceof RateLimitError) {
        return true;
      }

      // Use default retry logic for other errors
      return (
        error.name !== 'ValidationSubmissionError' &&
        error.name !== 'AuthenticationError'
      );
    },
    onRetry: (attempt, error) => {
      if (error instanceof RateLimitError && error.retryAfter) {
        console.log(`Rate limited. Waiting ${error.retryAfter} seconds before retry.`);
      }
    },
  });
}
```

## Testing Retry Logic

### Test Scenarios

```typescript title="src/components/CreditApplicationForm.test.tsx"
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreditApplicationForm } from './CreditApplicationForm';
import { submitApplication } from '../services/api/submission.api';
import { NetworkSubmissionError } from '../errors/submission-errors';

jest.mock('../services/api/submission.api');

describe('CreditApplicationForm - Retry Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('retries on network error', async () => {
    let attempts = 0;

    (submitApplication as jest.Mock).mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new NetworkSubmissionError());
      }
      return Promise.resolve({ id: 'app-123', status: 'pending' });
    });

    render(<CreditApplicationForm />);

    // Submit form
    fireEvent.click(screen.getByText('Submit Application'));

    // Should show retry indicator
    await waitFor(() => {
      expect(screen.getByText(/Retrying/i)).toBeInTheDocument();
    });

    // Fast-forward through retry delays
    jest.runAllTimers();

    // Should eventually succeed
    await waitFor(() => {
      expect(screen.getByText(/submitted successfully/i)).toBeInTheDocument();
    });

    // Should have attempted 3 times
    expect(attempts).toBe(3);
  });

  test('stops retry on validation error', async () => {
    const validationError = new ValidationSubmissionError([
      { field: 'email', code: 'required', message: 'Email required' },
    ]);

    (submitApplication as jest.Mock).mockRejectedValue(validationError);

    render(<CreditApplicationForm />);

    fireEvent.click(screen.getByText('Submit Application'));

    // Should not retry
    await waitFor(() => {
      expect(screen.getByText(/Email required/i)).toBeInTheDocument();
    });

    // Should only attempt once
    expect(submitApplication).toHaveBeenCalledTimes(1);
  });

  test('shows manual retry after max attempts', async () => {
    (submitApplication as jest.Mock).mockRejectedValue(
      new NetworkSubmissionError()
    );

    render(<CreditApplicationForm />);

    fireEvent.click(screen.getByText('Submit Application'));

    // Fast-forward through all retries
    jest.runAllTimers();

    // Should show manual retry button
    await waitFor(() => {
      expect(screen.getByText('Try Again')).toBeInTheDocument();
      expect(screen.getByText(/Automatic retry failed/i)).toBeInTheDocument();
    });
  });

  test('exponential backoff increases delay', async () => {
    const delays: number[] = [];
    let resolveDelay: (() => void) | null = null;

    jest.spyOn(global, 'setTimeout').mockImplementation((fn, delay) => {
      delays.push(delay as number);
      return setTimeout(() => {
        (fn as () => void)();
        resolveDelay?.();
      }, 0) as any;
    });

    (submitApplication as jest.Mock).mockRejectedValue(
      new NetworkSubmissionError()
    );

    render(<CreditApplicationForm />);

    fireEvent.click(screen.getByText('Submit Application'));

    jest.runAllTimers();

    await waitFor(() => {
      expect(delays.length).toBeGreaterThan(0);
    });

    // Verify exponential backoff: 1s, 2s, 4s
    expect(delays[0]).toBe(1000);
    expect(delays[1]).toBe(2000);
    expect(delays[2]).toBe(4000);
  });
});
```

## Best Practices

### 1. Use Exponential Backoff

```typescript
// ✅ GOOD: Exponential backoff
{
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
}

// ❌ BAD: Fixed delay
{
  initialDelay: 1000,
  maxDelay: 1000,
  backoffMultiplier: 1,
}
```

### 2. Limit Retry Attempts

```typescript
// ✅ GOOD: Limited attempts
{ maxAttempts: 3 }

// ❌ BAD: Unlimited retries
{ maxAttempts: Infinity }
```

### 3. Only Retry Appropriate Errors

```typescript
// ✅ GOOD: Selective retry
shouldRetry: (error) => {
  return error.name === 'NetworkError' || error.statusCode >= 500;
}

// ❌ BAD: Retry everything
shouldRetry: () => true // Including validation errors!
```

### 4. Show Retry Progress

```tsx
// ✅ GOOD: Show progress
<RetryIndicator attempt={attempt} maxAttempts={3} />

// ❌ BAD: No feedback
// User doesn't know retry is happening
```

### 5. Provide Manual Retry

```tsx
// ✅ GOOD: Manual retry after auto-retry fails
{manualRetryNeeded && <ManualRetryButton onRetry={retry} />}

// ❌ BAD: No way to retry
// User is stuck after auto-retry fails
```

## Key Takeaways

- Implement automatic retry with exponential backoff
- Limit retry attempts to prevent infinite loops
- Only retry network and server errors
- Show retry progress to users
- Provide manual retry option after auto-retry fails
- Test retry logic thoroughly
- Consider different retry strategies for different scenarios

## What's Next?

You've implemented robust retry logic! Next, we'll add **Optimistic Updates**:

- Immediate UI updates before server confirmation
- Rollback on error
- Conflict resolution
- Optimistic indicators
- Integration with lists and caches
- Testing optimistic updates

In the next section, we'll make your form feel instant while maintaining data integrity.

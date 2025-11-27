---
sidebar_position: 6
---

# Optimistic Updates

Implementing optimistic UI updates for instant user feedback.

## Overview

Optimistic updates make your form feel instant by updating the UI before server confirmation:

- **Immediate Feedback** - Update UI instantly on submit
- **Rollback on Error** - Revert changes if submission fails
- **Optimistic Indicators** - Show which data is pending
- **Conflict Resolution** - Handle server-side changes
- **Cache Integration** - Update cached data optimistically
- **User Confidence** - Improve perceived performance

## Understanding Optimistic Updates

### The Optimistic Flow

```
USER SUBMITS FORM
    ↓
IMMEDIATE UI UPDATE (optimistic)
    ↓
SEND TO SERVER (background)
    ↓
    ├─ SUCCESS
    │   └─ Confirm optimistic update
    │
    └─ ERROR
        └─ Rollback to previous state
```

### When to Use Optimistic Updates

```typescript
// ✅ GOOD use cases for optimistic updates
- Adding items to a list
- Updating profile information
- Marking tasks as complete
- Liking/favoriting items
- Simple status changes

// ❌ DON'T use optimistic updates for
- Financial transactions
- Critical data changes
- Complex validations
- Operations with unpredictable results
```

## Creating useOptimistic Hook

Build a hook to manage optimistic updates safely.

### Hook Implementation

```typescript title="src/hooks/useOptimistic.ts"
import { useState, useCallback, useRef } from 'react';
import type { FormNode } from 'reformer';

export interface OptimisticOptions<T> {
  /**
   * Generate optimistic data from form data
   */
  getOptimisticData: (formData: any) => T;

  /**
   * Called when optimistic update is applied
   */
  onOptimisticUpdate: (data: T) => void;

  /**
   * Called when optimistic update is confirmed
   */
  onConfirm?: (actualData: T) => void;

  /**
   * Called when optimistic update is rolled back
   */
  onRollback: (optimisticData: T) => void;

  /**
   * Called on any error during submission
   */
  onError?: (error: Error) => void;
}

export interface UseOptimisticResult<T> {
  submit: () => Promise<T>;
  isOptimistic: boolean;
  optimisticData: T | null;
}

/**
 * Hook to handle optimistic updates
 */
export function useOptimistic<T>(
  form: FormNode,
  submitFn: (data: any) => Promise<T>,
  options: OptimisticOptions<T>
): UseOptimisticResult<T> {
  const [isOptimistic, setIsOptimistic] = useState(false);
  const [optimisticData, setOptimisticData] = useState<T | null>(null);

  // Keep track of form snapshot for rollback
  const snapshotRef = useRef<any>(null);

  const submit = useCallback(async (): Promise<T> => {
    // Save current form state for potential rollback
    snapshotRef.current = form.value.value;

    // Generate optimistic data
    const optimistic = options.getOptimisticData(snapshotRef.current);
    setOptimisticData(optimistic);
    setIsOptimistic(true);

    // Apply optimistic update immediately
    options.onOptimisticUpdate(optimistic);

    try {
      // Perform actual submission
      form.touchAll();
      const data = form.getValue();
      const result = await submitFn(data);

      // Confirm optimistic update
      setIsOptimistic(false);
      setOptimisticData(null);

      if (options.onConfirm) {
        options.onConfirm(result);
      }

      return result;
    } catch (error) {
      // Rollback on error
      setIsOptimistic(false);
      setOptimisticData(null);

      // Restore form to previous state
      if (snapshotRef.current) {
        form.patchValue(snapshotRef.current);
      }

      // Rollback UI changes
      options.onRollback(optimistic);

      // Call error handler
      if (options.onError) {
        options.onError(error as Error);
      }

      throw error;
    }
  }, [form, submitFn, options]);

  return {
    submit,
    isOptimistic,
    optimisticData,
  };
}
```

## Using Optimistic Updates

### Basic Example - Application List

```tsx title="src/components/ApplicationsList.tsx"
import { useState, useMemo } from 'react';
import { createCreditApplicationForm } from '../schemas/create-form';
import { creditApplicationTransformer } from '../utils/credit-application-transformer';
import { submitApplication } from '../services/api/submission.api';
import { useOptimistic } from '../hooks/useOptimistic';

interface Application {
  id: string;
  status: string;
  loanAmount: number;
  submittedAt: string;
  _optimistic?: boolean;
}

export function ApplicationsList() {
  const [applications, setApplications] = useState<Application[]>([]);
  const form = useMemo(() => createCreditApplicationForm(), []);

  const { submit, isOptimistic, optimisticData } = useOptimistic(
    form,
    async (data) => {
      const apiData = creditApplicationTransformer.serialize(data);
      return await submitApplication(apiData);
    },
    {
      getOptimisticData: (formData) => ({
        id: `temp-${Date.now()}`,
        status: 'pending',
        loanAmount: formData.step1.loanAmount,
        submittedAt: new Date().toISOString(),
        _optimistic: true,
      }),
      onOptimisticUpdate: (optimisticApp) => {
        // Add optimistic application to list immediately
        setApplications((prev) => [optimisticApp, ...prev]);
      },
      onConfirm: (actualApp) => {
        // Replace optimistic with actual data
        setApplications((prev) =>
          prev.map((app) =>
            app._optimistic ? actualApp : app
          )
        );
      },
      onRollback: (optimisticApp) => {
        // Remove optimistic application
        setApplications((prev) =>
          prev.filter((app) => app.id !== optimisticApp.id)
        );
      },
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await submit();
      form.reset();
    } catch (error) {
      console.error('Submission failed:', error);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <FormRenderer form={form} />
        <button type="submit">Submit Application</button>
      </form>

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Your Applications</h2>
        <div className="space-y-4">
          {applications.map((app) => (
            <ApplicationCard
              key={app.id}
              application={app}
              isOptimistic={app._optimistic}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Application Card with Optimistic Indicator

```tsx title="src/components/ApplicationCard.tsx"
interface ApplicationCardProps {
  application: {
    id: string;
    status: string;
    loanAmount: number;
    submittedAt: string;
    _optimistic?: boolean;
  };
  isOptimistic?: boolean;
}

export function ApplicationCard({ application, isOptimistic }: ApplicationCardProps) {
  return (
    <div
      className={`
        border rounded-lg p-4
        ${isOptimistic ? 'opacity-60 bg-blue-50' : 'bg-white'}
      `}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">
            Application {application.id}
            {isOptimistic && (
              <span className="ml-2 text-xs text-blue-600 font-normal">
                Submitting...
              </span>
            )}
          </h3>
          <p className="text-sm text-gray-600">
            Loan Amount: ${application.loanAmount.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">
            Status: {application.status}
          </p>
        </div>

        {isOptimistic && (
          <svg
            className="animate-spin h-5 w-5 text-blue-600"
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
      </div>
    </div>
  );
}
```

## Optimistic Update Patterns

### Pattern 1: Add to List

```typescript
// Add item optimistically to a list
onOptimisticUpdate: (optimisticItem) => {
  setItems((prev) => [...prev, optimisticItem]);
},
onConfirm: (actualItem) => {
  setItems((prev) =>
    prev.map((item) =>
      item._optimistic ? actualItem : item
    )
  );
},
onRollback: (optimisticItem) => {
  setItems((prev) =>
    prev.filter((item) => item.id !== optimisticItem.id)
  );
}
```

### Pattern 2: Update Item in List

```typescript
// Update existing item optimistically
onOptimisticUpdate: (updatedItem) => {
  setItems((prev) =>
    prev.map((item) =>
      item.id === updatedItem.id
        ? { ...updatedItem, _optimistic: true }
        : item
    )
  );
},
onConfirm: (actualItem) => {
  setItems((prev) =>
    prev.map((item) =>
      item.id === actualItem.id ? actualItem : item
    )
  );
},
onRollback: (optimisticItem) => {
  // Restore from snapshot
  setItems(snapshotItems);
}
```

### Pattern 3: Delete from List

```typescript
// Remove item optimistically
onOptimisticUpdate: (itemToDelete) => {
  setItems((prev) =>
    prev.map((item) =>
      item.id === itemToDelete.id
        ? { ...item, _optimistic: true, _deleted: true }
        : item
    )
  );
},
onConfirm: (deletedItem) => {
  setItems((prev) =>
    prev.filter((item) => item.id !== deletedItem.id)
  );
},
onRollback: (itemToDelete) => {
  setItems((prev) =>
    prev.map((item) =>
      item.id === itemToDelete.id
        ? { ...item, _optimistic: false, _deleted: false }
        : item
    )
  );
}
```

## Conflict Resolution

Handle cases where server data differs from optimistic data.

### Conflict Detection

```typescript title="src/hooks/useOptimisticWithConflictResolution.ts"
import { useOptimistic } from './useOptimistic';
import type { OptimisticOptions } from './useOptimistic';

export interface ConflictResolutionStrategy<T> {
  /**
   * Detect if there's a conflict between optimistic and actual data
   */
  detectConflict: (optimistic: T, actual: T) => boolean;

  /**
   * Resolve the conflict
   * @returns The resolved data to use
   */
  resolveConflict: (optimistic: T, actual: T) => T;

  /**
   * Called when a conflict is detected
   */
  onConflict?: (optimistic: T, actual: T, resolved: T) => void;
}

export function useOptimisticWithConflictResolution<T>(
  form: FormNode,
  submitFn: (data: any) => Promise<T>,
  options: OptimisticOptions<T>,
  conflictStrategy: ConflictResolutionStrategy<T>
) {
  return useOptimistic(form, submitFn, {
    ...options,
    onConfirm: (actualData) => {
      const optimistic = options.getOptimisticData(form.value.value);

      // Check for conflicts
      if (conflictStrategy.detectConflict(optimistic, actualData)) {
        console.warn('Conflict detected between optimistic and actual data');

        // Resolve conflict
        const resolved = conflictStrategy.resolveConflict(optimistic, actualData);

        // Notify
        if (conflictStrategy.onConflict) {
          conflictStrategy.onConflict(optimistic, actualData, resolved);
        }

        // Use resolved data
        options.onConfirm?.(resolved);
      } else {
        // No conflict, use actual data
        options.onConfirm?.(actualData);
      }
    },
  });
}
```

### Using Conflict Resolution

```tsx title="src/components/ApplicationsList.tsx"
const { submit } = useOptimisticWithConflictResolution(
  form,
  submitFn,
  {
    getOptimisticData: (formData) => ({
      id: `temp-${Date.now()}`,
      status: 'pending',
      loanAmount: formData.step1.loanAmount,
    }),
    onOptimisticUpdate: (data) => {
      setApplications((prev) => [data, ...prev]);
    },
    onConfirm: (data) => {
      setApplications((prev) =>
        prev.map((app) => (app._optimistic ? data : app))
      );
    },
    onRollback: (data) => {
      setApplications((prev) =>
        prev.filter((app) => app.id !== data.id)
      );
    },
  },
  {
    detectConflict: (optimistic, actual) => {
      // Check if server assigned different status
      return optimistic.status !== actual.status;
    },
    resolveConflict: (optimistic, actual) => {
      // Server wins
      return actual;
    },
    onConflict: (optimistic, actual, resolved) => {
      console.log('Conflict resolved:', { optimistic, actual, resolved });
      // Optionally show notification to user
      showNotification('Application status was updated by the server');
    },
  }
);
```

## Optimistic Update Indicators

Visual indicators to show optimistic state.

### Optimistic Badge

```tsx title="src/components/OptimisticBadge.tsx"
export function OptimisticBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
      <svg
        className="animate-spin h-3 w-3"
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
      Saving...
    </span>
  );
}
```

### Optimistic Overlay

```tsx title="src/components/OptimisticOverlay.tsx"
interface OptimisticOverlayProps {
  isOptimistic: boolean;
  children: React.ReactNode;
}

export function OptimisticOverlay({
  isOptimistic,
  children
}: OptimisticOverlayProps) {
  return (
    <div className="relative">
      {children}
      {isOptimistic && (
        <div className="absolute inset-0 bg-blue-50 bg-opacity-50 rounded-lg flex items-center justify-center">
          <div className="bg-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4 text-blue-600"
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
            <span className="text-sm text-gray-700">Submitting...</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

## Complete Example

```tsx title="src/components/CreditApplicationForm.tsx"
import { useState, useMemo } from 'react';
import { createCreditApplicationForm } from '../schemas/create-form';
import { creditApplicationTransformer } from '../utils/credit-application-transformer';
import { submitApplication } from '../services/api/submission.api';
import { useOptimistic } from '../hooks/useOptimistic';
import { OptimisticOverlay } from './OptimisticOverlay';
import { FormRenderer } from './FormRenderer';

interface Application {
  id: string;
  status: string;
  loanAmount: number;
  submittedAt: string;
  _optimistic?: boolean;
}

export function CreditApplicationForm() {
  const [applications, setApplications] = useState<Application[]>([]);
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [error, setError] = useState<string | null>(null);

  const { submit, isOptimistic } = useOptimistic<Application>(
    form,
    async (data) => {
      const apiData = creditApplicationTransformer.serialize(data);
      return await submitApplication(apiData);
    },
    {
      getOptimisticData: (formData) => ({
        id: `temp-${Date.now()}`,
        status: 'pending',
        loanAmount: formData.step1.loanAmount,
        submittedAt: new Date().toISOString(),
        _optimistic: true,
      }),
      onOptimisticUpdate: (optimisticApp) => {
        console.log('Adding optimistic application:', optimisticApp);
        setApplications((prev) => [optimisticApp, ...prev]);
        setError(null);
      },
      onConfirm: (actualApp) => {
        console.log('Confirming application:', actualApp);
        setApplications((prev) =>
          prev.map((app) =>
            app._optimistic ? { ...actualApp, _optimistic: false } : app
          )
        );
      },
      onRollback: (optimisticApp) => {
        console.log('Rolling back application:', optimisticApp);
        setApplications((prev) =>
          prev.filter((app) => app.id !== optimisticApp.id)
        );
      },
      onError: (err) => {
        setError(err.message);
      },
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await submit();
      form.reset();
    } catch (error) {
      console.error('Submission failed:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Credit Application</h1>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <FormRenderer form={form} />

        <button
          type="submit"
          disabled={isOptimistic}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isOptimistic ? 'Submitting...' : 'Submit Application'}
        </button>
      </form>

      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-4">Your Applications</h2>

        {applications.length === 0 ? (
          <p className="text-gray-500">No applications yet</p>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => (
              <OptimisticOverlay key={app.id} isOptimistic={!!app._optimistic}>
                <ApplicationCard application={app} />
              </OptimisticOverlay>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

## Testing Optimistic Updates

```typescript title="src/components/CreditApplicationForm.test.tsx"
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreditApplicationForm } from './CreditApplicationForm';
import { submitApplication } from '../services/api/submission.api';

jest.mock('../services/api/submission.api');

describe('CreditApplicationForm - Optimistic Updates', () => {
  test('adds application optimistically', async () => {
    (submitApplication as jest.Mock).mockResolvedValue({
      id: 'app-123',
      status: 'approved',
      loanAmount: 50000,
    });

    render(<CreditApplicationForm />);

    // Initially no applications
    expect(screen.getByText('No applications yet')).toBeInTheDocument();

    // Submit form
    fireEvent.click(screen.getByText('Submit Application'));

    // Should immediately show optimistic application
    await waitFor(() => {
      expect(screen.queryByText('No applications yet')).not.toBeInTheDocument();
      expect(screen.getByText(/Submitting.../i)).toBeInTheDocument();
    });
  });

  test('confirms optimistic update on success', async () => {
    (submitApplication as jest.Mock).mockResolvedValue({
      id: 'app-123',
      status: 'approved',
      loanAmount: 50000,
    });

    render(<CreditApplicationForm />);

    fireEvent.click(screen.getByText('Submit Application'));

    // Wait for confirmation
    await waitFor(() => {
      expect(screen.queryByText(/Submitting.../i)).not.toBeInTheDocument();
      expect(screen.getByText(/app-123/i)).toBeInTheDocument();
    });
  });

  test('rolls back optimistic update on error', async () => {
    (submitApplication as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    render(<CreditApplicationForm />);

    fireEvent.click(screen.getByText('Submit Application'));

    // Should show optimistic application
    await waitFor(() => {
      expect(screen.getByText(/Submitting.../i)).toBeInTheDocument();
    });

    // Should rollback after error
    await waitFor(() => {
      expect(screen.queryByText(/Submitting.../i)).not.toBeInTheDocument();
      expect(screen.getByText('No applications yet')).toBeInTheDocument();
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });
});
```

## Best Practices

### 1. Always Mark Optimistic Data

```typescript
// ✅ GOOD: Mark with _optimistic flag
{ id: 'temp-123', status: 'pending', _optimistic: true }

// ❌ BAD: No way to identify optimistic data
{ id: 'temp-123', status: 'pending' }
```

### 2. Use Temporary IDs

```typescript
// ✅ GOOD: Unique temporary ID
id: `temp-${Date.now()}-${Math.random()}`

// ❌ BAD: Could conflict
id: 'temp'
```

### 3. Always Implement Rollback

```typescript
// ✅ GOOD: Proper rollback
onRollback: (optimistic) => {
  setItems(prev => prev.filter(item => item.id !== optimistic.id));
}

// ❌ BAD: No rollback
onRollback: () => {} // Optimistic data stays!
```

### 4. Show Visual Indicators

```tsx
// ✅ GOOD: Clear optimistic indicator
{item._optimistic && <OptimisticBadge />}

// ❌ BAD: No indication
// User can't tell what's confirmed vs pending
```

### 5. Don't Use for Critical Operations

```typescript
// ❌ BAD: Optimistic for payment
onOptimisticUpdate: () => {
  setBalance(prev => prev - amount); // Never do this!
}

// ✅ GOOD: Wait for confirmation
await submit();
setBalance(newBalance); // Only after server confirms
```

## Key Takeaways

- Optimistic updates improve perceived performance
- Always mark optimistic data with a flag
- Implement proper rollback on error
- Use visual indicators for optimistic state
- Don't use for critical operations
- Test both success and rollback scenarios
- Consider conflict resolution strategies

## What's Next?

You've implemented optimistic updates! Next, we'll handle **Multi-Step Submission**:

- Step-by-step validation
- Navigation between steps
- Review page before submission
- Edit from review
- Step indicators
- Complete multi-step workflow

In the next section, we'll create a professional multi-step form experience.

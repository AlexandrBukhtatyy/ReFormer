---
sidebar_position: 2
---

# Loading Initial Data

Loading form data from API, localStorage, or other sources.

## What We're Building

We'll create a system to load initial data into our credit application form from multiple sources:

| Source | Priority | Use Case |
|--------|----------|----------|
| API | 1 (Highest) | Edit existing application |
| localStorage | 2 | Resume from saved draft |
| User Profile | 3 | Prefill new application |
| Default | 4 (Lowest) | Empty form |

## Creating the API Service

First, create the API service for loading applications:

```bash
mkdir -p src/services/api
touch src/services/api/application.api.ts
```

### Implementation

```typescript title="src/services/api/application.api.ts"
import type { CreditApplicationForm } from '@/types';

/**
 * API service for credit application operations
 */

// API base URL
const API_BASE = '/api/applications';

/**
 * Load an application by ID
 */
export async function loadApplication(id: string): Promise<CreditApplicationForm> {
  const response = await fetch(`${API_BASE}/${id}`);

  if (!response.ok) {
    throw new Error(`Failed to load application: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Check if an application exists
 */
export async function applicationExists(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/${id}/exists`);
    const result = await response.json();
    return result.exists;
  } catch {
    return false;
  }
}

/**
 * Get application status
 */
export async function getApplicationStatus(id: string): Promise<string> {
  const response = await fetch(`${API_BASE}/${id}/status`);
  const result = await response.json();
  return result.status;
}
```

## Creating the Data Loader Hook

Create a hook to handle data loading with proper state management:

```bash
mkdir -p src/hooks
touch src/hooks/useDataLoader.ts
```

### Implementation

```typescript title="src/hooks/useDataLoader.ts"
import { useState, useEffect } from 'react';
import type { FormNode } from 'reformer';
import { loadApplication } from '@/services/api/application.api';

/**
 * Loading states
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Hook for loading initial form data
 */
export function useDataLoader(form: FormNode, applicationId?: string) {
  const [state, setState] = useState<LoadingState>('idle');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // No ID - skip loading
    if (!applicationId) {
      setState('idle');
      return;
    }

    // Start loading
    setState('loading');
    setError(null);

    loadApplication(applicationId)
      .then((data) => {
        // Patch form with loaded data
        form.patchValue(data);
        setState('success');
      })
      .catch((err) => {
        console.error('Failed to load application:', err);
        setError(err);
        setState('error');
      });
  }, [applicationId, form]);

  return {
    state,
    loading: state === 'loading',
    error,
    isSuccess: state === 'success',
    isError: state === 'error',
  };
}
```

## Loading from localStorage

Create a service for loading drafts from localStorage:

```bash
mkdir -p src/services/storage
touch src/services/storage/draft.storage.ts
```

### Implementation

```typescript title="src/services/storage/draft.storage.ts"
/**
 * localStorage service for drafts
 */

const DRAFT_KEY_PREFIX = 'credit-application-draft-';

/**
 * Save draft to localStorage
 */
export function saveDraftToStorage(draftId: string, data: any): void {
  try {
    const key = `${DRAFT_KEY_PREFIX}${draftId}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save draft to storage:', error);
  }
}

/**
 * Load draft from localStorage
 */
export function loadDraftFromStorage(draftId: string): any | null {
  try {
    const key = `${DRAFT_KEY_PREFIX}${draftId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to load draft from storage:', error);
    return null;
  }
}

/**
 * Check if draft exists in storage
 */
export function draftExistsInStorage(draftId: string): boolean {
  const key = `${DRAFT_KEY_PREFIX}${draftId}`;
  return localStorage.getItem(key) !== null;
}

/**
 * Delete draft from storage
 */
export function deleteDraftFromStorage(draftId: string): void {
  try {
    const key = `${DRAFT_KEY_PREFIX}${draftId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to delete draft from storage:', error);
  }
}

/**
 * Get all draft IDs from storage
 */
export function getAllDraftIds(): string[] {
  const ids: string[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(DRAFT_KEY_PREFIX)) {
        const id = key.substring(DRAFT_KEY_PREFIX.length);
        ids.push(id);
      }
    }
  } catch (error) {
    console.error('Failed to get draft IDs:', error);
  }

  return ids;
}
```

## Loading with Priority

Create an advanced loader that checks multiple sources:

```typescript title="src/hooks/useDataLoader.ts"
import { loadDraftFromStorage } from '@/services/storage/draft.storage';

/**
 * Load data from multiple sources with priority
 */
export function useDataLoaderWithPriority(
  form: FormNode,
  options: {
    applicationId?: string;
    draftId?: string;
    defaultData?: any;
  }
) {
  const [state, setState] = useState<LoadingState>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [source, setSource] = useState<'api' | 'storage' | 'default' | null>(null);

  useEffect(() => {
    const { applicationId, draftId, defaultData } = options;

    async function loadData() {
      setState('loading');
      setError(null);

      try {
        // Priority 1: Try loading from API
        if (applicationId) {
          try {
            const data = await loadApplication(applicationId);
            form.patchValue(data);
            setSource('api');
            setState('success');
            return;
          } catch (apiError) {
            console.warn('API load failed, trying localStorage:', apiError);
          }
        }

        // Priority 2: Try loading from localStorage
        if (draftId) {
          const draftData = loadDraftFromStorage(draftId);
          if (draftData) {
            form.patchValue(draftData);
            setSource('storage');
            setState('success');
            return;
          }
        }

        // Priority 3: Use default data
        if (defaultData) {
          form.patchValue(defaultData);
          setSource('default');
          setState('success');
          return;
        }

        // No data loaded
        setState('idle');
      } catch (err) {
        console.error('Failed to load data:', err);
        setError(err as Error);
        setState('error');
      }
    }

    loadData();
  }, [options.applicationId, options.draftId, form]);

  return {
    state,
    loading: state === 'loading',
    error,
    source,
    isSuccess: state === 'success',
    isError: state === 'error',
  };
}
```

## Integration with Form Component

Now integrate the data loader with your form component:

```typescript title="src/components/CreditApplicationForm.tsx"
import { useMemo } from 'react';
import { createCreditApplicationForm } from '@/schemas/create-form';
import { useDataLoader } from '@/hooks/useDataLoader';

interface CreditApplicationFormProps {
  applicationId?: string;
}

export function CreditApplicationForm({ applicationId }: CreditApplicationFormProps) {
  // Create form
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Load data
  const { loading, error } = useDataLoader(form, applicationId);

  // Loading state
  if (loading) {
    return (
      <div className="loading-container">
        <Spinner />
        <p>Loading application...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="error-container">
        <ErrorIcon />
        <h2>Failed to Load Application</h2>
        <p>{error.message}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  // Success - render form
  return (
    <div className="form-container">
      <h1>{applicationId ? 'Edit Application' : 'New Application'}</h1>
      <FormRenderer form={form} />
    </div>
  );
}
```

## Advanced: Loading with Transformation

Often, API data needs transformation before loading into the form:

```typescript title="src/hooks/useDataLoader.ts"
import { creditApplicationTransformer } from '@/services/data-transform.service';

export function useDataLoaderWithTransform(
  form: FormNode,
  applicationId?: string
) {
  const [state, setState] = useState<LoadingState>('idle');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!applicationId) {
      setState('idle');
      return;
    }

    setState('loading');
    setError(null);

    loadApplication(applicationId)
      .then((apiData) => {
        // Transform API data to form format
        const formData = creditApplicationTransformer.deserialize(apiData);

        // Patch form
        form.patchValue(formData);

        setState('success');
      })
      .catch((err) => {
        console.error('Failed to load application:', err);
        setError(err);
        setState('error');
      });
  }, [applicationId, form]);

  return { state, loading: state === 'loading', error };
}
```

## Handling Loading States in UI

Create reusable loading state components:

```tsx title="src/components/LoadingStates.tsx"
import { ReactNode } from 'react';

interface LoadingBoundaryProps {
  loading: boolean;
  error: Error | null;
  loadingComponent?: ReactNode;
  errorComponent?: ReactNode;
  children: ReactNode;
}

export function LoadingBoundary({
  loading,
  error,
  loadingComponent,
  errorComponent,
  children,
}: LoadingBoundaryProps) {
  if (loading) {
    return loadingComponent || <DefaultLoadingComponent />;
  }

  if (error) {
    return errorComponent || <DefaultErrorComponent error={error} />;
  }

  return <>{children}</>;
}

function DefaultLoadingComponent() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <Spinner className="w-12 h-12 mx-auto mb-4" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

function DefaultErrorComponent({ error }: { error: Error }) {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center max-w-md">
        <ErrorIcon className="w-12 h-12 mx-auto mb-4 text-red-500" />
        <h2 className="text-xl font-semibold mb-2">Failed to Load</h2>
        <p className="text-gray-600 mb-4">{error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
```

Usage with LoadingBoundary:

```tsx title="src/components/CreditApplicationForm.tsx"
export function CreditApplicationForm({ applicationId }: CreditApplicationFormProps) {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const { loading, error } = useDataLoader(form, applicationId);

  return (
    <LoadingBoundary loading={loading} error={error}>
      <div className="form-container">
        <FormRenderer form={form} />
      </div>
    </LoadingBoundary>
  );
}
```

## Testing Loading Scenarios

Test these scenarios:

### Scenario 1: Load Existing Application
- [ ] Provide `applicationId` prop
- [ ] See loading spinner
- [ ] Form loads with data
- [ ] All fields populated correctly
- [ ] Behaviors recalculate (interest rate, monthly payment)
- [ ] Validation runs on loaded data

### Scenario 2: Load from Draft
- [ ] Provide `draftId` prop
- [ ] Data loads from localStorage
- [ ] Form populated with draft data
- [ ] Can continue editing

### Scenario 3: New Application
- [ ] No `applicationId` or `draftId`
- [ ] Form starts empty
- [ ] No loading spinner
- [ ] Ready to fill

### Scenario 4: API Error
- [ ] Invalid `applicationId`
- [ ] See error message
- [ ] Can retry loading
- [ ] Form doesn't crash

### Scenario 5: Network Offline
- [ ] No internet connection
- [ ] Fallback to localStorage draft
- [ ] Shows appropriate message

## Key Takeaways

1. **patchValue** - Use `form.patchValue(data)` to load data into form
2. **Loading States** - Always handle loading, error, and success states
3. **Priority** - Load from API first, fallback to localStorage
4. **Transformation** - Transform API data before loading
5. **Behaviors React** - Computed fields recalculate automatically
6. **Validation Runs** - Validation checks loaded data

## Common Patterns

### Simple Loading
```typescript
const { loading, error } = useDataLoader(form, applicationId);
```

### Loading with Transform
```typescript
const data = await loadApplication(id);
const transformed = transformer.deserialize(data);
form.patchValue(transformed);
```

### Multi-Source Loading
```typescript
const { loading, error, source } = useDataLoaderWithPriority(form, {
  applicationId,
  draftId,
  defaultData,
});
```

### Loading Boundary
```tsx
<LoadingBoundary loading={loading} error={error}>
  <FormRenderer form={form} />
</LoadingBoundary>
```

## What's Next?

In the next section, we'll add **Auto-Save** functionality:
- Auto-save every 30 seconds
- Save on page unload
- Show save status indicator
- Prevent data loss
- Integration with loading

The data we load will be automatically saved as users edit!

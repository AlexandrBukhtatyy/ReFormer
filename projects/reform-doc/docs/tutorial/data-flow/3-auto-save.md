---
sidebar_position: 3
---

# Auto-Save

Automatically saving form progress to prevent data loss.

## What We're Building

We'll implement an auto-save system that:

- **Auto-saves** every 30 seconds when form changes
- **Debounces** to prevent excessive saves
- **Shows status** (idle, saving, saved, error)
- **Saves on page unload** to prevent data loss
- **Saves to localStorage** and/or API
- **Integrates** with existing data loading

## Why Auto-Save?

Without auto-save, users can lose their progress:

```tsx
// ❌ User fills form for 20 minutes
// Browser crashes, power outage, accidental close
// All data is lost!
```

With auto-save:

```tsx
// ✅ Form saves every 30 seconds automatically
// Browser crashes? Reload and continue from last save
// Accidental close? Warned and data saved
```

Benefits:
- **Prevents data loss** - Progress saved continuously
- **Better UX** - Users don't worry about losing work
- **Recovery** - Can resume from any device/session
- **Peace of mind** - Automatic, no manual action needed

## Creating the Auto-Save Service

First, create the core auto-save service:

```bash
touch src/services/auto-save.service.ts
```

### Implementation

```typescript title="src/services/auto-save.service.ts"
import type { FormNode } from 'reformer';

/**
 * Auto-save configuration options
 */
export interface AutoSaveOptions {
  /** Debounce delay in milliseconds */
  debounce: number;
  /** Function to save form data */
  saveFn: (data: any) => Promise<void>;
  /** Called when save succeeds */
  onSaved?: () => void;
  /** Called when save fails */
  onError?: (error: Error) => void;
  /** Called when save starts */
  onSaving?: () => void;
}

/**
 * Auto-save instance
 */
export interface AutoSaveInstance {
  /** Destroy the auto-save (cleanup) */
  destroy: () => void;
  /** Force save immediately */
  saveNow: () => Promise<void>;
  /** Pause auto-saving */
  pause: () => void;
  /** Resume auto-saving */
  resume: () => void;
}

/**
 * Create auto-save service for a form
 */
export function createAutoSave(
  form: FormNode,
  options: AutoSaveOptions
): AutoSaveInstance {
  const { debounce, saveFn, onSaved, onError, onSaving } = options;

  let saveTimeout: NodeJS.Timeout | null = null;
  let isPaused = false;
  let isDestroyed = false;

  // Subscribe to form value changes
  const subscription = form.value.subscribe((value) => {
    // Skip if paused or destroyed
    if (isPaused || isDestroyed) return;

    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // Schedule new save
    saveTimeout = setTimeout(() => {
      performSave(value);
    }, debounce);
  });

  // Perform the actual save
  async function performSave(value: any) {
    if (isDestroyed) return;

    try {
      onSaving?.();
      await saveFn(value);
      onSaved?.();
    } catch (error) {
      console.error('Auto-save failed:', error);
      onError?.(error as Error);
    }
  }

  // Force immediate save
  async function saveNow() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }

    return performSave(form.value.value);
  }

  // Pause auto-saving
  function pause() {
    isPaused = true;
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
  }

  // Resume auto-saving
  function resume() {
    isPaused = false;
  }

  // Cleanup
  function destroy() {
    isDestroyed = true;
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    subscription.unsubscribe();
  }

  return {
    destroy,
    saveNow,
    pause,
    resume,
  };
}
```

## Creating the useAutoSave Hook

Create a React hook for easy integration:

```bash
touch src/hooks/useAutoSave.ts
```

### Implementation

```typescript title="src/hooks/useAutoSave.ts"
import { useEffect, useState, useRef } from 'react';
import type { FormNode } from 'reformer';
import { createAutoSave } from '@/services/auto-save.service';
import type { AutoSaveOptions } from '@/services/auto-save.service';

/**
 * Save status states
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Hook return type
 */
export interface UseAutoSaveReturn {
  /** Current save status */
  status: SaveStatus;
  /** Error if save failed */
  error: Error | null;
  /** Force save now */
  saveNow: () => Promise<void>;
  /** Pause auto-saving */
  pause: () => void;
  /** Resume auto-saving */
  resume: () => void;
}

/**
 * Hook for auto-saving form data
 */
export function useAutoSave(
  form: FormNode,
  options: AutoSaveOptions
): UseAutoSaveReturn {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof createAutoSave> | null>(null);

  useEffect(() => {
    // Create auto-save instance
    const autoSave = createAutoSave(form, {
      ...options,
      saveFn: async (data) => {
        setStatus('saving');
        setError(null);

        try {
          await options.saveFn(data);
          setStatus('saved');

          // Reset to idle after 2 seconds
          setTimeout(() => {
            setStatus('idle');
          }, 2000);
        } catch (err) {
          console.error('Auto-save error:', err);
          setStatus('error');
          setError(err as Error);
          throw err;
        }
      },
    });

    autoSaveRef.current = autoSave;

    // Save on page unload
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only save if form has changes
      if (form.isDirty.value) {
        // Save immediately
        autoSave.saveNow();

        // Warn user
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      autoSave.destroy();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [form, options]);

  // Force save now
  const saveNow = async () => {
    if (autoSaveRef.current) {
      return autoSaveRef.current.saveNow();
    }
  };

  // Pause auto-saving
  const pause = () => {
    autoSaveRef.current?.pause();
  };

  // Resume auto-saving
  const resume = () => {
    autoSaveRef.current?.resume();
  };

  return {
    status,
    error,
    saveNow,
    pause,
    resume,
  };
}
```

## Creating Save Status Indicator

Create a UI component to show save status:

```bash
touch src/components/AutoSaveIndicator.tsx
```

### Implementation

```tsx title="src/components/AutoSaveIndicator.tsx"
import { SaveStatus } from '@/hooks/useAutoSave';

interface AutoSaveIndicatorProps {
  status: SaveStatus;
  error?: Error | null;
}

export function AutoSaveIndicator({ status, error }: AutoSaveIndicatorProps) {
  return (
    <div className="auto-save-indicator">
      {status === 'saving' && (
        <div className="flex items-center text-blue-600">
          <Spinner className="w-4 h-4 mr-2" />
          <span>Saving...</span>
        </div>
      )}

      {status === 'saved' && (
        <div className="flex items-center text-green-600">
          <CheckIcon className="w-4 h-4 mr-2" />
          <span>Saved</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center text-red-600">
          <ErrorIcon className="w-4 h-4 mr-2" />
          <span>Failed to save</span>
          {error && (
            <span className="text-sm ml-2">({error.message})</span>
          )}
        </div>
      )}

      {status === 'idle' && (
        <div className="flex items-center text-gray-400">
          <ClockIcon className="w-4 h-4 mr-2" />
          <span>Auto-save enabled</span>
        </div>
      )}
    </div>
  );
}

// Icon components (use your preferred icon library)
function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 6v6l4 2" />
    </svg>
  );
}
```

## Saving to localStorage

Create a function to save drafts to localStorage:

```typescript title="src/services/storage/draft.storage.ts"
// Add to existing file

/**
 * Save current draft
 */
export function saveCurrentDraft(data: any): void {
  saveDraftToStorage('current', {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Load current draft
 */
export function loadCurrentDraft(): any | null {
  const draft = loadDraftFromStorage('current');
  return draft?.data || null;
}

/**
 * Clear current draft
 */
export function clearCurrentDraft(): void {
  deleteDraftFromStorage('current');
}
```

## Saving to API

Create API service for saving drafts:

```typescript title="src/services/api/application.api.ts"
// Add to existing file

/**
 * Save application draft
 */
export async function saveDraft(data: any): Promise<void> {
  const response = await fetch(`${API_BASE}/draft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to save draft: ${response.statusText}`);
  }
}

/**
 * Update existing application
 */
export async function updateApplication(id: string, data: any): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to update application: ${response.statusText}`);
  }
}
```

## Integration with Form Component

Now integrate auto-save with the form:

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo } from 'react';
import { createCreditApplicationForm } from '@/schemas/create-form';
import { useDataLoader } from '@/hooks/useDataLoader';
import { useAutoSave } from '@/hooks/useAutoSave';
import { saveCurrentDraft } from '@/services/storage/draft.storage';
import { AutoSaveIndicator } from '@/components/AutoSaveIndicator';

interface CreditApplicationFormProps {
  applicationId?: string;
}

export function CreditApplicationForm({ applicationId }: CreditApplicationFormProps) {
  // Create form
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Load initial data
  const { loading, error } = useDataLoader(form, applicationId);

  // Auto-save
  const { status, error: saveError, saveNow } = useAutoSave(form, {
    debounce: 30000, // 30 seconds
    saveFn: async (data) => {
      // Save to localStorage
      saveCurrentDraft(data);

      // Optionally save to API
      if (applicationId) {
        await updateApplication(applicationId, data);
      }
    },
  });

  // Loading state
  if (loading) {
    return <LoadingSpinner />;
  }

  // Error state
  if (error) {
    return <ErrorMessage error={error} />;
  }

  return (
    <div className="form-container">
      {/* Auto-save indicator */}
      <div className="form-header">
        <h1>{applicationId ? 'Edit Application' : 'New Application'}</h1>
        <AutoSaveIndicator status={status} error={saveError} />
      </div>

      {/* Form */}
      <FormRenderer form={form} />

      {/* Manual save button (optional) */}
      <button
        onClick={saveNow}
        disabled={status === 'saving'}
        className="save-button"
      >
        {status === 'saving' ? 'Saving...' : 'Save Now'}
      </button>
    </div>
  );
}
```

## Dual Storage Strategy

Save to both localStorage (instant) and API (reliable):

```typescript title="src/hooks/useAutoSave.ts"
export function useDualAutoSave(
  form: FormNode,
  applicationId?: string
) {
  return useAutoSave(form, {
    debounce: 30000,
    saveFn: async (data) => {
      // Save to localStorage immediately (fast, offline-capable)
      try {
        saveCurrentDraft(data);
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
      }

      // Save to API (reliable, cross-device)
      try {
        if (applicationId) {
          await updateApplication(applicationId, data);
        } else {
          await saveDraft(data);
        }
      } catch (error) {
        console.error('Failed to save to API:', error);
        // Don't throw - localStorage save succeeded
      }
    },
  });
}
```

## Advanced: Pause/Resume Auto-Save

Control auto-save during specific operations:

```tsx title="src/components/CreditApplicationForm.tsx"
export function CreditApplicationForm({ applicationId }: CreditApplicationFormProps) {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const { status, pause, resume, saveNow } = useAutoSave(form, {
    debounce: 30000,
    saveFn: async (data) => saveCurrentDraft(data),
  });

  // Pause auto-save during submission
  const handleSubmit = async () => {
    // Pause auto-save
    pause();

    try {
      // Validate
      await form.validateTree();

      if (form.isValid.value) {
        // Submit
        await submitApplication(form.value.value);
        // Clear draft after successful submit
        clearCurrentDraft();
      }
    } finally {
      // Resume auto-save
      resume();
    }
  };

  return (
    <div className="form-container">
      <AutoSaveIndicator status={status} />
      <FormRenderer form={form} />
      <button onClick={handleSubmit}>Submit Application</button>
    </div>
  );
}
```

## Testing Auto-Save

Test these scenarios:

### Scenario 1: Basic Auto-Save
- [ ] Fill form fields
- [ ] Wait 30 seconds
- [ ] See "Saving..." indicator
- [ ] See "Saved" indicator
- [ ] Data saved to localStorage

### Scenario 2: Debouncing
- [ ] Type continuously in field
- [ ] Auto-save doesn't trigger while typing
- [ ] Stop typing
- [ ] Auto-save triggers after 30 seconds
- [ ] Only one save happens

### Scenario 3: Page Unload
- [ ] Fill form with data
- [ ] Try to close tab/window
- [ ] See browser warning
- [ ] Confirm close
- [ ] Reload page
- [ ] Data is restored

### Scenario 4: Save Error
- [ ] Disconnect internet
- [ ] Fill form
- [ ] Wait for auto-save
- [ ] See error indicator
- [ ] Reconnect internet
- [ ] Save succeeds

### Scenario 5: Manual Save
- [ ] Fill form
- [ ] Click "Save Now" button
- [ ] Immediate save (no debounce)
- [ ] See "Saved" indicator

### Scenario 6: Pause/Resume
- [ ] Auto-save enabled
- [ ] Pause auto-save
- [ ] Fill form
- [ ] No auto-save happens
- [ ] Resume auto-save
- [ ] Auto-save works again

## Key Takeaways

1. **Debounce** - Prevents excessive saves while user types
2. **Status Indicator** - Shows user what's happening
3. **Page Unload** - Saves before leaving page
4. **Dual Storage** - localStorage for speed, API for reliability
5. **Error Handling** - Gracefully handles save failures
6. **Pause/Resume** - Control when auto-save is active
7. **Observable Pattern** - Subscribe to form value changes

## Common Patterns

### Basic Auto-Save
```typescript
const { status } = useAutoSave(form, {
  debounce: 30000,
  saveFn: saveCurrentDraft,
});
```

### Auto-Save with API
```typescript
const { status } = useAutoSave(form, {
  debounce: 30000,
  saveFn: async (data) => {
    saveCurrentDraft(data); // localStorage
    await saveDraft(data);   // API
  },
});
```

### Manual Save Button
```typescript
const { saveNow, status } = useAutoSave(form, options);

<button onClick={saveNow} disabled={status === 'saving'}>
  Save Now
</button>
```

### Pause During Operations
```typescript
const { pause, resume } = useAutoSave(form, options);

const handleSubmit = async () => {
  pause();
  try {
    await submitForm();
  } finally {
    resume();
  }
};
```

## Best Practices

1. **Choose appropriate debounce** - 30 seconds is good default
2. **Show status to user** - Don't save silently
3. **Handle errors gracefully** - Don't block user
4. **Save on page unload** - Prevent data loss
5. **Use localStorage as backup** - Works offline
6. **Pause during submission** - Avoid conflicts
7. **Clean up subscriptions** - Prevent memory leaks

## What's Next?

In the next section, we'll add **Draft Management**:
- Create named drafts
- List all drafts
- Load specific draft
- Delete drafts
- Auto-save to current draft
- Switch between drafts

Building on auto-save, we'll let users manage multiple drafts!

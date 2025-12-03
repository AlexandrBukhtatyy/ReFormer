---
sidebar_position: 6
---

# Custom Behaviors

Create reusable behaviors to add reactive logic to your forms.

## What are Behaviors?

Behaviors are reactive side effects that run when form values change. They're useful for:

- Auto-saving form data
- Syncing fields
- Focus management
- Keyboard shortcuts
- Analytics tracking
- Custom form logic

## Simple Custom Behavior

Use `use()` to apply custom behaviors:

```typescript
behaviors: (path, { use }) => [
  // Simple behavior
  use({
    key: 'myBehavior',
    paths: [path.field1],
    run: (values) => {
      console.log('Field1 changed:', values.field1);
    },
  }),
];
```

## Behavior with Multiple Dependencies

React to changes in multiple fields:

```typescript
behaviors: (path, { use }) => [
  use({
    key: 'calculateTotal',
    paths: [path.price, path.quantity, path.tax],
    run: (values) => {
      const { price, quantity, tax } = values;
      const subtotal = price * quantity;
      const total = subtotal + (subtotal * tax) / 100;
      console.log('Total:', total);
    },
  }),
];
```

## Reusable Behavior Factory

Create behavior factories for reuse across forms:

```typescript title="behaviors/auto-save.ts"
import { Behavior } from '@reformer/core';

interface AutoSaveOptions {
  /**
   * Delay in ms before saving
   */
  debounce?: number;
  /**
   * Function to save data
   */
  onSave: (data: any) => Promise<void>;
}

export function autoSave<T>(options: AutoSaveOptions): Behavior<T> {
  const { debounce = 1000, onSave } = options;
  let timeoutId: NodeJS.Timeout;

  return {
    key: 'autoSave',
    paths: [], // Empty = listen to all fields
    run: (values, ctx) => {
      clearTimeout(timeoutId);

      timeoutId = setTimeout(async () => {
        try {
          await onSave(ctx.form.getValue());
          console.log('Auto-saved');
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }, debounce);
    },
    cleanup: () => {
      clearTimeout(timeoutId);
    },
  };
}

// Usage
import { autoSave } from './behaviors/auto-save';

behaviors: (path, { use }) => [
  use(
    autoSave({
      debounce: 2000,
      onSave: async (data) => {
        await fetch('/api/save', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      },
    })
  ),
];
```

## Behavior with Cleanup

Cleanup resources when behavior is destroyed:

```typescript title="behaviors/field-focus.ts"
import { Behavior } from '@reformer/core';

interface FocusFieldOptions {
  fieldName: string;
  delay?: number;
}

export function focusField<T>(options: FocusFieldOptions): Behavior<T> {
  const { fieldName, delay = 0 } = options;
  let timeoutId: NodeJS.Timeout;

  return {
    key: `focusField:${fieldName}`,
    paths: [],
    run: (_values, ctx) => {
      timeoutId = setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>(`[name="${fieldName}"]`);
        input?.focus();
      }, delay);
    },
    cleanup: () => {
      clearTimeout(timeoutId);
    },
  };
}

// Usage - focus first error field
behaviors: (path, { use }) => [use(focusField({ fieldName: 'email', delay: 100 }))];
```

## Conditional Behavior

Run behavior only when condition is met:

```typescript title="behaviors/conditional-sync.ts"
import { Behavior } from '@reformer/core';

interface ConditionalSyncOptions<T> {
  condition: (form: T) => boolean;
  targetPath: any;
  sourcePath: any;
}

export function conditionalSync<T>(options: ConditionalSyncOptions<T>): Behavior<T> {
  const { condition, targetPath, sourcePath } = options;

  return {
    key: 'conditionalSync',
    paths: [sourcePath],
    run: (values, ctx) => {
      const formValue = ctx.form.getValue();

      if (condition(formValue)) {
        const sourceValue = values[sourcePath.__key];
        ctx.form[targetPath.__key].setValue(sourceValue);
      }
    },
  };
}

// Usage - copy billing to shipping when checkbox is checked
behaviors: (path, { use }) => [
  use(
    conditionalSync({
      condition: (form) => form.sameAsShipping,
      targetPath: path.shippingAddress,
      sourcePath: path.billingAddress,
    })
  ),
];
```

## Practical Examples

### Auto-Complete from API

```typescript title="behaviors/auto-complete.ts"
import { Behavior } from '@reformer/core';

interface AutoCompleteOptions {
  searchPath: any;
  resultPath: any;
  fetchResults: (query: string) => Promise<any[]>;
  minLength?: number;
  debounce?: number;
}

export function autoComplete<T>(options: AutoCompleteOptions): Behavior<T> {
  const { searchPath, resultPath, fetchResults, minLength = 2, debounce = 300 } = options;

  let timeoutId: NodeJS.Timeout;

  return {
    key: 'autoComplete',
    paths: [searchPath],
    run: (values, ctx) => {
      clearTimeout(timeoutId);

      const query = values[searchPath.__key];

      if (!query || query.length < minLength) {
        ctx.form[resultPath.__key].setValue([]);
        return;
      }

      timeoutId = setTimeout(async () => {
        try {
          const results = await fetchResults(query);
          ctx.form[resultPath.__key].setValue(results);
        } catch (error) {
          console.error('Auto-complete failed:', error);
        }
      }, debounce);
    },
    cleanup: () => {
      clearTimeout(timeoutId);
    },
  };
}

// Usage
behaviors: (path, { use }) => [
  use(
    autoComplete({
      searchPath: path.citySearch,
      resultPath: path.citySuggestions,
      fetchResults: async (query) => {
        const response = await fetch(`/api/cities?q=${encodeURIComponent(query)}`);
        return response.json();
      },
      minLength: 3,
      debounce: 500,
    })
  ),
];
```

### Keyboard Shortcuts

```typescript title="behaviors/keyboard-shortcuts.ts"
import { Behavior } from '@reformer/core';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: (ctx: any) => void;
}

export function keyboardShortcuts<T>(shortcuts: KeyboardShortcut[]): Behavior<T> {
  const handleKeyDown = (event: KeyboardEvent, ctx: any) => {
    for (const shortcut of shortcuts) {
      if (
        event.key === shortcut.key &&
        event.ctrlKey === !!shortcut.ctrl &&
        event.shiftKey === !!shortcut.shift &&
        event.altKey === !!shortcut.alt
      ) {
        event.preventDefault();
        shortcut.action(ctx);
        return;
      }
    }
  };

  return {
    key: 'keyboardShortcuts',
    paths: [],
    run: (_values, ctx) => {
      const listener = (e: KeyboardEvent) => handleKeyDown(e, ctx);
      document.addEventListener('keydown', listener);

      return () => {
        document.removeEventListener('keydown', listener);
      };
    },
  };
}

// Usage
behaviors: (path, { use }) => [
  use(
    keyboardShortcuts([
      {
        key: 's',
        ctrl: true,
        action: (ctx) => {
          ctx.form.markAsTouched();
          if (ctx.form.valid.value) {
            console.log('Saving...', ctx.form.getValue());
          }
        },
      },
      {
        key: 'Escape',
        action: (ctx) => {
          ctx.form.reset();
        },
      },
    ])
  ),
];
```

### Analytics Tracking

```typescript title="behaviors/analytics.ts"
import { Behavior } from '@reformer/core';

interface AnalyticsOptions {
  trackChanges?: boolean;
  trackErrors?: boolean;
  trackSubmit?: boolean;
}

export function analytics<T>(options: AnalyticsOptions = {}): Behavior<T> {
  const { trackChanges = true, trackErrors = true } = options;

  return {
    key: 'analytics',
    paths: [], // Listen to all fields
    run: (values, ctx) => {
      if (trackChanges) {
        // Track field changes
        Object.keys(values).forEach((key) => {
          const field = ctx.form[key];
          if (field?.touched?.value) {
            window.analytics?.track('Form Field Changed', {
              form: ctx.form.constructor.name,
              field: key,
              hasError: !!field.errors?.value,
            });
          }
        });
      }

      if (trackErrors) {
        // Track validation errors
        Object.keys(values).forEach((key) => {
          const field = ctx.form[key];
          if (field?.errors?.value) {
            window.analytics?.track('Form Validation Error', {
              form: ctx.form.constructor.name,
              field: key,
              errors: Object.keys(field.errors.value),
            });
          }
        });
      }
    },
  };
}

// Usage
behaviors: (path, { use }) => [
  use(
    analytics({
      trackChanges: true,
      trackErrors: true,
    })
  ),
];
```

### Local Storage Sync

```typescript title="behaviors/local-storage-sync.ts"
import { Behavior } from '@reformer/core';

interface LocalStorageSyncOptions {
  key: string;
  debounce?: number;
}

export function localStorageSync<T>(options: LocalStorageSyncOptions): Behavior<T> {
  const { key, debounce = 500 } = options;
  let timeoutId: NodeJS.Timeout;

  return {
    key: 'localStorageSync',
    paths: [], // Listen to all fields
    run: (values, ctx) => {
      clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        try {
          const data = ctx.form.getValue();
          localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
          console.error('Failed to save to localStorage:', error);
        }
      }, debounce);
    },
    cleanup: () => {
      clearTimeout(timeoutId);
    },
  };
}

// Load from storage
export function loadFromLocalStorage<T>(key: string): T | null {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    return null;
  }
}

// Usage
const savedData = loadFromLocalStorage('myForm');

const form = new GroupNode({
  form: {
    name: { value: savedData?.name || '' },
    email: { value: savedData?.email || '' },
  },
  behaviors: (path, { use }) => [use(localStorageSync({ key: 'myForm', debounce: 1000 }))],
});
```

### Field Visibility Watcher

```typescript title="behaviors/visibility-watcher.ts"
import { Behavior } from '@reformer/core';

interface VisibilityWatcherOptions {
  onVisibilityChange: (fieldName: string, visible: boolean) => void;
}

export function visibilityWatcher<T>(options: VisibilityWatcherOptions): Behavior<T> {
  const { onVisibilityChange } = options;
  const previousState = new Map<string, boolean>();

  return {
    key: 'visibilityWatcher',
    paths: [], // Listen to all fields
    run: (_values, ctx) => {
      Object.keys(ctx.form).forEach((key) => {
        const field = ctx.form[key];
        const currentlyVisible = field?.visible?.value ?? true;
        const wasVisible = previousState.get(key);

        if (wasVisible !== currentlyVisible) {
          previousState.set(key, currentlyVisible);
          onVisibilityChange(key, currentlyVisible);
        }
      });
    },
  };
}

// Usage
behaviors: (path, { use }) => [
  use(
    visibilityWatcher({
      onVisibilityChange: (fieldName, visible) => {
        console.log(`Field ${fieldName} is now ${visible ? 'visible' : 'hidden'}`);
      },
    })
  ),
];
```

## Combining Multiple Behaviors

```typescript
import { autoSave } from './behaviors/auto-save';
import { analytics } from './behaviors/analytics';
import { keyboardShortcuts } from './behaviors/keyboard-shortcuts';

const form = new GroupNode({
  form: {
    name: { value: '' },
    email: { value: '' },
  },
  behaviors: (path, { use }) => [
    // Auto-save every 2 seconds
    use(
      autoSave({
        debounce: 2000,
        onSave: async (data) => {
          await fetch('/api/save', {
            method: 'POST',
            body: JSON.stringify(data),
          });
        },
      })
    ),

    // Track form interactions
    use(
      analytics({
        trackChanges: true,
        trackErrors: true,
      })
    ),

    // Add keyboard shortcuts
    use(
      keyboardShortcuts([
        {
          key: 's',
          ctrl: true,
          action: (ctx) => console.log('Saving...'),
        },
      ])
    ),
  ],
});
```

## Tips for Custom Behaviors

### 1. Always Provide a Unique Key

```typescript
// ✅ Good - unique key
use({
  key: 'myBehavior',
  paths: [path.field],
  run: () => {},
});

// ❌ Bad - missing key
use({
  paths: [path.field],
  run: () => {},
});
```

### 2. Clean Up Resources

```typescript
// ✅ Good - cleans up timer
use({
  key: 'myBehavior',
  paths: [path.field],
  run: () => {
    const timerId = setTimeout(() => {}, 1000);
  },
  cleanup: () => {
    clearTimeout(timerId);
  },
});
```

### 3. Specify Dependencies

```typescript
// ✅ Good - only reacts to specific fields
paths: [path.field1, path.field2];

// ❌ Bad - reacts to all changes (unless intended)
paths: [];
```

### 4. Handle Errors

```typescript
use({
  key: 'myBehavior',
  paths: [path.field],
  run: async (values, ctx) => {
    try {
      await someAsyncOperation(values);
    } catch (error) {
      console.error('Behavior failed:', error);
      // Don't throw - behaviors shouldn't break the form
    }
  },
});
```

## Next Steps

- [Computed Fields](/docs/behaviors/computed) — Built-in computed behavior
- [Conditional Logic](/docs/behaviors/conditional) — Built-in conditional behaviors
- [Schema Composition](/docs/core-concepts/schemas/composition) — Compose complex forms

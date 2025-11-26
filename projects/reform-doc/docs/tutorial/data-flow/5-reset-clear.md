---
sidebar_position: 5
---

# Reset & Clear

Resetting form to initial state and clearing all data.

## What We're Building

Form reset capabilities:

- **Reset to initial** - Restore original values
- **Clear all data** - Empty the entire form
- **Reset step** - Clear specific section
- **Reset field** - Clear individual field
- **Confirmation dialogs** - Prevent accidental resets
- **Mark pristine** - Reset dirty state
- **Clear errors** - Remove validation errors

## Reset vs Clear

Understanding the difference:

| Operation | Description | Use Case |
|-----------|-------------|----------|
| **Reset** | Restore initial values | "Undo my changes" |
| **Clear** | Empty all fields | "Start completely fresh" |
| **Reset Step** | Clear one section | "Re-do this step" |
| **Reset Field** | Clear one field | "Remove this value" |

Example:

```typescript
// Initial values: { name: "John", age: 30 }
// User changes to: { name: "Jane", age: 25 }

form.reset();       // Back to { name: "John", age: 30 }
form.clear();       // Empty { name: "", age: null }
```

## Why Reset/Clear?

Users need to:
- **Fix mistakes** - Undo unwanted changes
- **Start over** - Begin with clean slate
- **Compare scenarios** - Reset and try different values
- **Clear sensitive data** - Remove confidential info
- **Abandon draft** - Discard current work

## Creating the Reset Hook

Create a hook for reset operations:

```bash
touch src/hooks/useFormReset.ts
```

### Implementation

```typescript title="src/hooks/useFormReset.ts"
import { useState, useCallback, useRef } from 'react';
import type { FormNode } from 'reformer';

/**
 * Reset options
 */
export interface ResetOptions {
  /** Mark form as pristine after reset */
  markPristine?: boolean;
  /** Clear validation errors after reset */
  clearErrors?: boolean;
  /** Confirm before reset */
  confirm?: boolean;
  /** Confirmation message */
  confirmMessage?: string;
}

/**
 * Hook return type
 */
export interface UseFormResetReturn {
  /** Reset to initial values */
  reset: (options?: ResetOptions) => Promise<boolean>;
  /** Clear all data (empty form) */
  clear: (options?: ResetOptions) => Promise<boolean>;
  /** Reset specific step/group */
  resetStep: (stepName: string, options?: ResetOptions) => Promise<boolean>;
  /** Reset specific field */
  resetField: (fieldPath: string, options?: ResetOptions) => void;
  /** Get initial values */
  getInitialValues: () => any;
  /** Check if form has changes */
  hasChanges: () => boolean;
}

/**
 * Hook for form reset operations
 */
export function useFormReset(form: FormNode): UseFormResetReturn {
  // Store initial values on mount
  const initialValuesRef = useRef(form.value.value);

  // Reset to initial values
  const reset = useCallback(async (options: ResetOptions = {}): Promise<boolean> => {
    const {
      confirm = true,
      confirmMessage = 'Reset form to initial values? Any unsaved changes will be lost.',
      markPristine = true,
      clearErrors = true,
    } = options;

    // Confirm if needed
    if (confirm && form.isDirty.value) {
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) {
        return false;
      }
    }

    // Reset to initial values
    form.patchValue(initialValuesRef.current);

    // Mark as pristine
    if (markPristine) {
      form.markAsPristine();
    }

    // Clear errors
    if (clearErrors) {
      form.clearErrors();
    }

    return true;
  }, [form]);

  // Clear all data
  const clear = useCallback(async (options: ResetOptions = {}): Promise<boolean> => {
    const {
      confirm = true,
      confirmMessage = 'Clear all form data? This cannot be undone.',
      markPristine = true,
      clearErrors = true,
    } = options;

    // Confirm if needed
    if (confirm && form.isDirty.value) {
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) {
        return false;
      }
    }

    // Clear form (reset to default empty values)
    form.reset();

    // Mark as pristine
    if (markPristine) {
      form.markAsPristine();
    }

    // Clear errors
    if (clearErrors) {
      form.clearErrors();
    }

    return true;
  }, [form]);

  // Reset specific step
  const resetStep = useCallback(async (
    stepName: string,
    options: ResetOptions = {}
  ): Promise<boolean> => {
    const {
      confirm = true,
      confirmMessage = `Reset ${stepName} to initial values?`,
      markPristine = false,
      clearErrors = true,
    } = options;

    // Get step node
    const step = form.group(stepName);
    if (!step) {
      console.error(`Step not found: ${stepName}`);
      return false;
    }

    // Confirm if needed
    if (confirm && step.isDirty.value) {
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) {
        return false;
      }
    }

    // Reset step to initial values
    const initialStepValues = initialValuesRef.current[stepName];
    if (initialStepValues) {
      step.patchValue(initialStepValues);
    } else {
      step.reset();
    }

    // Mark as pristine
    if (markPristine) {
      step.markAsPristine();
    }

    // Clear errors
    if (clearErrors) {
      step.clearErrors();
    }

    return true;
  }, [form]);

  // Reset specific field
  const resetField = useCallback((
    fieldPath: string,
    options: ResetOptions = {}
  ) => {
    const { markPristine = false, clearErrors = true } = options;

    // Get field node
    const field = form.field(fieldPath);
    if (!field) {
      console.error(`Field not found: ${fieldPath}`);
      return;
    }

    // Get initial value for this field
    const pathParts = fieldPath.split('.');
    let initialValue = initialValuesRef.current;
    for (const part of pathParts) {
      initialValue = initialValue?.[part];
    }

    // Reset field
    if (initialValue !== undefined) {
      field.setValue(initialValue);
    } else {
      field.reset();
    }

    // Mark as pristine
    if (markPristine) {
      field.markAsPristine();
    }

    // Clear errors
    if (clearErrors) {
      field.clearErrors();
    }
  }, [form]);

  // Get initial values
  const getInitialValues = useCallback(() => {
    return initialValuesRef.current;
  }, []);

  // Check if form has changes
  const hasChanges = useCallback(() => {
    return form.isDirty.value;
  }, [form]);

  return {
    reset,
    clear,
    resetStep,
    resetField,
    getInitialValues,
    hasChanges,
  };
}
```

## Creating Confirmation Dialogs

Create reusable confirmation dialog components:

```tsx title="src/components/ConfirmDialog.tsx"
import { useState } from 'react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="dialog-overlay">
      <div className="dialog confirm-dialog">
        {/* Icon based on variant */}
        <div className={`dialog-icon ${variant}`}>
          {variant === 'danger' && <WarningIcon className="w-12 h-12" />}
          {variant === 'warning' && <AlertIcon className="w-12 h-12" />}
          {variant === 'info' && <InfoIcon className="w-12 h-12" />}
        </div>

        {/* Content */}
        <h2>{title}</h2>
        <p>{message}</p>

        {/* Actions */}
        <div className="dialog-actions">
          <button
            onClick={onCancel}
            className="button-secondary"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`button-${variant === 'danger' ? 'danger' : 'primary'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook for programmatic confirmation
export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    confirmText: string;
    cancelText: string;
    resolve: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'warning',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    resolve: null,
  });

  const confirm = (
    title: string,
    message: string,
    options: {
      variant?: 'danger' | 'warning' | 'info';
      confirmText?: string;
      cancelText?: string;
    } = {}
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        title,
        message,
        variant: options.variant || 'warning',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        resolve,
      });
    });
  };

  const handleConfirm = () => {
    dialogState.resolve?.(true);
    setDialogState({ ...dialogState, isOpen: false, resolve: null });
  };

  const handleCancel = () => {
    dialogState.resolve?.(false);
    setDialogState({ ...dialogState, isOpen: false, resolve: null });
  };

  const dialog = dialogState.isOpen ? (
    <ConfirmDialog
      title={dialogState.title}
      message={dialogState.message}
      variant={dialogState.variant}
      confirmText={dialogState.confirmText}
      cancelText={dialogState.cancelText}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { confirm, dialog };
}

// Icon components
function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 16v-4m0-4h.01" />
    </svg>
  );
}
```

## Creating Reset Control Buttons

Create a component with reset controls:

```tsx title="src/components/ResetControls.tsx"
import { useFormReset } from '@/hooks/useFormReset';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import type { FormNode } from 'reformer';

interface ResetControlsProps {
  form: FormNode;
  onReset?: () => void;
  onClear?: () => void;
}

export function ResetControls({ form, onReset, onClear }: ResetControlsProps) {
  const { reset, clear, hasChanges } = useFormReset(form);
  const { confirm, dialog } = useConfirmDialog();

  const handleReset = async () => {
    const confirmed = await confirm(
      'Reset Form',
      'Reset all fields to their initial values? Any unsaved changes will be lost.',
      { variant: 'warning', confirmText: 'Reset' }
    );

    if (confirmed) {
      const success = await reset({ confirm: false });
      if (success) {
        onReset?.();
      }
    }
  };

  const handleClear = async () => {
    const confirmed = await confirm(
      'Clear Form',
      'Clear all form data? This will remove all values and cannot be undone.',
      { variant: 'danger', confirmText: 'Clear All' }
    );

    if (confirmed) {
      const success = await clear({ confirm: false });
      if (success) {
        onClear?.();
      }
    }
  };

  const hasAnyChanges = hasChanges();

  return (
    <>
      <div className="reset-controls">
        <button
          onClick={handleReset}
          disabled={!hasAnyChanges}
          className="button-secondary"
          title="Reset to initial values"
        >
          <ResetIcon className="w-4 h-4" />
          <span>Reset</span>
        </button>

        <button
          onClick={handleClear}
          className="button-secondary"
          title="Clear all data"
        >
          <ClearIcon className="w-4 h-4" />
          <span>Clear All</span>
        </button>
      </div>

      {dialog}
    </>
  );
}

function ResetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function ClearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}
```

## Step-Level Reset

Add reset button to each step:

```tsx title="src/components/StepHeader.tsx"
import { useFormReset } from '@/hooks/useFormReset';
import type { FormNode } from 'reformer';

interface StepHeaderProps {
  stepName: string;
  title: string;
  form: FormNode;
}

export function StepHeader({ stepName, title, form }: StepHeaderProps) {
  const { resetStep } = useFormReset(form);

  const handleResetStep = async () => {
    await resetStep(stepName, {
      confirmMessage: `Reset "${title}" step? All changes in this step will be lost.`,
    });
  };

  return (
    <div className="step-header">
      <h2>{title}</h2>
      <button
        onClick={handleResetStep}
        className="reset-step-button"
        title="Reset this step"
      >
        <ResetIcon className="w-4 h-4" />
        <span>Reset Step</span>
      </button>
    </div>
  );
}
```

## Field-Level Reset

Add reset button to individual fields:

```tsx title="src/components/FormField.tsx"
import { useFormReset } from '@/hooks/useFormReset';
import type { FormNode } from 'reformer';

interface FormFieldProps {
  form: FormNode;
  fieldPath: string;
  label: string;
  children: React.ReactNode;
}

export function FormField({ form, fieldPath, label, children }: FormFieldProps) {
  const { resetField } = useFormReset(form);
  const field = form.field(fieldPath);
  const isDirty = field?.isDirty.value;

  const handleResetField = () => {
    resetField(fieldPath, { clearErrors: true });
  };

  return (
    <div className="form-field">
      <div className="field-header">
        <label>{label}</label>
        {isDirty && (
          <button
            onClick={handleResetField}
            className="reset-field-button"
            title="Reset this field"
          >
            <UndoIcon className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="field-input">
        {children}
      </div>
    </div>
  );
}

function UndoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
  );
}
```

## Integration with Form Component

Full integration example:

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo } from 'react';
import { createCreditApplicationForm } from '@/schemas/create-form';
import { useDataLoader } from '@/hooks/useDataLoader';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useDraftManager } from '@/hooks/useDraftManager';
import { useFormReset } from '@/hooks/useFormReset';
import { AutoSaveIndicator } from '@/components/AutoSaveIndicator';
import { DraftSelector } from '@/components/DraftSelector';
import { ResetControls } from '@/components/ResetControls';

export function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Data loading
  const { loading, error } = useDataLoader(form);

  // Auto-save
  const { status } = useAutoSave(form, {
    debounce: 30000,
    saveFn: async (data) => saveCurrentDraft(data),
  });

  // Draft management
  const draftManager = useDraftManager(form);

  // Reset functionality
  const { reset, clear } = useFormReset(form);

  const handleReset = () => {
    // Optional: Pause auto-save during reset
    reset();
  };

  const handleClear = () => {
    // Clear current draft too
    clear();
    draftManager.clearCurrent();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="form-container">
      {/* Header */}
      <div className="form-header">
        <h1>Credit Application</h1>
        <div className="form-controls">
          <AutoSaveIndicator status={status} />
          <DraftSelector {...draftManager} />
          <ResetControls
            form={form}
            onReset={handleReset}
            onClear={handleClear}
          />
        </div>
      </div>

      {/* Form */}
      <FormRenderer form={form} />
    </div>
  );
}
```

## Testing Reset & Clear

Test these scenarios:

### Scenario 1: Reset to Initial
- [ ] Fill form with data
- [ ] Click "Reset"
- [ ] Confirm dialog appears
- [ ] Confirm reset
- [ ] Form restores to initial values
- [ ] Dirty state is cleared

### Scenario 2: Clear All
- [ ] Fill form with data
- [ ] Click "Clear All"
- [ ] Confirm dialog appears
- [ ] Confirm clear
- [ ] All fields are empty
- [ ] Dirty state is cleared

### Scenario 3: Cancel Reset
- [ ] Fill form with data
- [ ] Click "Reset"
- [ ] Confirm dialog appears
- [ ] Click "Cancel"
- [ ] Form data unchanged
- [ ] Can continue editing

### Scenario 4: Reset Step
- [ ] Fill multiple steps
- [ ] Click "Reset Step" on one step
- [ ] Confirm reset
- [ ] Only that step is reset
- [ ] Other steps unchanged

### Scenario 5: Reset Field
- [ ] Modify a field
- [ ] See undo icon appear
- [ ] Click undo icon
- [ ] Field resets to initial value
- [ ] Other fields unchanged

### Scenario 6: Reset After Load
- [ ] Load application data
- [ ] Modify some fields
- [ ] Click "Reset"
- [ ] Form returns to loaded data (not empty)

## Key Takeaways

1. **Reset** - Returns to initial values
2. **Clear** - Empties all fields
3. **Confirmation** - Prevent accidental data loss
4. **Granular Control** - Reset form, step, or field
5. **State Management** - Clear dirty and error states
6. **Initial Values** - Capture on mount, not on reset

## Common Patterns

### Basic Reset
```typescript
const { reset } = useFormReset(form);
await reset();
```

### Clear Without Confirm
```typescript
const { clear } = useFormReset(form);
await clear({ confirm: false });
```

### Reset Step
```typescript
const { resetStep } = useFormReset(form);
await resetStep('personalData');
```

### Reset Field
```typescript
const { resetField } = useFormReset(form);
resetField('personalData.firstName');
```

### Custom Confirmation
```typescript
const confirmed = await myCustomConfirm('Reset form?');
if (confirmed) {
  await reset({ confirm: false });
}
```

## What's Next?

In the next section, we'll add **Data Prefill**:
- Load user profile data
- Auto-fill personal information
- Auto-fill contact details
- Smart merge strategy
- Selective field prefill
- Manual prefill trigger

We'll make form filling faster by pre-filling from user's profile!

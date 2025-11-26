---
sidebar_position: 2
---

# Form Reset

Resetting forms to their initial state or clearing all values.

## Overview

Forms need to be reset in various scenarios:

- **After successful submission** - Clear form for next entry
- **Cancel edit mode** - Revert to original values
- **Clear all data** - Start fresh
- **Reset errors** - Clear validation state

## Basic Reset

### reset() - Reset to Initial Values

The `reset()` method restores the form to its initial state:

```typescript title="src/components/CreditApplicationForm.tsx"
import { createCreditApplicationForm } from '../schemas/create-form';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const handleCancel = () => {
    // Reset to initial values defined in schema
    form.reset();
  };

  const handleSubmit = async () => {
    const result = await submitApplication(form.value.value);

    if (result.success) {
      // Reset form after successful submission
      form.reset();
      showSuccessMessage('Application submitted!');
    }
  };

  return (
    <form>
      {/* Form fields */}
      <button type="button" onClick={handleCancel}>
        Cancel
      </button>
      <button type="submit" onClick={handleSubmit}>
        Submit
      </button>
    </form>
  );
}
```

### What reset() Does

```typescript
form.reset();

// Restores:
// ✅ Values to initial state
// ✅ Touched state to false
// ✅ Dirty state to false
// ✅ Clears validation errors
// ✅ Resets pristine state
```

## Reset with New Values

Reset and set new initial values at the same time:

```typescript
// Reset to specific values
form.reset({
  loanType: 'consumer',
  loanAmount: 100000,
  loanTerm: 12,
});

// Form now uses these as initial values
```

### Use Case: Edit Mode Cancel

```typescript
function EditCreditApplication({ initialData }: Props) {
  const form = useMemo(() => createCreditApplicationForm(), []);

  useEffect(() => {
    // Set initial values from loaded data
    form.setValue(initialData);
  }, [form, initialData]);

  const handleCancel = () => {
    // Reset to loaded initial values (discard changes)
    form.reset(initialData);
    navigateBack();
  };

  const handleSave = async () => {
    await submitChanges(form.value.value);
    form.reset(form.value.value); // Mark current state as clean
  };

  return (
    // ... form UI
  );
}
```

## Clearing Form Data

### Clear All Fields

Set all fields to empty/default values:

```typescript
import type { CreditApplicationForm } from '../types';

function ClearAllButton({ form }: Props) {
  const handleClear = () => {
    const emptyValues: Partial<CreditApplicationForm> = {
      loanType: undefined,
      loanAmount: 0,
      loanTerm: 0,
      firstName: '',
      lastName: '',
      middleName: '',
      email: '',
      phoneMain: '',
      // ... all fields to empty
    };

    form.setValue(emptyValues);
  };

  return (
    <button type="button" onClick={handleClear}>
      Clear All Fields
    </button>
  );
}
```

### Clear Specific Section

```typescript
function PersonalInfoSection({ form }: Props) {
  const handleClearPersonalInfo = () => {
    form.patchValue({
      firstName: '',
      lastName: '',
      middleName: '',
      birthDate: '',
      birthPlace: '',
    });
  };

  return (
    <section>
      <h2>Personal Information</h2>
      {/* Fields */}
      <button type="button" onClick={handleClearPersonalInfo}>
        Clear Section
      </button>
    </section>
  );
}
```

## Reset Options

### Reset Without Validation

```typescript
// Reset without triggering validation
form.reset(undefined, { validate: false });
```

### Reset Without Emitting Events

```typescript
// Silent reset
form.reset(undefined, { emitEvent: false });
```

## Resetting Field States

### Mark as Untouched

Reset the touched state without changing values:

```typescript
// Reset touched state for entire form
form.markAsUntouched();

// User can now see validation only after they interact again
```

### Mark as Pristine

Reset dirty/pristine state:

```typescript
// Mark form as pristine (no changes)
form.markAsPristine();

// Useful after saving: "current state is now clean"
```

## Clearing Errors

### Clear All Validation Errors

```typescript
// Clear all errors
form.clearErrors();

// Form shows no validation errors
// But validation rules still apply on next change/validation
```

### Clear Specific Field Errors

```typescript
// Clear errors for a specific field
form.field('loanAmount').clearErrors();
```

## Multi-Step Form Reset

### Reset Current Step

```typescript
function MultiStepForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [currentStep, setCurrentStep] = useState(1);

  const handleResetStep = () => {
    if (currentStep === 1) {
      // Reset loan details
      form.patchValue({
        loanType: 'consumer',
        loanAmount: 0,
        loanTerm: 0,
        loanPurpose: '',
      });
    } else if (currentStep === 2) {
      // Reset personal info
      form.patchValue({
        firstName: '',
        lastName: '',
        middleName: '',
        birthDate: '',
      });
    }
    // ... other steps
  };

  return (
    <div>
      <StepContent step={currentStep} form={form} />
      <button type="button" onClick={handleResetStep}>
        Reset This Step
      </button>
    </div>
  );
}
```

### Reset and Go to First Step

```typescript
const handleResetAll = () => {
  form.reset();
  setCurrentStep(1);
  showMessage('Form reset to beginning');
};
```

## Conditional Reset

### Reset on Route Change

```typescript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const location = useLocation();

  useEffect(() => {
    // Reset form when navigating away and back
    return () => {
      if (form.dirty.value) {
        const shouldReset = confirm('You have unsaved changes. Discard them?');
        if (shouldReset) {
          form.reset();
        }
      }
    };
  }, [location, form]);

  return (
    // ... form UI
  );
}
```

### Reset After Timeout

```typescript
function useAutoReset(form: FormNode<CreditApplicationForm>, timeoutMs: number) {
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const subscription = form.value.subscribe(() => {
      // Clear previous timeout
      clearTimeout(timeoutId);

      // Set new timeout
      timeoutId = setTimeout(() => {
        if (form.dirty.value && !form.touched.value) {
          console.log('Auto-resetting form after inactivity');
          form.reset();
        }
      }, timeoutMs);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [form, timeoutMs]);
}

// Usage
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Auto-reset after 10 minutes of inactivity
  useAutoReset(form, 10 * 60 * 1000);

  return (
    // ... form UI
  );
}
```

## Resetting Arrays

### Clear Array Items

```typescript
// Clear co-borrowers array
form.patchValue({
  coBorrowers: [],
});

// Or reset to initial state
form.field('coBorrowers').reset();
```

### Reset Array to Default Items

```typescript
const defaultCoBorrowers = [
  {
    firstName: '',
    lastName: '',
    email: '',
    monthlyIncome: 0,
  },
];

form.patchValue({
  coBorrowers: defaultCoBorrowers,
});
```

## Best Practices

### 1. Confirm Before Discarding Changes

```typescript
// ✅ Ask user before resetting dirty form
const handleCancel = () => {
  if (form.dirty.value) {
    if (confirm('Discard unsaved changes?')) {
      form.reset();
      navigateBack();
    }
  } else {
    navigateBack();
  }
};

// ❌ Don't silently discard changes
const handleCancel = () => {
  form.reset(); // User might lose work
  navigateBack();
};
```

### 2. Reset After Successful Submit

```typescript
// ✅ Reset after success
const handleSubmit = async () => {
  const result = await submitApplication(form.value.value);

  if (result.success) {
    form.reset();
    showSuccessMessage();
  } else {
    showError(result.error);
    // Don't reset - keep user's data
  }
};

// ❌ Don't reset before submit
const handleSubmit = async () => {
  const data = form.value.value;
  form.reset(); // Wrong timing!
  await submitApplication(data);
};
```

### 3. Use reset() for Initial Values

```typescript
// ✅ Reset to schema defaults
form.reset();

// ✅ Reset to specific values
form.reset(loadedData);

// ❌ Don't manually set each field
form.setValue({
  loanType: 'consumer',
  loanAmount: 0,
  // ... tedious and error-prone
});
```

### 4. Clear Errors Separately When Needed

```typescript
// ✅ Clear errors without resetting values
form.clearErrors();

// ❌ Don't reset just to clear errors
form.reset(); // This also clears all values!
```

## Common Patterns

### Draft Save and Reset

```typescript
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const handleSaveDraft = async () => {
    const draft = form.value.value;
    await saveDraft(draft);

    // Mark current state as saved (clean)
    form.markAsPristine();

    showMessage('Draft saved');
  };

  const handleDiscard = () => {
    if (confirm('Discard this draft?')) {
      form.reset();
      localStorage.removeItem('credit-application-draft');
    }
  };

  return (
    <>
      <FormContent form={form} />
      <button type="button" onClick={handleSaveDraft}>
        Save Draft
      </button>
      <button type="button" onClick={handleDiscard}>
        Discard Draft
      </button>
    </>
  );
}
```

### Reset with Confirmation Dialog

```typescript
function ResetButton({ form }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleReset = () => {
    if (form.dirty.value) {
      setShowConfirm(true);
    } else {
      form.reset();
    }
  };

  const confirmReset = () => {
    form.reset();
    setShowConfirm(false);
    showMessage('Form reset');
  };

  return (
    <>
      <button type="button" onClick={handleReset}>
        Reset Form
      </button>

      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmReset}
        title="Reset Form?"
        message="All unsaved changes will be lost."
      />
    </>
  );
}
```

### Reset Individual Fields

```typescript
function LoanDetailsSection({ form }: Props) {
  const resetLoanAmount = () => {
    // Reset single field to schema default
    form.field('loanAmount').reset();
  };

  const resetAllLoanFields = () => {
    // Reset multiple related fields
    form.field('loanAmount').reset();
    form.field('loanTerm').reset();
    form.field('loanType').reset();
    form.field('loanPurpose').reset();
  };

  return (
    <section>
      <FormField control={form.control.loanAmount} />
      <button type="button" onClick={resetLoanAmount}>
        Reset Amount
      </button>
      <button type="button" onClick={resetAllLoanFields}>
        Reset All Loan Fields
      </button>
    </section>
  );
}
```

## Tracking Reset State

### Show Reset Indicator

```typescript
function FormHeader({ form }: Props) {
  const { value: dirty } = useFormControl(form.dirty);

  return (
    <div className="form-header">
      <h2>Credit Application</h2>
      {dirty && (
        <span className="badge badge-warning">Unsaved Changes</span>
      )}
    </div>
  );
}
```

### Prevent Navigation with Unsaved Changes

```typescript
import { useBlocker } from 'react-router-dom';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Block navigation if form is dirty
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      form.dirty.value && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const shouldLeave = confirm('You have unsaved changes. Leave anyway?');

      if (shouldLeave) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  return (
    // ... form UI
  );
}
```

## Next Step

Now that you understand form initialization and reset, let's learn how to handle form submission and validation.

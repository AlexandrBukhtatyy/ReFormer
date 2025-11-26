---
sidebar_position: 1
---

# Pre-Submit Validation

Validating forms before submission to ensure data quality and user experience.

## Overview

Before submitting a credit application form, you need to:

- **Trigger validation** - Run all validators to check form data
- **Mark fields as touched** - Show validation errors to the user
- **Check validity** - Ensure all fields pass validation
- **Handle errors** - Display errors and guide user to fix them
- **Prevent invalid submissions** - Block submission if validation fails

## Basic Submit Flow

### Simple Submit Handler

The most common pattern for form submission:

```typescript title="src/components/CreditApplicationForm.tsx"
import { useMemo } from 'react';
import { createCreditApplicationForm } from '../schemas/create-form';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched to show validation errors
    form.markAsTouched();

    // Run validation
    await form.validate();

    // Check if form is valid
    if (form.valid.value) {
      // Form is valid - proceed with submission
      const application = form.value.value;
      await submitApplication(application);
    } else {
      // Form has errors - user will see them
      console.log('Form has validation errors');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit">Submit Application</button>
    </form>
  );
}

async function submitApplication(data: CreditApplicationForm) {
  const response = await fetch('/api/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}
```

### What Happens During Submit

```typescript
// 1. Mark all fields as touched
form.markAsTouched();
// Now all validation errors will be visible to the user

// 2. Run validation
await form.validate();
// All validators (sync and async) are executed

// 3. Check validity
if (form.valid.value) {
  // ✅ Form passed all validation rules
  // Safe to submit
} else {
  // ❌ Form has validation errors
  // Errors are visible to user
}
```

## Validation Before Submit

### Synchronous Validation

For forms with only sync validators:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  form.markAsTouched();
  form.validate(); // No await needed for sync validation

  if (form.valid.value) {
    await submitApplication(form.value.value);
  }
};
```

### Async Validation

For forms with async validators (API checks, etc.):

```typescript title="src/components/CreditApplicationForm.tsx"
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  form.markAsTouched();

  // Wait for all async validators to complete
  await form.validate();

  if (form.valid.value) {
    // All async checks passed
    await submitApplication(form.value.value);
  } else {
    // Some async validation failed
    console.log('Form validation failed');
  }
};
```

### Show Loading During Validation

```typescript title="src/components/CreditApplicationForm.tsx"
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [isValidating, setIsValidating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    form.markAsTouched();

    setIsValidating(true);
    await form.validate();
    setIsValidating(false);

    if (form.valid.value) {
      await submitApplication(form.value.value);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit" disabled={isValidating}>
        {isValidating ? 'Validating...' : 'Submit Application'}
      </button>
    </form>
  );
}
```

## Handling Validation Errors

### Display Error Summary

Show all validation errors at the top of the form:

```typescript title="src/components/ErrorSummary.tsx"
import { useFormControl } from 'reformer';
import type { FormNode } from 'reformer';

interface ErrorSummaryProps {
  form: FormNode<CreditApplicationForm>;
}

function ErrorSummary({ form }: ErrorSummaryProps) {
  const { value: errors } = useFormControl(form.errors);
  const { value: touched } = useFormControl(form.touched);

  // Only show errors if form was touched (submit was attempted)
  if (!touched || !errors || Object.keys(errors).length === 0) {
    return null;
  }

  const errorMessages = Object.entries(errors).map(([field, error]) => ({
    field,
    message: error.message || 'Invalid value',
  }));

  return (
    <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
      <h3 className="text-red-800 font-semibold mb-2">
        Please fix the following errors:
      </h3>
      <ul className="list-disc list-inside text-red-700">
        {errorMessages.map(({ field, message }) => (
          <li key={field}>
            <strong>{field}:</strong> {message}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Usage
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  return (
    <form onSubmit={handleSubmit}>
      <ErrorSummary form={form} />
      {/* Form fields */}
    </form>
  );
}
```

### Scroll to First Error

Automatically scroll to the first field with an error:

```typescript title="src/utils/scroll-to-error.ts"
import type { FormNode } from 'reformer';

export function scrollToFirstError(form: FormNode<any>) {
  const errors = form.errors.value;
  if (!errors || Object.keys(errors).length === 0) return;

  // Get first error field
  const firstErrorField = Object.keys(errors)[0];

  // Find input element by name or id
  const element = document.querySelector(
    `[name="${firstErrorField}"], #${firstErrorField}`
  );

  if (element) {
    // Scroll into view with smooth behavior
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    // Focus the field
    (element as HTMLElement).focus();
  }
}

// Usage in submit handler
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  form.markAsTouched();
  await form.validate();

  if (!form.valid.value) {
    scrollToFirstError(form);
    return;
  }

  await submitApplication(form.value.value);
};
```

### Enhanced Scroll with Field Labels

```typescript title="src/utils/scroll-to-error-with-labels.ts"
interface FieldLabels {
  [key: string]: string;
}

const fieldLabels: FieldLabels = {
  loanAmount: 'Loan Amount',
  loanTerm: 'Loan Term',
  firstName: 'First Name',
  lastName: 'Last Name',
  email: 'Email Address',
  phoneMain: 'Phone Number',
};

export function scrollToFirstErrorWithMessage(
  form: FormNode<any>,
  showToast: (message: string) => void
) {
  const errors = form.errors.value;
  if (!errors || Object.keys(errors).length === 0) return;

  const firstErrorField = Object.keys(errors)[0];
  const errorMessage = errors[firstErrorField]?.message || 'Invalid value';
  const fieldLabel = fieldLabels[firstErrorField] || firstErrorField;

  // Show toast notification
  showToast(`${fieldLabel}: ${errorMessage}`);

  // Scroll to field
  const element = document.querySelector(
    `[name="${firstErrorField}"], #${firstErrorField}`
  );

  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (element as HTMLElement).focus();
  }
}
```

## Submit Button States

### Disable Button While Invalid

```typescript title="src/components/SubmitButton.tsx"
import { useFormControl } from 'reformer';

interface SubmitButtonProps {
  form: FormNode<CreditApplicationForm>;
  isSubmitting?: boolean;
}

function SubmitButton({ form, isSubmitting = false }: SubmitButtonProps) {
  const { value: valid } = useFormControl(form.valid);
  const { value: dirty } = useFormControl(form.dirty);

  const isDisabled = !valid || !dirty || isSubmitting;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className={`px-4 py-2 rounded ${
        isDisabled
          ? 'bg-gray-300 cursor-not-allowed'
          : 'bg-blue-600 hover:bg-blue-700 text-white'
      }`}
    >
      {isSubmitting ? 'Submitting...' : 'Submit Application'}
    </button>
  );
}
```

### Dynamic Button with Validation Status

```typescript title="src/components/DynamicSubmitButton.tsx"
function DynamicSubmitButton({ form, onSubmit }: Props) {
  const { value: valid } = useFormControl(form.valid);
  const { value: touched } = useFormControl(form.touched);
  const { value: errors } = useFormControl(form.errors);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errorCount = errors ? Object.keys(errors).length : 0;

  const handleClick = async () => {
    setIsSubmitting(true);
    await onSubmit();
    setIsSubmitting(false);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!valid || isSubmitting}
      className="px-6 py-3 rounded font-semibold"
    >
      {isSubmitting ? (
        <>
          <Spinner className="mr-2" />
          Submitting...
        </>
      ) : !valid && touched ? (
        `Fix ${errorCount} error${errorCount !== 1 ? 's' : ''}`
      ) : (
        'Submit Application'
      )}
    </button>
  );
}
```

## Multi-Step Form Validation

### Validate Current Step

```typescript title="src/components/MultiStepForm.tsx"
function MultiStepForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [currentStep, setCurrentStep] = useState(1);

  const validateCurrentStep = async (): Promise<boolean> => {
    // Define which fields belong to each step
    const stepFields: Record<number, (keyof CreditApplicationForm)[]> = {
      1: ['loanType', 'loanAmount', 'loanTerm', 'loanPurpose'],
      2: ['firstName', 'lastName', 'middleName', 'birthDate', 'birthPlace'],
      3: ['email', 'phoneMain', 'phoneAdditional'],
      4: ['employmentStatus', 'monthlyIncome', 'employerName'],
    };

    const fieldsToValidate = stepFields[currentStep] || [];

    // Mark step fields as touched
    fieldsToValidate.forEach((fieldName) => {
      form.field(fieldName).markAsTouched();
    });

    // Validate entire form
    await form.validate();

    // Check if current step fields are valid
    const stepIsValid = fieldsToValidate.every((fieldName) => {
      const field = form.field(fieldName);
      const errors = field.errors.value;
      return !errors || Object.keys(errors).length === 0;
    });

    return stepIsValid;
  };

  const handleNext = async () => {
    const isValid = await validateCurrentStep();

    if (isValid) {
      setCurrentStep((prev) => prev + 1);
    } else {
      console.log('Please fix errors before proceeding');
    }
  };

  const handleSubmit = async () => {
    // Validate all steps
    form.markAsTouched();
    await form.validate();

    if (form.valid.value) {
      await submitApplication(form.value.value);
    } else {
      // Go back to first step with errors
      const firstStepWithError = findFirstStepWithError(form);
      setCurrentStep(firstStepWithError);
    }
  };

  return (
    <div>
      <StepContent step={currentStep} form={form} />

      {currentStep < 4 ? (
        <button onClick={handleNext}>Next Step</button>
      ) : (
        <button onClick={handleSubmit}>Submit Application</button>
      )}
    </div>
  );
}
```

### Find First Step with Errors

```typescript title="src/utils/find-first-step-with-error.ts"
function findFirstStepWithError(form: FormNode<CreditApplicationForm>): number {
  const errors = form.errors.value;
  if (!errors) return 1;

  const stepFields: Record<number, (keyof CreditApplicationForm)[]> = {
    1: ['loanType', 'loanAmount', 'loanTerm', 'loanPurpose'],
    2: ['firstName', 'lastName', 'middleName', 'birthDate', 'birthPlace'],
    3: ['email', 'phoneMain', 'phoneAdditional'],
    4: ['employmentStatus', 'monthlyIncome', 'employerName'],
  };

  for (const [step, fields] of Object.entries(stepFields)) {
    const hasError = fields.some((field) => errors[field]);
    if (hasError) {
      return parseInt(step);
    }
  }

  return 1;
}
```

## Prevent Duplicate Submissions

### Disable Submit During Processing

```typescript title="src/components/CreditApplicationForm.tsx"
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent duplicate submissions
    if (isSubmitting) return;

    form.markAsTouched();
    await form.validate();

    if (!form.valid.value) {
      return;
    }

    setIsSubmitting(true);

    try {
      await submitApplication(form.value.value);
      // Handle success
      form.reset();
    } catch (error) {
      // Handle error
      console.error('Submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit Application'}
      </button>
    </form>
  );
}
```

### Debounce Submit Button

```typescript title="src/hooks/useDebouncedSubmit.ts"
import { useCallback, useRef } from 'react';

export function useDebouncedSubmit(
  onSubmit: () => Promise<void>,
  delay: number = 1000
) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isProcessing = useRef(false);

  const debouncedSubmit = useCallback(async () => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Don't allow new submission if one is processing
    if (isProcessing.current) {
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      isProcessing.current = true;
      await onSubmit();
      isProcessing.current = false;
    }, delay);
  }, [onSubmit, delay]);

  return debouncedSubmit;
}

// Usage
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const submitForm = async () => {
    form.markAsTouched();
    await form.validate();

    if (form.valid.value) {
      await submitApplication(form.value.value);
    }
  };

  const handleSubmit = useDebouncedSubmit(submitForm, 500);

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      {/* Form fields */}
    </form>
  );
}
```

## Best Practices

### 1. Always Mark as Touched Before Validation

```typescript
// ✅ GOOD: Mark as touched to show errors
const handleSubmit = async () => {
  form.markAsTouched();
  await form.validate();

  if (form.valid.value) {
    await submitApplication(form.value.value);
  }
};

// ❌ BAD: User won't see validation errors
const handleSubmit = async () => {
  await form.validate();

  if (form.valid.value) {
    await submitApplication(form.value.value);
  }
  // Errors exist but not visible to user!
};
```

### 2. Wait for Async Validation

```typescript
// ✅ GOOD: Wait for async validators
const handleSubmit = async () => {
  form.markAsTouched();
  await form.validate(); // Await async validation

  if (form.valid.value) {
    await submitApplication(form.value.value);
  }
};

// ❌ BAD: Don't await - might submit invalid data
const handleSubmit = async () => {
  form.markAsTouched();
  form.validate(); // Missing await!

  if (form.valid.value) {
    // Might be true before async validators complete!
    await submitApplication(form.value.value);
  }
};
```

### 3. Prevent Duplicate Submissions

```typescript
// ✅ GOOD: Track submission state
const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async () => {
  if (isSubmitting) return;

  setIsSubmitting(true);
  await submitApplication(form.value.value);
  setIsSubmitting(false);
};

// ❌ BAD: User can submit multiple times
const handleSubmit = async () => {
  await submitApplication(form.value.value);
  // User can click submit again while processing!
};
```

### 4. Handle Submit Errors Gracefully

```typescript
// ✅ GOOD: Try-catch with proper error handling
const handleSubmit = async () => {
  form.markAsTouched();
  await form.validate();

  if (!form.valid.value) {
    scrollToFirstError(form);
    return;
  }

  try {
    await submitApplication(form.value.value);
    showSuccessMessage('Application submitted!');
    form.reset();
  } catch (error) {
    showErrorMessage('Submission failed. Please try again.');
    console.error('Submit error:', error);
  }
};

// ❌ BAD: No error handling
const handleSubmit = async () => {
  form.markAsTouched();
  await form.validate();

  if (form.valid.value) {
    await submitApplication(form.value.value);
    // What if this fails?
  }
};
```

### 5. Provide User Feedback

```typescript
// ✅ GOOD: Clear feedback at each stage
const handleSubmit = async () => {
  form.markAsTouched();

  setStatus('validating');
  await form.validate();

  if (!form.valid.value) {
    setStatus('invalid');
    scrollToFirstError(form);
    showToast('Please fix validation errors');
    return;
  }

  setStatus('submitting');
  try {
    await submitApplication(form.value.value);
    setStatus('success');
    showToast('Application submitted successfully!');
  } catch (error) {
    setStatus('error');
    showToast('Submission failed. Please try again.');
  }
};

// ❌ BAD: No feedback - user doesn't know what's happening
const handleSubmit = async () => {
  form.markAsTouched();
  await form.validate();
  if (form.valid.value) {
    await submitApplication(form.value.value);
  }
};
```

## Common Patterns

### Submit with Confirmation

```typescript
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    form.markAsTouched();
    await form.validate();

    if (form.valid.value) {
      setShowConfirmDialog(true);
    }
  };

  const confirmSubmit = async () => {
    setShowConfirmDialog(false);
    await submitApplication(form.value.value);
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        {/* Form fields */}
        <button type="submit">Submit Application</button>
      </form>

      <ConfirmDialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={confirmSubmit}
        title="Submit Application?"
        message="Please confirm you want to submit this credit application."
      />
    </>
  );
}
```

### Submit with Progress Indicator

```typescript
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [submitProgress, setSubmitProgress] = useState<
    'idle' | 'validating' | 'submitting' | 'success' | 'error'
  >('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitProgress('validating');
    form.markAsTouched();
    await form.validate();

    if (!form.valid.value) {
      setSubmitProgress('error');
      return;
    }

    setSubmitProgress('submitting');
    try {
      await submitApplication(form.value.value);
      setSubmitProgress('success');
      setTimeout(() => {
        form.reset();
        setSubmitProgress('idle');
      }, 2000);
    } catch (error) {
      setSubmitProgress('error');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}

      {submitProgress === 'validating' && (
        <div className="text-blue-600">Validating form...</div>
      )}
      {submitProgress === 'submitting' && (
        <div className="text-blue-600">Submitting application...</div>
      )}
      {submitProgress === 'success' && (
        <div className="text-green-600">Application submitted successfully!</div>
      )}
      {submitProgress === 'error' && (
        <div className="text-red-600">Please fix errors and try again</div>
      )}

      <button
        type="submit"
        disabled={submitProgress === 'validating' || submitProgress === 'submitting'}
      >
        Submit Application
      </button>
    </form>
  );
}
```

### Auto-Save Before Submit

```typescript
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Save draft before validating
    const draftData = form.value.value;
    localStorage.setItem('credit-application-draft', JSON.stringify(draftData));

    form.markAsTouched();
    await form.validate();

    if (!form.valid.value) {
      console.log('Form invalid - draft saved');
      return;
    }

    try {
      await submitApplication(form.value.value);
      // Clear draft on successful submit
      localStorage.removeItem('credit-application-draft');
      form.reset();
    } catch (error) {
      console.error('Submit failed - draft preserved');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

## Next Step

Now that you understand pre-submit validation, let's learn how to map form data for API submission and handle different data formats.

---
sidebar_position: 7
---

# Multi-Step Submission

Implementing a multi-step form workflow with step-by-step validation and review.

## Overview

Multi-step forms break complex forms into manageable sections:

- **Step Navigation** - Move between form sections
- **Step Validation** - Validate each step before proceeding
- **Progress Tracking** - Show user progress through form
- **Review Page** - Preview all data before submission
- **Edit from Review** - Jump back to edit specific sections
- **Submit on Final Step** - Submit entire form at once

## Understanding Multi-Step Flow

### The Multi-Step Workflow

```
┌─────────────────────────────────────────┐
│         Multi-Step Form Flow            │
└─────────────────────────────────────────┘

STEP 1: Loan Information
   ↓ Validate → Next
STEP 2: Personal Information
   ↓ Validate → Next
STEP 3: Contact Information
   ↓ Validate → Next
STEP 4: Employment Information
   ↓ Validate → Next
STEP 5: Additional Information
   ↓ Validate → Review
REVIEW: Preview All Data
   ↓ Submit
SERVER: Process Application
   ↓ Success
SUCCESS PAGE: Confirmation
```

### Step Structure

Our credit application has 5 steps:

```typescript
const steps = [
  {
    name: 'Loan Information',
    path: 'step1',
    fields: ['loanAmount', 'loanTerm', 'loanType', 'loanPurpose']
  },
  {
    name: 'Personal Information',
    path: 'step2',
    fields: ['personalData', 'passportData']
  },
  {
    name: 'Contact Information',
    path: 'step3',
    fields: ['email', 'phoneMain', 'addresses']
  },
  {
    name: 'Employment',
    path: 'step4',
    fields: ['employmentType', 'companyName', 'monthlyIncome']
  },
  {
    name: 'Additional Information',
    path: 'step5',
    fields: ['hasActiveLoan', 'hasBankruptcy', 'agreements']
  },
];
```

## Creating useMultiStep Hook

Build a hook to manage multi-step navigation and validation.

### Hook Implementation

```typescript title="src/hooks/useMultiStep.ts"
import { useState, useCallback } from 'react';
import type { FormNode } from 'reformer';

export interface Step {
  name: string;
  path: string;
  description?: string;
}

export interface UseMultiStepResult {
  currentStep: number;
  currentStepData: Step;
  isFirstStep: boolean;
  isLastStep: boolean;
  goToStep: (step: number) => void;
  goNext: () => Promise<boolean>;
  goPrevious: () => void;
  validateCurrentStep: () => Promise<boolean>;
}

/**
 * Hook to manage multi-step form navigation
 */
export function useMultiStep(
  form: FormNode,
  steps: Step[]
): UseMultiStepResult {
  const [currentStep, setCurrentStep] = useState(0);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const currentStepData = steps[currentStep];

  /**
   * Validate the current step
   */
  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    const stepPath = steps[currentStep].path;
    const stepNode = form.group(stepPath);

    if (!stepNode) {
      console.error(`Step node not found: ${stepPath}`);
      return false;
    }

    // Mark step as touched
    stepNode.markAsTouched();

    // Validate the step
    const isValid = await stepNode.validate();

    return isValid;
  }, [form, steps, currentStep]);

  /**
   * Go to a specific step
   */
  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < steps.length) {
      setCurrentStep(step);
    }
  }, [steps]);

  /**
   * Go to next step (with validation)
   */
  const goNext = useCallback(async (): Promise<boolean> => {
    // Validate current step
    const isValid = await validateCurrentStep();

    if (!isValid) {
      console.log('Step validation failed');
      return false;
    }

    // Move to next step
    if (!isLastStep) {
      setCurrentStep((prev) => prev + 1);
      return true;
    }

    return true;
  }, [validateCurrentStep, isLastStep]);

  /**
   * Go to previous step
   */
  const goPrevious = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [isFirstStep]);

  return {
    currentStep,
    currentStepData,
    isFirstStep,
    isLastStep,
    goToStep,
    goNext,
    goPrevious,
    validateCurrentStep,
  };
}
```

## Step Indicator Component

Visual progress indicator for multi-step forms.

### StepIndicator Component

```tsx title="src/components/StepIndicator.tsx"
interface StepIndicatorProps {
  steps: Array<{
    name: string;
    description?: string;
  }>;
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function StepIndicator({
  steps,
  currentStep,
  onStepClick
}: StepIndicatorProps) {
  return (
    <nav aria-label="Progress">
      <ol className="space-y-4 md:flex md:space-y-0 md:space-x-8">
        {steps.map((step, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;
          const isUpcoming = index > currentStep;

          return (
            <li key={step.name} className="md:flex-1">
              <button
                type="button"
                onClick={() => onStepClick?.(index)}
                disabled={isUpcoming}
                className={`
                  group flex flex-col border-l-4 py-2 pl-4 md:border-l-0 md:border-t-4 md:pl-0 md:pt-4 md:pb-0
                  ${
                    isComplete
                      ? 'border-blue-600 hover:border-blue-800'
                      : isCurrent
                      ? 'border-blue-600'
                      : 'border-gray-200'
                  }
                  ${isUpcoming ? 'cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <span
                  className={`
                    text-sm font-medium
                    ${
                      isComplete
                        ? 'text-blue-600 group-hover:text-blue-800'
                        : isCurrent
                        ? 'text-blue-600'
                        : 'text-gray-500'
                    }
                  `}
                >
                  Step {index + 1}
                </span>
                <span className="text-sm font-medium">{step.name}</span>
                {step.description && (
                  <span className="text-xs text-gray-500">{step.description}</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

## Step Navigation Component

Navigation buttons for moving between steps.

### StepNavigation Component

```tsx title="src/components/StepNavigation.tsx"
interface StepNavigationProps {
  isFirstStep: boolean;
  isLastStep: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onReview?: () => void;
  loading?: boolean;
}

export function StepNavigation({
  isFirstStep,
  isLastStep,
  onPrevious,
  onNext,
  onReview,
  loading = false
}: StepNavigationProps) {
  return (
    <div className="mt-8 flex justify-between">
      {/* Previous button */}
      <button
        type="button"
        onClick={onPrevious}
        disabled={isFirstStep || loading}
        className={`
          px-6 py-3 rounded-lg font-medium
          ${
            isFirstStep || loading
              ? 'invisible'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }
        `}
      >
        Previous
      </button>

      {/* Next/Review button */}
      <button
        type="button"
        onClick={isLastStep && onReview ? onReview : onNext}
        disabled={loading}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center gap-2">
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
            Validating...
          </span>
        ) : isLastStep ? (
          'Review Application'
        ) : (
          'Next Step'
        )}
      </button>
    </div>
  );
}
```

## Review Page Component

Preview all form data before submission.

### ReviewPage Component

```tsx title="src/components/ReviewPage.tsx"
import { useFormControl } from 'reformer';
import type { FormNode } from 'reformer';

interface ReviewPageProps {
  form: FormNode;
  steps: Array<{ name: string; path: string }>;
  onEdit: (stepIndex: number) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function ReviewPage({
  form,
  steps,
  onEdit,
  onSubmit,
  submitting
}: ReviewPageProps) {
  const { value: formValue } = useFormControl(form.value);

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Review Your Application</h2>
      <p className="text-gray-600 mb-8">
        Please review your information before submitting. Click "Edit" to make changes.
      </p>

      <div className="space-y-6">
        {steps.map((step, index) => (
          <ReviewSection
            key={step.path}
            title={step.name}
            data={formValue[step.path]}
            onEdit={() => onEdit(index)}
          />
        ))}
      </div>

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          onClick={() => onEdit(steps.length - 1)}
          disabled={submitting}
          className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50"
        >
          Go Back
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
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
            </span>
          ) : (
            'Submit Application'
          )}
        </button>
      </div>
    </div>
  );
}

interface ReviewSectionProps {
  title: string;
  data: any;
  onEdit: () => void;
}

function ReviewSection({ title, data, onEdit }: ReviewSectionProps) {
  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-blue-600 hover:text-blue-700 font-medium text-sm"
        >
          Edit
        </button>
      </div>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        {Object.entries(data || {}).map(([key, value]) => (
          <div key={key}>
            <dt className="text-sm font-medium text-gray-500 capitalize">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatValue(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
```

## Complete Multi-Step Form

Putting it all together.

### MultiStepCreditApplicationForm

```tsx title="src/components/MultiStepCreditApplicationForm.tsx"
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCreditApplicationForm } from '../schemas/create-form';
import { creditApplicationTransformer } from '../utils/credit-application-transformer';
import { submitApplication } from '../services/api/submission.api';
import { useMultiStep } from '../hooks/useMultiStep';
import { useSubmissionState } from '../hooks/useSubmissionState';
import { StepIndicator } from './StepIndicator';
import { StepNavigation } from './StepNavigation';
import { ReviewPage } from './ReviewPage';
import { FormRenderer } from './FormRenderer';

const STEPS = [
  { name: 'Loan Information', path: 'step1' },
  { name: 'Personal Information', path: 'step2' },
  { name: 'Contact Information', path: 'step3' },
  { name: 'Employment', path: 'step4' },
  { name: 'Additional Information', path: 'step5' },
];

export function MultiStepCreditApplicationForm() {
  const navigate = useNavigate();
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [showReview, setShowReview] = useState(false);
  const [validating, setValidating] = useState(false);

  const {
    currentStep,
    currentStepData,
    isFirstStep,
    isLastStep,
    goToStep,
    goNext,
    goPrevious,
  } = useMultiStep(form, STEPS);

  const { state, submit, isSubmitting } = useSubmissionState(
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
      },
    }
  );

  const handleNext = async () => {
    setValidating(true);

    try {
      const isValid = await goNext();

      if (isValid && isLastStep) {
        // Last step validated - show review
        setShowReview(true);
      }
    } finally {
      setValidating(false);
    }
  };

  const handlePrevious = () => {
    if (showReview) {
      setShowReview(false);
    } else {
      goPrevious();
    }
  };

  const handleEditStep = (stepIndex: number) => {
    setShowReview(false);
    goToStep(stepIndex);
  };

  const handleSubmit = async () => {
    try {
      const result = await submit();

      // Success - navigate to success page
      setTimeout(() => {
        navigate(`/applications/${result.id}/success`);
      }, 1500);
    } catch (error) {
      console.error('Submission failed:', error);

      // Go back to form to fix errors
      setShowReview(false);
    }
  };

  // Show review page
  if (showReview) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <ReviewPage
          form={form}
          steps={STEPS}
          onEdit={handleEditStep}
          onSubmit={handleSubmit}
          submitting={isSubmitting}
        />
      </div>
    );
  }

  // Show current step
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Credit Application</h1>

      {/* Step indicator */}
      <div className="mb-8">
        <StepIndicator
          steps={STEPS}
          currentStep={currentStep}
          onStepClick={(step) => {
            // Only allow going back to previous steps
            if (step < currentStep) {
              goToStep(step);
            }
          }}
        />
      </div>

      {/* Success message */}
      {state.status === 'success' && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
          <p className="text-green-700">
            Application submitted successfully! Redirecting...
          </p>
        </div>
      )}

      {/* Error message */}
      {state.status === 'error' && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-red-700">
            {state.error.message}
          </p>
        </div>
      )}

      {/* Current step title */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">{currentStepData.name}</h2>
        <p className="text-gray-600 mt-1">
          Step {currentStep + 1} of {STEPS.length}
        </p>
      </div>

      {/* Current step fields */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <FormRenderer
          form={form.group(currentStepData.path)}
        />
      </div>

      {/* Navigation */}
      <StepNavigation
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
        onPrevious={handlePrevious}
        onNext={handleNext}
        loading={validating}
      />
    </div>
  );
}
```

## Step-Specific Validation Messages

Show validation errors for the current step only.

### StepValidationSummary

```tsx title="src/components/StepValidationSummary.tsx"
import { useFormControl } from 'reformer';
import type { FormNode } from 'reformer';

interface StepValidationSummaryProps {
  stepNode: FormNode;
}

export function StepValidationSummary({ stepNode }: StepValidationSummaryProps) {
  const { value: errors } = useFormControl(stepNode.errors);

  if (!errors || Object.keys(errors).length === 0) {
    return null;
  }

  const errorCount = Object.keys(errors).length;

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
            Please fix {errorCount} error{errorCount === 1 ? '' : 's'} in this step
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <ul className="list-disc list-inside space-y-1">
              {Object.entries(errors).map(([field, error]: [string, any]) => (
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

## Saving Progress

Save form progress as user navigates steps.

### Auto-Save Between Steps

```typescript title="src/hooks/useAutoSaveOnStepChange.ts"
import { useEffect, useRef } from 'react';
import type { FormNode } from 'reformer';

export function useAutoSaveOnStepChange(
  form: FormNode,
  currentStep: number,
  saveFn: (data: any) => Promise<void>
): void {
  const previousStepRef = useRef(currentStep);

  useEffect(() => {
    // Save when step changes
    if (previousStepRef.current !== currentStep) {
      const saveData = async () => {
        try {
          const data = form.value.value;
          await saveFn(data);
          console.log('Progress saved');
        } catch (error) {
          console.error('Failed to save progress:', error);
        }
      };

      saveData();
      previousStepRef.current = currentStep;
    }
  }, [currentStep, form, saveFn]);
}
```

## Testing Multi-Step Forms

```typescript title="src/components/MultiStepCreditApplicationForm.test.tsx"
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MultiStepCreditApplicationForm } from './MultiStepCreditApplicationForm';

describe('MultiStepCreditApplicationForm', () => {
  test('shows first step initially', () => {
    render(<MultiStepCreditApplicationForm />);

    expect(screen.getByText('Loan Information')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
  });

  test('navigates to next step on valid data', async () => {
    const { container } = render(<MultiStepCreditApplicationForm />);

    // Fill first step
    // ... fill required fields

    // Click next
    fireEvent.click(screen.getByText('Next Step'));

    // Should move to step 2
    await waitFor(() => {
      expect(screen.getByText('Personal Information')).toBeInTheDocument();
      expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
    });
  });

  test('prevents navigation with invalid data', async () => {
    render(<MultiStepCreditApplicationForm />);

    // Don't fill required fields

    // Click next
    fireEvent.click(screen.getByText('Next Step'));

    // Should stay on step 1
    await waitFor(() => {
      expect(screen.getByText('Loan Information')).toBeInTheDocument();
      expect(screen.getByText(/Please fix/i)).toBeInTheDocument();
    });
  });

  test('shows review page after last step', async () => {
    render(<MultiStepCreditApplicationForm />);

    // Navigate through all steps
    // ... (fill and navigate)

    // Should show review page
    await waitFor(() => {
      expect(screen.getByText('Review Your Application')).toBeInTheDocument();
    });
  });

  test('allows editing from review page', async () => {
    render(<MultiStepCreditApplicationForm />);

    // Get to review page
    // ...

    // Click edit on step 1
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    // Should go back to step 1
    await waitFor(() => {
      expect(screen.getByText('Loan Information')).toBeInTheDocument();
    });
  });
});
```

## Best Practices

### 1. Validate Each Step

```typescript
// ✅ GOOD: Validate before proceeding
const isValid = await stepNode.validate();
if (!isValid) return;

// ❌ BAD: No step validation
goNext(); // Skip validation
```

### 2. Show Progress Clearly

```tsx
// ✅ GOOD: Clear progress indicator
<StepIndicator steps={steps} currentStep={currentStep} />
<p>Step {currentStep + 1} of {steps.length}</p>

// ❌ BAD: No progress indication
```

### 3. Allow Going Back

```typescript
// ✅ GOOD: Can go back without validation
goPrevious(); // No validation needed

// ❌ BAD: Force validation to go back
await validate(); goPrevious(); // Annoying
```

### 4. Provide Review Before Submit

```tsx
// ✅ GOOD: Review page before submit
{showReview && <ReviewPage onEdit={editStep} onSubmit={submit} />}

// ❌ BAD: Submit without review
<button onClick={submit}>Submit</button> // No chance to review
```

### 5. Save Progress

```typescript
// ✅ GOOD: Auto-save on step change
useAutoSaveOnStepChange(form, currentStep, saveDraft);

// ❌ BAD: Lose all data on page refresh
```

## Key Takeaways

- Break complex forms into manageable steps
- Validate each step before allowing progression
- Show clear progress indicators
- Allow users to go back and edit
- Provide a review page before final submission
- Save progress as users navigate steps
- Test all navigation scenarios

## What's Next?

You've implemented a complete multi-step submission workflow! Next, we'll integrate everything in **Complete Submission Flow**:

- Combining all submission features
- Full CreditApplicationForm component
- All submission scenarios
- Complete testing checklist
- Best practices summary
- Performance considerations
- Final file structure

In the final section, we'll bring together everything we've learned to create a production-ready form submission system.

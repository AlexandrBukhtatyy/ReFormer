---
sidebar_position: 8
---

# Complete Submission Flow

Bringing together all submission features into a production-ready implementation.

## Overview

This final section integrates everything we've learned:

- **All Submission Features** - Basic, states, errors, retry, optimistic, multi-step
- **Complete Component** - Production-ready CreditApplicationForm
- **Integration Examples** - How all features work together
- **Testing Checklist** - Comprehensive test scenarios
- **Best Practices** - Summary of key principles
- **Performance** - Optimization techniques
- **File Structure** - Final project organization

## Complete File Structure

The final structure for your submission implementation:

```
src/
├── components/
│   ├── CreditApplicationForm.tsx          # Main form component
│   ├── MultiStepCreditApplicationForm.tsx # Multi-step variant
│   ├── FormRenderer.tsx                   # Form field renderer
│   ├── SubmitButton.tsx                   # Smart submit button
│   ├── SubmissionStatus.tsx               # Status display
│   ├── StepIndicator.tsx                  # Progress indicator
│   ├── StepNavigation.tsx                 # Step controls
│   ├── ReviewPage.tsx                     # Review before submit
│   ├── RetryIndicator.tsx                 # Retry progress
│   ├── ErrorAlert.tsx                     # Error display
│   ├── GlobalErrorSummary.tsx             # Form-wide errors
│   ├── ConfirmationDialog.tsx             # Confirm before submit
│   └── SuccessPage.tsx                    # Post-submission success
│
├── hooks/
│   ├── useSubmissionState.ts              # Submission state management
│   ├── useRetry.ts                        # Retry logic
│   ├── useOptimistic.ts                   # Optimistic updates
│   ├── useMultiStep.ts                    # Multi-step navigation
│   ├── useAutoClearErrors.ts              # Auto-clear server errors
│   └── useAutoSaveOnStepChange.ts         # Save progress
│
├── services/
│   └── api/
│       └── submission.api.ts              # API functions
│
├── utils/
│   ├── credit-application-transformer.ts  # Data transformation
│   └── map-server-errors.ts               # Error mapping
│
├── errors/
│   └── submission-errors.ts               # Error types
│
└── schemas/
    └── create-form.ts                     # Form schema
```

## Complete CreditApplicationForm

A production-ready form with all features integrated.

### The Complete Component

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCreditApplicationForm } from '../schemas/create-form';
import { creditApplicationTransformer } from '../utils/credit-application-transformer';
import { submitApplication } from '../services/api/submission.api';
import { mapServerErrors } from '../utils/map-server-errors';
import {
  ValidationSubmissionError,
  ServerSubmissionError,
  NetworkSubmissionError,
  AuthenticationError,
  RateLimitError,
} from '../errors/submission-errors';
import { useSubmissionState } from '../hooks/useSubmissionState';
import { useAutoClearErrors } from '../hooks/useAutoClearErrors';
import { FormRenderer } from './FormRenderer';
import { SubmitButton } from './SubmitButton';
import { SubmissionStatus } from './SubmissionStatus';
import { RetryIndicator } from './RetryIndicator';
import { ErrorAlert } from './ErrorAlert';
import { GlobalErrorSummary } from './GlobalErrorSummary';
import { ConfirmationDialog } from './ConfirmationDialog';

export function CreditApplicationForm() {
  const navigate = useNavigate();
  const form = useMemo(() => createCreditApplicationForm(), []);

  // State management
  const [globalError, setGlobalError] = useState<Error | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Auto-clear server errors on field change
  useAutoClearErrors(form);

  // Submission with retry
  const {
    state,
    submit,
    reset,
    attempt,
    retrying,
    isIdle,
    isSubmitting,
    isSuccess,
    isError,
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
        onRetry: (attemptNum, error) => {
          console.log(`Retry attempt ${attemptNum}:`, error.message);
        },
      },
    }
  );

  // Handle submit button click
  const handleSubmitClick = async (e: React.FormEvent) => {
    e.preventDefault();

    // Show confirmation dialog
    setShowConfirmation(true);
  };

  // Handle confirmed submission
  const handleConfirmedSubmit = async () => {
    setShowConfirmation(false);
    setGlobalError(null);

    try {
      const result = await submit();

      // Success - navigate to success page after brief delay
      setTimeout(() => {
        navigate(`/applications/${result.id}/success`, {
          state: { application: result },
        });
      }, 1500);
    } catch (error) {
      console.error('Submission failed:', error);

      // Handle different error types
      if (error instanceof ValidationSubmissionError) {
        // Map field-specific validation errors
        mapServerErrors(form, error);
        setGlobalError(
          new Error('Please fix the validation errors below and try again.')
        );
      } else if (error instanceof AuthenticationError) {
        // Session expired - redirect to login
        setGlobalError(error);
        setTimeout(() => {
          navigate('/login', {
            state: { returnUrl: window.location.pathname },
          });
        }, 2000);
      } else if (error instanceof RateLimitError) {
        // Rate limiting
        setGlobalError(error);
      } else if (error instanceof NetworkSubmissionError) {
        // Network error
        setGlobalError(error);
      } else if (error instanceof ServerSubmissionError) {
        // Server error
        setGlobalError(error);
      } else {
        // Unknown error
        setGlobalError(
          new Error('An unexpected error occurred. Please try again.')
        );
      }
    }
  };

  // Handle retry
  const handleRetry = async () => {
    setGlobalError(null);
    await handleConfirmedSubmit();
  };

  // Handle cancel confirmation
  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
  };

  // Handle reset after success
  const handleReset = () => {
    reset();
    form.reset();
    setGlobalError(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Credit Application
        </h1>
        <p className="mt-2 text-gray-600">
          Fill out the form below to apply for a loan. All fields marked with * are required.
        </p>
      </div>

      {/* Retry Indicator */}
      {retrying && (
        <RetryIndicator
          attempt={attempt}
          maxAttempts={3}
          retrying={retrying}
        />
      )}

      {/* Submission Status */}
      <SubmissionStatus state={state} onReset={handleReset} />

      {/* Global Error */}
      {globalError && (
        <ErrorAlert
          error={globalError}
          onRetry={
            globalError instanceof NetworkSubmissionError ||
            globalError instanceof ServerSubmissionError
              ? handleRetry
              : undefined
          }
          onDismiss={() => setGlobalError(null)}
        />
      )}

      {/* Field Error Summary */}
      <GlobalErrorSummary form={form} />

      {/* Form */}
      <form onSubmit={handleSubmitClick}>
        {/* Form Fields */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <FormRenderer form={form} state={state} />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={isSubmitting || retrying}
            className="px-6 py-3 rounded-lg font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
          >
            Cancel
          </button>

          <SubmitButton form={form} state={state} />
        </div>
      </form>

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <ConfirmationDialog
          form={form}
          onConfirm={handleConfirmedSubmit}
          onCancel={handleCancelConfirmation}
        />
      )}
    </div>
  );
}
```

## Confirmation Dialog Component

Ask for confirmation before submitting.

### ConfirmationDialog Component

```tsx title="src/components/ConfirmationDialog.tsx"
import { useFormControl } from 'reformer';
import type { FormNode } from 'reformer';

interface ConfirmationDialogProps {
  form: FormNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationDialog({
  form,
  onConfirm,
  onCancel
}: ConfirmationDialogProps) {
  const { value: formValue } = useFormControl(form.value);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4">
          <h2 className="text-xl font-bold">Confirm Submission</h2>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <p className="text-gray-700 mb-4">
            Please review your information before submitting your application.
          </p>

          {/* Summary */}
          <div className="space-y-4">
            <SummarySection
              title="Loan Information"
              data={formValue.step1}
            />
            <SummarySection
              title="Personal Information"
              data={{
                ...formValue.step2.personalData,
                ...formValue.step2.passportData,
              }}
            />
            <SummarySection
              title="Contact Information"
              data={formValue.step3}
            />
            <SummarySection
              title="Employment"
              data={formValue.step4}
            />
          </div>

          {/* Agreements */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700">
              By submitting this application, you confirm that:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              <li>• All information provided is accurate and complete</li>
              <li>• You agree to the terms and conditions</li>
              <li>• You consent to data processing and credit checks</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 rounded-lg font-medium bg-gray-200 text-gray-700 hover:bg-gray-300"
          >
            Review Again
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-6 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700"
          >
            Submit Application
          </button>
        </div>
      </div>
    </div>
  );
}

interface SummarySectionProps {
  title: string;
  data: any;
}

function SummarySection({ title, data }: SummarySectionProps) {
  return (
    <div className="border-l-4 border-blue-600 pl-4">
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        {Object.entries(data || {}).map(([key, value]) => {
          // Skip nested objects and empty values
          if (typeof value === 'object' || value === null || value === undefined || value === '') {
            return null;
          }

          return (
            <div key={key} className="col-span-2 sm:col-span-1">
              <dt className="text-gray-500 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}:
              </dt>
              <dd className="text-gray-900 font-medium">
                {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
```

## Success Page Component

Show success message after submission.

### SuccessPage Component

```tsx title="src/components/SuccessPage.tsx"
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function SuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const application = location.state?.application;

  useEffect(() => {
    // Redirect if no application data
    if (!application) {
      navigate('/', { replace: true });
    }
  }, [application, navigate]);

  if (!application) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <svg
              className="w-10 h-10 text-green-600"
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
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Application Submitted!
          </h1>
          <p className="mt-2 text-gray-600">
            Your credit application has been received and is being processed.
          </p>
        </div>

        {/* Application Details */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Application Details
          </h2>

          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-gray-500">Application ID</dt>
              <dd className="text-lg font-mono font-semibold text-gray-900">
                {application.id}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-gray-500">Status</dt>
              <dd className="text-sm">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  {application.status}
                </span>
              </dd>
            </div>

            <div>
              <dt className="text-sm text-gray-500">Submitted At</dt>
              <dd className="text-sm text-gray-900">
                {new Date(application.submittedAt).toLocaleString()}
              </dd>
            </div>

            {application.estimatedDecisionTime && (
              <div>
                <dt className="text-sm text-gray-500">Estimated Decision Time</dt>
                <dd className="text-sm text-gray-900">
                  {application.estimatedDecisionTime}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Next Steps */}
        <div className="bg-blue-50 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            What Happens Next?
          </h2>
          <ol className="space-y-3 text-sm text-gray-700">
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium mr-3">
                1
              </span>
              <span>
                Our team will review your application within 24-48 hours
              </span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium mr-3">
                2
              </span>
              <span>
                We may contact you for additional information or documentation
              </span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium mr-3">
                3
              </span>
              <span>
                You'll receive an email notification with the decision
              </span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium mr-3">
                4
              </span>
              <span>
                If approved, you can proceed with the loan agreement
              </span>
            </li>
          </ol>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => navigate('/applications')}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            View My Applications
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-300"
          >
            Back to Home
          </button>
        </div>

        {/* Support */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>
            Questions about your application?{' '}
            <a href="/support" className="text-blue-600 hover:underline">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
```

## Complete Testing Checklist

### Basic Functionality

- [ ] Form loads correctly
- [ ] All fields render properly
- [ ] Validation works on all fields
- [ ] Submit button is disabled when form is invalid
- [ ] Submit button is enabled when form is valid

### Basic Submission

- [ ] Successful submission navigates to success page
- [ ] Form data is correctly transformed before submission
- [ ] Loading state is shown during submission
- [ ] Success message is displayed
- [ ] Form is reset after successful submission

### Validation Errors

- [ ] Client-side validation errors are shown
- [ ] Form cannot be submitted with validation errors
- [ ] Errors are cleared when user fixes them
- [ ] Error messages are clear and helpful

### Server Errors

- [ ] Server validation errors (422) are mapped to fields
- [ ] Field-specific errors are displayed on correct fields
- [ ] Global errors are displayed at top of form
- [ ] Network errors (no response) are handled
- [ ] Server errors (500) are handled
- [ ] Authentication errors (401) redirect to login
- [ ] Rate limiting errors (429) show retry time

### Error Recovery

- [ ] Server errors are cleared when user edits fields
- [ ] User can retry after network error
- [ ] User can retry after server error
- [ ] User cannot retry validation errors (must fix)
- [ ] Form data is preserved during retry

### Retry Logic

- [ ] Automatic retry works for network errors
- [ ] Automatic retry works for server errors (5xx)
- [ ] Exponential backoff increases delay
- [ ] Max retry attempts are respected
- [ ] Retry progress is shown to user
- [ ] Manual retry button appears after max attempts
- [ ] Validation errors are not retried

### Optimistic Updates

- [ ] UI updates immediately on submit (if implemented)
- [ ] Optimistic data is marked with flag
- [ ] Optimistic update is confirmed on success
- [ ] Optimistic update is rolled back on error
- [ ] Visual indicator shows optimistic state

### Multi-Step Forms

- [ ] Step indicator shows current progress
- [ ] Next button validates current step
- [ ] Cannot proceed with invalid step
- [ ] Can go back to previous steps
- [ ] Review page shows all data
- [ ] Can edit from review page
- [ ] Final submission validates entire form

### Submission States

- [ ] Idle state - initial state
- [ ] Submitting state - shows loading
- [ ] Success state - shows confirmation
- [ ] Error state - shows error message
- [ ] State transitions work correctly
- [ ] Form is locked during submission

### User Experience

- [ ] Confirmation dialog before submit (if required)
- [ ] Success page shows application details
- [ ] Clear next steps are provided
- [ ] Form is accessible (keyboard navigation)
- [ ] Form works on mobile devices
- [ ] Loading states are smooth
- [ ] Error messages are user-friendly

### Edge Cases

- [ ] Double-click submit button doesn't create duplicates
- [ ] Browser back button during submission
- [ ] Page refresh during submission
- [ ] Network connection lost mid-submission
- [ ] Session expires during submission
- [ ] Concurrent submissions
- [ ] Very large form data
- [ ] Special characters in form data

## Best Practices Summary

### 1. Always Validate Before Submit

```typescript
// ✅ Use form.submit() - validates automatically
await form.submit(async (validData) => {
  return await submitToAPI(validData);
});

// ❌ Manual submission without validation
const data = form.value.value;
await submitToAPI(data); // Might be invalid!
```

### 2. Transform Data Appropriately

```typescript
// ✅ Use transformer to match API format
const apiData = transformer.serialize(formData);
await submitApplication(apiData);

// ❌ Send raw form data
await submitApplication(formData); // Format mismatch
```

### 3. Handle All Error Types

```typescript
// ✅ Specific error handling
if (error instanceof ValidationSubmissionError) { /* ... */ }
else if (error instanceof NetworkSubmissionError) { /* ... */ }
else if (error instanceof ServerSubmissionError) { /* ... */ }

// ❌ Generic error handling
catch (error) {
  alert('Error!'); // Not helpful
}
```

### 4. Provide Clear Feedback

```tsx
// ✅ Clear visual states
{isSubmitting && <LoadingIndicator />}
{isSuccess && <SuccessMessage />}
{isError && <ErrorMessage error={error} />}

// ❌ No feedback
// User doesn't know what's happening
```

### 5. Enable Recovery

```typescript
// ✅ Allow retry for retryable errors
{error?.retryable && <button onClick={retry}>Try Again</button>}

// ❌ No way to retry
// User is stuck
```

### 6. Test Thoroughly

```typescript
// ✅ Test all scenarios
- Happy path (success)
- Validation errors
- Server errors
- Network errors
- Retry logic
- Edge cases

// ❌ Only test happy path
// Real-world errors will break
```

## Performance Considerations

### 1. Memoize Form Creation

```typescript
// ✅ Create form once
const form = useMemo(() => createCreditApplicationForm(), []);

// ❌ Recreate on every render
const form = createCreditApplicationForm(); // Expensive!
```

### 2. Debounce Validation

```typescript
// ✅ Debounce expensive validation
const debouncedValidate = useMemo(
  () => debounce(form.validate, 300),
  [form]
);

// ❌ Validate on every keystroke
onChange={() => form.validate()} // Too frequent
```

### 3. Optimize Re-renders

```typescript
// ✅ Use useFormControl for specific fields
const { value } = useFormControl(form.field('email'));

// ❌ Subscribe to entire form
const formValue = useFormControl(form.value); // Re-renders on any change
```

### 4. Lazy Load Components

```typescript
// ✅ Lazy load success page
const SuccessPage = lazy(() => import('./SuccessPage'));

// ❌ Import everything upfront
import { SuccessPage } from './SuccessPage'; // Increases bundle
```

### 5. Clean Up Subscriptions

```typescript
// ✅ Clean up in useEffect
useEffect(() => {
  const subscription = form.value.subscribe(handler);
  return () => subscription.unsubscribe();
}, [form]);

// ❌ No cleanup
form.value.subscribe(handler); // Memory leak!
```

## Integration with Other Features

### With Auto-Save

```typescript
// Save draft before submission
const { saveStatus } = useAutoSave(form, saveDraft);

const handleSubmit = async () => {
  // Wait for pending save
  if (saveStatus === 'saving') {
    await waitForSave();
  }

  // Then submit
  await submit();

  // Delete draft after successful submission
  deleteDraft();
};
```

### With Data Loading

```typescript
// Load existing application
const { loading } = useDataLoader(form, applicationId);

// Only show form when loaded
if (loading) return <LoadingBoundary />;

return <CreditApplicationForm />;
```

### With Behaviors

```typescript
// Computed fields are included automatically
const result = await form.submit(async (data) => {
  // data includes computed fields like monthlyPayment, age, etc.
  return await submitApplication(data);
});
```

## Final Recommendations

### For Production Use

1. **Error Tracking** - Integrate with error tracking service (Sentry, etc.)
2. **Analytics** - Track submission success/failure rates
3. **Monitoring** - Monitor API response times and errors
4. **Logging** - Log submission attempts and outcomes
5. **Security** - Validate and sanitize all data server-side
6. **Testing** - Maintain >80% test coverage
7. **Documentation** - Document API contracts and error codes

### For User Experience

1. **Progress Indicators** - Show clear progress through multi-step forms
2. **Auto-Save** - Save progress regularly
3. **Confirmation** - Confirm before submitting important data
4. **Success Feedback** - Clear confirmation after submission
5. **Error Messages** - Helpful, actionable error messages
6. **Retry Options** - Always provide way to retry
7. **Accessibility** - Ensure form is keyboard-navigable

### For Maintainability

1. **Type Safety** - Use TypeScript throughout
2. **Separation of Concerns** - Keep components focused
3. **Reusable Hooks** - Extract common patterns
4. **Consistent Patterns** - Follow same patterns across forms
5. **Documentation** - Comment complex logic
6. **Testing** - Test all user journeys
7. **Code Review** - Review all submission logic

## Conclusion

You've now built a complete, production-ready form submission system with:

- ✅ **Basic submission** with automatic validation
- ✅ **State management** for tracking submission lifecycle
- ✅ **Error handling** for all error types
- ✅ **Retry logic** with exponential backoff
- ✅ **Optimistic updates** for instant feedback
- ✅ **Multi-step workflow** with review page
- ✅ **Confirmation dialogs** before submission
- ✅ **Success pages** with next steps
- ✅ **Complete testing** coverage

This implementation handles all real-world scenarios and provides an excellent user experience while maintaining code quality and maintainability.

## Next Steps

Now that you've mastered form submission, explore:

- **[Behaviors](../behaviors/1-introduction.md)** - Add dynamic field behaviors
- **[Validation](../validation/1-introduction.md)** - Deep dive into validation strategies
- **[Data Flow](../data-flow/1-introduction.md)** - Master data transformations
- **[API Reference](../../api/)** - Explore all ReFormer APIs

Congratulations on completing the Submission tutorial! You're now ready to build professional forms with ReFormer.

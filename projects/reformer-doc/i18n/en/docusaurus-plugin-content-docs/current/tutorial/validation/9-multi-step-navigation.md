---
sidebar_position: 9
---

# Multi-Step Form Navigation

Using the `FormNavigation` component from `@reformer/ui` for multi-step form wizard with step-by-step validation.

## Overview

In multi-step forms we need to:

1. **Validate only the current step** — don't show errors for fields on future steps
2. **Preserve full validation** — for final submission
3. **Track completed steps** — allow navigation only to visited steps
4. **Provide navigation methods** — Next, Back, Go to step

The `@reformer/ui` package provides `FormNavigation` — a headless compound component that handles all this logic.

## Installation

```bash
npm install @reformer/ui
```

## The Problem

When registering validation at form creation:

```typescript
createForm<CreditApplicationForm>({
  schema: creditApplicationSchema,
  behavior: creditApplicationBehaviors,
  validation: creditApplicationValidation, // Full validation
});
```

Calling `form.validate()` validates **all fields**, including those on steps the user hasn't reached yet.

We need a way to validate only specific fields on each step while preserving full validation for final submission.

## Solution: FormNavigation

`FormNavigation` from `@reformer/ui` provides:

- **Step-by-step validation** via `validateForm` internally
- **Progress tracking** with completed steps
- **Headless compound components** for flexible UI
- **Ref handle** for programmatic navigation

## Step Configuration

First, define validation schemas for each step:

```typescript title="src/forms/credit-application/steps/*/validators.ts"
export { loanValidation } from './loan-info/validators';
export { personalValidation } from './personal-info/validators';
export { contactValidation } from './contact-info/validators';
export { employmentValidation } from './employment/validators';
export { additionalValidation } from './additional-info/validators';
```

Then define step metadata:

```typescript title="src/forms/credit-application/CreditApplicationForm.tsx"
const STEPS = [
  { number: 1, title: 'Loan', icon: '💰' },
  { number: 2, title: 'Personal Data', icon: '👤' },
  { number: 3, title: 'Contacts', icon: '📞' },
  { number: 4, title: 'Employment', icon: '💼' },
  { number: 5, title: 'Additional', icon: '📋' },
  { number: 6, title: 'Confirmation', icon: '✅' },
];

const STEP_VALIDATIONS = {
  1: loanValidation,
  2: personalValidation,
  3: contactValidation,
  4: employmentValidation,
  5: additionalValidation,
  // Step 6 — confirmation, no validation needed
};
```

## Using FormNavigation

### Basic Structure

```tsx title="src/forms/credit-application/CreditApplicationForm.tsx"
import { useMemo, useRef } from 'react';
import { createForm } from '@reformer/core';
import { FormNavigation, type FormNavigationHandle } from '@reformer/ui/form-navigation';

// Step components
import { BasicInfoForm } from './steps/loan-info/BasicInfoForm';
import { PersonalInfoForm } from './steps/personal-info/PersonalInfoForm';
import { ContactInfoForm } from './steps/contact-info/ContactInfoForm';
import { EmploymentForm } from './steps/employment/EmploymentForm';
import { AdditionalInfoForm } from './steps/additional-info/AdditionalInfoForm';
import { ConfirmationForm } from './steps/confirmation/ConfirmationForm';

// Validators
import { creditApplicationValidation } from './validators';

function CreditApplicationForm() {
  const navRef = useRef<FormNavigationHandle<CreditApplicationFormType>>(null);

  const form = useMemo(
    () =>
      createForm<CreditApplicationFormType>({
        form: creditApplicationSchema,
        behavior: creditApplicationBehaviors,
        validation: creditApplicationValidation,
      }),
    []
  );

  // Navigation configuration
  const navConfig = useMemo(
    () => ({
      stepValidations: STEP_VALIDATIONS,
      fullValidation: creditApplicationValidation,
    }),
    []
  );

  const handleSubmit = async () => {
    const result = await navRef.current?.submit(async (values) => {
      const response = await saveApplication(values);
      return response;
    });

    if (result) {
      alert('Application submitted!');
    }
  };

  return (
    <FormNavigation ref={navRef} form={form} config={navConfig}>
      {/* Compound components here */}
    </FormNavigation>
  );
}
```

### FormNavigation.Indicator

Headless step indicator with render props:

```tsx
<FormNavigation.Indicator steps={STEPS}>
  {({ steps, goToStep }) => (
    <div className="flex justify-between mb-4">
      {steps.map((step) => (
        <button
          key={step.number}
          onClick={() => step.canNavigate && goToStep(step.number)}
          disabled={!step.canNavigate}
          className={`px-4 py-2 rounded ${
            step.isCurrent
              ? 'bg-blue-600 text-white'
              : step.isCompleted
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-400'
          }`}
        >
          {step.isCompleted ? '✓' : step.icon} {step.title}
        </button>
      ))}
    </div>
  )}
</FormNavigation.Indicator>
```

**Render props:**

| Property       | Type                         | Description                   |
| -------------- | ---------------------------- | ----------------------------- |
| `steps`        | `StepWithState[]`            | Steps with computed state     |
| `goToStep`     | `(step: number) => boolean`  | Navigate to step              |
| `currentStep`  | `number`                     | Current step number           |
| `totalSteps`   | `number`                     | Total number of steps         |

**Step state:**

| Property      | Type      | Description                     |
| ------------- | --------- | ------------------------------- |
| `number`      | `number`  | Step number (from 1)            |
| `title`       | `string`  | Step title                      |
| `icon`        | `string?` | Icon (optional)                 |
| `isCurrent`   | `boolean` | Is current step                 |
| `isCompleted` | `boolean` | Is completed                    |
| `canNavigate` | `boolean` | Can navigate to this step       |

### FormNavigation.Step

Renders component when step is active:

```tsx
<div className="bg-white p-8 rounded-lg shadow-md">
  <FormNavigation.Step component={BasicInfoForm} control={form} />
  <FormNavigation.Step component={PersonalInfoForm} control={form} />
  <FormNavigation.Step component={ContactInfoForm} control={form} />
  <FormNavigation.Step component={EmploymentForm} control={form} />
  <FormNavigation.Step component={AdditionalInfoForm} control={form} />
  <FormNavigation.Step component={ConfirmationForm} control={form} />
</div>
```

Steps render in order — first `Step` is step 1, second is step 2, etc. Only the current step is displayed.

### FormNavigation.Actions

Headless navigation buttons with render props:

```tsx
<FormNavigation.Actions onSubmit={handleSubmit}>
  {({ prev, next, submit, isFirstStep, isLastStep, isValidating }) => (
    <div className="flex justify-between mt-6">
      <Button
        onClick={prev.onClick}
        disabled={isFirstStep || prev.disabled}
        variant="secondary"
      >
        Back
      </Button>

      {!isLastStep ? (
        <Button onClick={next.onClick} disabled={next.disabled}>
          {isValidating ? 'Validating...' : 'Next'}
        </Button>
      ) : (
        <Button onClick={submit.onClick} disabled={submit.disabled}>
          {submit.isSubmitting ? 'Submitting...' : 'Submit'}
        </Button>
      )}
    </div>
  )}
</FormNavigation.Actions>
```

**Render props:**

| Property       | Type                | Description              |
| -------------- | ------------------- | ------------------------ |
| `prev`         | `ButtonProps`       | "Back" button props      |
| `next`         | `ButtonProps`       | "Next" button props      |
| `submit`       | `SubmitButtonProps` | "Submit" button props    |
| `isFirstStep`  | `boolean`           | On first step            |
| `isLastStep`   | `boolean`           | On last step             |
| `isValidating` | `boolean`           | Validation in progress   |

### FormNavigation.Progress

Headless progress display:

```tsx
<FormNavigation.Progress>
  {({ current, total, percent }) => (
    <div className="mt-4 text-center text-sm text-gray-600">
      Step {current} of {total} • {percent}% complete
    </div>
  )}
</FormNavigation.Progress>
```

## Full Example

```tsx title="src/forms/credit-application/CreditApplicationForm.tsx"
import { useMemo, useRef } from 'react';
import { createForm } from '@reformer/core';
import { FormNavigation, type FormNavigationHandle } from '@reformer/ui/form-navigation';
import { Button } from '@/components/ui/button';

// Step and validator imports...

const STEPS = [
  { number: 1, title: 'Loan', icon: '💰' },
  { number: 2, title: 'Personal Data', icon: '👤' },
  { number: 3, title: 'Contacts', icon: '📞' },
  { number: 4, title: 'Employment', icon: '💼' },
  { number: 5, title: 'Additional', icon: '📋' },
  { number: 6, title: 'Confirmation', icon: '✅' },
];

const STEP_VALIDATIONS = {
  1: loanValidation,
  2: personalValidation,
  3: contactValidation,
  4: employmentValidation,
  5: additionalValidation,
};

function CreditApplicationForm() {
  const navRef = useRef<FormNavigationHandle<CreditApplicationFormType>>(null);

  const form = useMemo(
    () =>
      createForm<CreditApplicationFormType>({
        form: creditApplicationSchema,
        behavior: creditApplicationBehaviors,
        validation: creditApplicationValidation,
      }),
    []
  );

  const navConfig = useMemo(
    () => ({
      stepValidations: STEP_VALIDATIONS,
      fullValidation: creditApplicationValidation,
    }),
    []
  );

  const submitApplication = async () => {
    const result = await navRef.current?.submit(async (values) => {
      const response = await saveApplication(values);
      alert(`Application submitted! ID: ${response.id}`);
      return response;
    });

    if (!result) {
      alert('Please fix the errors in the form');
    }
  };

  return (
    <FormNavigation ref={navRef} form={form} config={navConfig}>
      {/* Step indicator */}
      <FormNavigation.Indicator steps={STEPS}>
        {({ steps, goToStep }) => (
          <div className="flex justify-between mb-4">
            {steps.map((step) => (
              <button
                key={step.number}
                onClick={() => step.canNavigate && goToStep(step.number)}
                disabled={!step.canNavigate}
                className={`px-4 py-2 rounded transition-colors ${
                  step.isCurrent
                    ? 'bg-blue-600 text-white'
                    : step.isCompleted
                      ? 'bg-green-100 text-green-800 hover:bg-green-200'
                      : step.canNavigate
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {step.isCompleted ? '✓' : step.icon} {step.title}
              </button>
            ))}
          </div>
        )}
      </FormNavigation.Indicator>

      {/* Step content */}
      <div className="bg-white p-8 rounded-lg shadow-md">
        <FormNavigation.Step component={BasicInfoForm} control={form} />
        <FormNavigation.Step component={PersonalInfoForm} control={form} />
        <FormNavigation.Step component={ContactInfoForm} control={form} />
        <FormNavigation.Step component={EmploymentForm} control={form} />
        <FormNavigation.Step component={AdditionalInfoForm} control={form} />
        <FormNavigation.Step component={ConfirmationForm} control={form} />
      </div>

      {/* Navigation buttons */}
      <FormNavigation.Actions onSubmit={submitApplication}>
        {({ prev, next, submit, isFirstStep, isLastStep, isValidating }) => (
          <div className="flex justify-between mt-6">
            <Button
              onClick={prev.onClick}
              disabled={isFirstStep || prev.disabled}
              variant="secondary"
            >
              Back
            </Button>

            {!isLastStep ? (
              <Button onClick={next.onClick} disabled={next.disabled}>
                {isValidating ? 'Validating...' : 'Next'}
              </Button>
            ) : (
              <Button onClick={submit.onClick} disabled={submit.disabled}>
                {submit.isSubmitting ? 'Submitting...' : 'Submit Application'}
              </Button>
            )}
          </div>
        )}
      </FormNavigation.Actions>

      {/* Progress */}
      <FormNavigation.Progress>
        {({ current, total, percent }) => (
          <div className="mt-4 text-center text-sm text-gray-600">
            Step {current} of {total} • {percent}% complete
          </div>
        )}
      </FormNavigation.Progress>
    </FormNavigation>
  );
}

export default CreditApplicationForm;
```

## Programmatic Navigation

Use the ref handle for external control:

```tsx
const navRef = useRef<FormNavigationHandle<MyForm>>(null);

// Programmatic navigation
navRef.current?.goToStep(2);
navRef.current?.goToNextStep();
navRef.current?.goToPreviousStep();

// Submit with validation
const result = await navRef.current?.submit(async (values) => {
  return api.submit(values);
});
```

### FormNavigationHandle API

| Property/Method      | Type                 | Description                  |
| -------------------- | -------------------- | ---------------------------- |
| `currentStep`        | `number`             | Current step (from 1)        |
| `completedSteps`     | `number[]`           | Completed steps              |
| `isFirstStep`        | `boolean`            | On first step                |
| `isLastStep`         | `boolean`            | On last step                 |
| `isValidating`       | `boolean`            | Validation in progress       |
| `goToNextStep()`     | `Promise<boolean>`   | Validate and go next         |
| `goToPreviousStep()` | `void`               | Go back                      |
| `goToStep(step)`     | `boolean`            | Go to step                   |
| `submit(onSubmit)`   | `Promise<R \| null>` | Full validation and submit   |

## Key Benefits

1. **Headless** — full UI control, any styles
2. **Compound Components** — declarative, composable API
3. **Render Props** — access to all state for custom rendering
4. **Type Safety** — full TypeScript support with generics
5. **Reusability** — works with any form with step-by-step validation

## What's Next?

Now that navigation is ready, the following sections cover:

- **Working with Data** — loading, saving, and resetting form data
- **Submission** — handling form submission, errors, and retries

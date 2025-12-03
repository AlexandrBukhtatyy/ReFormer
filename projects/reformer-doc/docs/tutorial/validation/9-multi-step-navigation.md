---
sidebar_position: 9
---

# Multi-Step Form Navigation

Building a complete multi-step navigation system with step-by-step validation.

## Overview

In multi-step forms, we need to:

1. **Validate only the current step** - Don't show errors for fields on future steps
2. **Keep full validation registered** - For final submission
3. **Track completed steps** - Allow navigation only to visited steps
4. **Provide navigation methods** - Next, Previous, GoTo

This section shows how to build a reusable `StepNavigation` component that handles all this logic.

## The Challenge

When validation is registered at form creation:

```typescript
createForm<CreditApplicationForm>({
  schema: creditApplicationSchema,
  behavior: creditApplicationBehaviors,
  validation: creditApplicationValidation, // Full validation
});
```

Calling `form.validate()` validates **all fields**, including those on steps the user hasn't reached yet.

We need a way to validate only specific fields per step while keeping the full validation for final submit.

## The Solution: `validateForm`

The `validateForm` function lets you validate a form against a specific schema:

```typescript
import { validateForm } from '@reformer/core/validators';

// Validate only step 1 fields
const isValid = await validateForm(form, loanValidation);
```

### How It Works

1. Creates a temporary validation context
2. Applies validators from the provided schema
3. Validates all relevant fields
4. Returns `true` if valid, `false` if errors exist
5. **Does not** modify the form's registered validation

This means you can use different schemas for step validation while keeping the full schema registered.

## Step Configuration

First, define the validation schemas for each step:

```typescript title="src/schemas/validators/index.ts"
export { loanValidation } from './loan-info';
export { personalValidation } from './personal-info';
export { contactValidation } from './contact-info';
export { employmentValidation } from './employment';
export { additionalValidation } from './additional-info';
export { creditApplicationValidation } from './credit-application';
```

Then create the step configuration:

```typescript title="src/forms/step-config.ts"
import type { ValidationSchemaFn } from '@reformer/core';
import type { CreditApplicationForm } from '@/types';

import {
  loanValidation,
  personalValidation,
  contactValidation,
  employmentValidation,
  additionalValidation,
  creditApplicationValidation,
} from '@/schemas/validators';

export interface StepNavigationConfig<T> {
  /** Total number of steps */
  totalSteps: number;

  /** Validation schema for each step */
  stepValidations: Record<number, ValidationSchemaFn<T>>;

  /** Full validation schema (for submit) */
  fullValidation: ValidationSchemaFn<T>;
}

export const STEP_CONFIG: StepNavigationConfig<CreditApplicationForm> = {
  totalSteps: 6,
  stepValidations: {
    1: loanValidation,
    2: personalValidation,
    3: contactValidation,
    4: employmentValidation,
    5: additionalValidation,
    // Step 6 is confirmation - no validation needed
  },
  fullValidation: creditApplicationValidation,
};
```

## Building the StepNavigation Component

### Types

```typescript title="src/components/ui/step-navigation/types.ts"
import type { ReactNode } from 'react';
import type { GroupNodeWithControls, ValidationSchemaFn, FormValue } from '@reformer/core';

/**
 * Configuration for multi-step form
 */
export interface StepNavigationConfig<T extends Record<string, FormValue>> {
  totalSteps: number;
  stepValidations: Record<number, ValidationSchemaFn<T>>;
  fullValidation: ValidationSchemaFn<T>;
}

/**
 * Handle for external access via ref
 */
export interface StepNavigationHandle<T extends Record<string, FormValue>> {
  /** Current step (1-based) */
  currentStep: number;

  /** Completed steps */
  completedSteps: number[];

  /** Validate current step */
  validateCurrentStep: () => Promise<boolean>;

  /** Go to next step (with validation) */
  goToNextStep: () => Promise<boolean>;

  /** Go to previous step */
  goToPreviousStep: () => void;

  /** Go to specific step */
  goToStep: (step: number) => boolean;

  /** Submit form (with full validation) */
  submit: <R>(onSubmit: (values: T) => Promise<R> | R) => Promise<R | null>;

  /** Is first step */
  isFirstStep: boolean;

  /** Is last step */
  isLastStep: boolean;

  /** Is validating */
  isValidating: boolean;
}

/**
 * State passed to render props
 */
export interface StepNavigationRenderState {
  currentStep: number;
  completedSteps: number[];
  isFirstStep: boolean;
  isLastStep: boolean;
  isValidating: boolean;
}

/**
 * Props for StepNavigation component
 */
export interface StepNavigationProps<T extends Record<string, FormValue>> {
  form: GroupNodeWithControls<T>;
  config: StepNavigationConfig<T>;
  children: (state: StepNavigationRenderState) => ReactNode;
  onStepChange?: (step: number) => void;
  scrollToTop?: boolean;
}
```

### Implementation

```typescript title="src/components/ui/step-navigation/StepNavigation.tsx"
import { forwardRef, useImperativeHandle, useState, useCallback, useMemo } from 'react';
import { validateForm } from '@reformer/core/validators';
import type { FormValue } from '@reformer/core';
import type {
  StepNavigationHandle,
  StepNavigationProps,
  StepNavigationRenderState,
} from './types';

function StepNavigationInner<T extends Record<string, FormValue>>(
  { form, config, children, onStepChange, scrollToTop = true }: StepNavigationProps<T>,
  ref: React.ForwardedRef<StepNavigationHandle<T>>
) {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // ============================================================================
  // Validate current step
  // ============================================================================

  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    const schema = config.stepValidations[currentStep];

    if (!schema) {
      // No validation for this step (e.g., confirmation step)
      return true;
    }

    setIsValidating(true);
    try {
      return await validateForm(form, schema);
    } finally {
      setIsValidating(false);
    }
  }, [form, currentStep, config.stepValidations]);

  // ============================================================================
  // Navigation
  // ============================================================================

  const goToNextStep = useCallback(async (): Promise<boolean> => {
    const isValid = await validateCurrentStep();

    if (!isValid) {
      form.markAsTouched(); // Show errors
      return false;
    }

    // Add to completed steps
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps((prev) => [...prev, currentStep]);
    }

    // Go to next step
    if (currentStep < config.totalSteps) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      onStepChange?.(nextStep);

      if (scrollToTop) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }

    return true;
  }, [validateCurrentStep, currentStep, completedSteps, config.totalSteps, form, onStepChange, scrollToTop]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      onStepChange?.(prevStep);

      if (scrollToTop) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [currentStep, onStepChange, scrollToTop]);

  const goToStep = useCallback(
    (step: number): boolean => {
      // Can go to step 1 or if previous step is completed
      const canGoTo = step === 1 || completedSteps.includes(step - 1);

      if (canGoTo && step >= 1 && step <= config.totalSteps) {
        setCurrentStep(step);
        onStepChange?.(step);

        if (scrollToTop) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return true;
      }

      return false;
    },
    [completedSteps, config.totalSteps, onStepChange, scrollToTop]
  );

  // ============================================================================
  // Submit
  // ============================================================================

  const submit = useCallback(
    async <R,>(onSubmit: (values: T) => Promise<R> | R): Promise<R | null> => {
      setIsValidating(true);
      try {
        // Validate entire form with full schema
        const isValid = await validateForm(form, config.fullValidation);

        if (!isValid) {
          form.markAsTouched();
          return null;
        }

        // Use GroupNode's built-in submit
        return form.submit(onSubmit);
      } finally {
        setIsValidating(false);
      }
    },
    [form, config.fullValidation]
  );

  // ============================================================================
  // Computed properties
  // ============================================================================

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === config.totalSteps;

  // ============================================================================
  // Expose via ref
  // ============================================================================

  useImperativeHandle(
    ref,
    () => ({
      currentStep,
      completedSteps,
      validateCurrentStep,
      goToNextStep,
      goToPreviousStep,
      goToStep,
      submit,
      isFirstStep,
      isLastStep,
      isValidating,
    }),
    [
      currentStep,
      completedSteps,
      validateCurrentStep,
      goToNextStep,
      goToPreviousStep,
      goToStep,
      submit,
      isFirstStep,
      isLastStep,
      isValidating,
    ]
  );

  // ============================================================================
  // Render state for children
  // ============================================================================

  const renderState: StepNavigationRenderState = useMemo(
    () => ({
      currentStep,
      completedSteps,
      isFirstStep,
      isLastStep,
      isValidating,
    }),
    [currentStep, completedSteps, isFirstStep, isLastStep, isValidating]
  );

  return <>{children(renderState)}</>;
}

// Typed forwardRef for generic component
export const StepNavigation = forwardRef(StepNavigationInner) as <
  T extends Record<string, FormValue>
>(
  props: StepNavigationProps<T> & { ref?: React.ForwardedRef<StepNavigationHandle<T>> }
) => React.ReactElement;
```

### Export

```typescript title="src/components/ui/step-navigation/index.ts"
export { StepNavigation } from './StepNavigation';
export type {
  StepNavigationConfig,
  StepNavigationHandle,
  StepNavigationRenderState,
  StepNavigationProps,
} from './types';
```

## Using StepNavigation

### Basic Usage

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo, useRef } from 'react';
import { createCreditApplicationForm } from '@/forms/createCreditApplicationForm';
import { StepNavigation, type StepNavigationHandle } from '@/components/ui/step-navigation';
import { STEP_CONFIG } from '@/forms/step-config';
import type { CreditApplicationForm } from '@/types';

// Step components
import { BasicInfoForm } from '@/forms/steps/BasicInfoForm';
import { PersonalInfoForm } from '@/forms/steps/PersonalInfoForm';
import { ContactInfoForm } from '@/forms/steps/ContactInfoForm';
import { EmploymentForm } from '@/forms/steps/EmploymentForm';
import { AdditionalInfoForm } from '@/forms/steps/AdditionalInfoForm';
import { ConfirmationForm } from '@/forms/steps/ConfirmationForm';

export function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const navRef = useRef<StepNavigationHandle<CreditApplicationForm>>(null);

  const handleSubmit = async (values: CreditApplicationForm) => {
    console.log('Submitting:', values);
    await fetch('/api/applications', {
      method: 'POST',
      body: JSON.stringify(values),
    });
  };

  return (
    <StepNavigation ref={navRef} form={form} config={STEP_CONFIG}>
      {(state) => (
        <>
          {/* Step content */}
          {state.currentStep === 1 && <BasicInfoForm control={form} />}
          {state.currentStep === 2 && <PersonalInfoForm control={form} />}
          {state.currentStep === 3 && <ContactInfoForm control={form} />}
          {state.currentStep === 4 && <EmploymentForm control={form} />}
          {state.currentStep === 5 && <AdditionalInfoForm control={form} />}
          {state.currentStep === 6 && <ConfirmationForm control={form} />}

          {/* Navigation buttons */}
          <div className="flex gap-4 mt-6">
            {!state.isFirstStep && (
              <button onClick={() => navRef.current?.goToPreviousStep()}>Back</button>
            )}

            {!state.isLastStep ? (
              <button onClick={() => navRef.current?.goToNextStep()} disabled={state.isValidating}>
                {state.isValidating ? 'Validating...' : 'Next'}
              </button>
            ) : (
              <button
                onClick={() => navRef.current?.submit(handleSubmit)}
                disabled={state.isValidating}
              >
                {state.isValidating ? 'Submitting...' : 'Submit'}
              </button>
            )}
          </div>
        </>
      )}
    </StepNavigation>
  );
}
```

### Adding Step Indicators

```tsx title="src/components/StepIndicator.tsx"
interface StepIndicatorProps {
  currentStep: number;
  completedSteps: number[];
  totalSteps: number;
  labels: string[];
  onStepClick: (step: number) => void;
}

export function StepIndicator({
  currentStep,
  completedSteps,
  totalSteps,
  labels,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <div className="flex gap-2 mb-6">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isActive = currentStep === step;
        const isCompleted = completedSteps.includes(step);
        const canNavigate = step === 1 || completedSteps.includes(step - 1);

        return (
          <button
            key={step}
            onClick={() => canNavigate && onStepClick(step)}
            disabled={!canNavigate}
            className={`
              px-3 py-1.5 rounded-full text-xs font-medium
              ${isActive ? 'bg-blue-600 text-white' : ''}
              ${isCompleted && !isActive ? 'bg-green-100 text-green-800' : ''}
              ${!isActive && !isCompleted ? 'bg-gray-100 text-gray-500' : ''}
              ${canNavigate ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}
            `}
          >
            {step}. {labels[i]}
          </button>
        );
      })}
    </div>
  );
}
```

Use it with StepNavigation:

```tsx
const STEP_LABELS = ['Loan Info', 'Personal', 'Contact', 'Employment', 'Additional', 'Confirm'];

<StepNavigation ref={navRef} form={form} config={STEP_CONFIG}>
  {(state) => (
    <>
      <StepIndicator
        currentStep={state.currentStep}
        completedSteps={state.completedSteps}
        totalSteps={STEP_CONFIG.totalSteps}
        labels={STEP_LABELS}
        onStepClick={(step) => navRef.current?.goToStep(step)}
      />

      {/* ... step content ... */}
    </>
  )}
</StepNavigation>;
```

## API Reference

### `validateForm`

```typescript
function validateForm<T extends FormFields>(
  form: GroupNode<T>,
  schema: ValidationSchemaFn<T>
): Promise<boolean>;
```

| Parameter | Type                    | Description                |
| --------- | ----------------------- | -------------------------- |
| `form`    | `GroupNode<T>`          | The form to validate       |
| `schema`  | `ValidationSchemaFn<T>` | Validation schema to apply |

**Returns:** `Promise<boolean>` - `true` if valid, `false` if errors

### `StepNavigationHandle`

Methods and properties exposed via ref:

| Property/Method         | Type                 | Description                     |
| ----------------------- | -------------------- | ------------------------------- |
| `currentStep`           | `number`             | Current step (1-based)          |
| `completedSteps`        | `number[]`           | Array of completed step numbers |
| `isFirstStep`           | `boolean`            | Is on first step                |
| `isLastStep`            | `boolean`            | Is on last step                 |
| `isValidating`          | `boolean`            | Validation in progress          |
| `goToNextStep()`        | `Promise<boolean>`   | Validate and go to next step    |
| `goToPreviousStep()`    | `void`               | Go to previous step             |
| `goToStep(step)`        | `boolean`            | Go to specific step             |
| `validateCurrentStep()` | `Promise<boolean>`   | Validate current step           |
| `submit(onSubmit)`      | `Promise<R \| null>` | Full validation and submit      |

### `StepNavigationRenderState`

State passed to children render function:

| Property         | Type       | Description            |
| ---------------- | ---------- | ---------------------- |
| `currentStep`    | `number`   | Current step (1-based) |
| `completedSteps` | `number[]` | Completed step numbers |
| `isFirstStep`    | `boolean`  | Is on first step       |
| `isLastStep`     | `boolean`  | Is on last step        |
| `isValidating`   | `boolean`  | Validation in progress |

## Key Patterns

### 1. Ref Handle Pattern

External access to component methods:

```tsx
const navRef = useRef<StepNavigationHandle<MyForm>>(null);

// Use methods
navRef.current?.goToNextStep();
navRef.current?.submit(handleSubmit);

// Read state
const step = navRef.current?.currentStep;
```

### 2. Render Props Pattern

State passed through children function:

```tsx
<StepNavigation ...>
  {(state) => (
    <div>Current step: {state.currentStep}</div>
  )}
</StepNavigation>
```

### 3. Step Validation Isolation

Each step validates independently:

```typescript
// Step 1 validation doesn't trigger Step 2 validators
const isValid = await validateForm(form, loanValidation);
```

### 4. Full Validation on Submit

Final submit uses complete schema:

```typescript
const isValid = await validateForm(form, config.fullValidation);
```

## Complete Example

Here's a full working example putting it all together:

```tsx title="src/pages/CreditApplication.tsx"
import { useMemo, useRef } from 'react';
import { createCreditApplicationForm } from '@/forms/createCreditApplicationForm';
import { StepNavigation, type StepNavigationHandle } from '@/components/ui/step-navigation';
import { StepIndicator } from '@/components/StepIndicator';
import { STEP_CONFIG, STEP_LABELS } from '@/forms/step-config';
import type { CreditApplicationForm } from '@/types';

// Steps
import { BasicInfoForm } from '@/forms/steps/BasicInfoForm';
import { PersonalInfoForm } from '@/forms/steps/PersonalInfoForm';
import { ContactInfoForm } from '@/forms/steps/ContactInfoForm';
import { EmploymentForm } from '@/forms/steps/EmploymentForm';
import { AdditionalInfoForm } from '@/forms/steps/AdditionalInfoForm';
import { ConfirmationForm } from '@/forms/steps/ConfirmationForm';

export default function CreditApplicationPage() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const navRef = useRef<StepNavigationHandle<CreditApplicationForm>>(null);

  const handleSubmit = async (values: CreditApplicationForm) => {
    const response = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      throw new Error('Failed to submit');
    }

    return response.json();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Credit Application</h1>

      <StepNavigation
        ref={navRef}
        form={form}
        config={STEP_CONFIG}
        onStepChange={(step) => console.log('Step changed to:', step)}
      >
        {(state) => (
          <>
            {/* Step indicator */}
            <StepIndicator
              currentStep={state.currentStep}
              completedSteps={state.completedSteps}
              totalSteps={STEP_CONFIG.totalSteps}
              labels={STEP_LABELS}
              onStepClick={(step) => navRef.current?.goToStep(step)}
            />

            {/* Step content */}
            <div className="bg-white rounded-lg shadow p-6 min-h-[400px]">
              {state.currentStep === 1 && <BasicInfoForm control={form} />}
              {state.currentStep === 2 && <PersonalInfoForm control={form} />}
              {state.currentStep === 3 && <ContactInfoForm control={form} />}
              {state.currentStep === 4 && <EmploymentForm control={form} />}
              {state.currentStep === 5 && <AdditionalInfoForm control={form} />}
              {state.currentStep === 6 && <ConfirmationForm control={form} />}
            </div>

            {/* Navigation */}
            <div className="flex justify-between mt-6">
              <button
                onClick={() => navRef.current?.goToPreviousStep()}
                disabled={state.isFirstStep}
                className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
              >
                Back
              </button>

              {!state.isLastStep ? (
                <button
                  onClick={() => navRef.current?.goToNextStep()}
                  disabled={state.isValidating}
                  className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                >
                  {state.isValidating ? 'Validating...' : 'Next'}
                </button>
              ) : (
                <button
                  onClick={async () => {
                    const result = await navRef.current?.submit(handleSubmit);
                    if (result) {
                      alert('Application submitted successfully!');
                    }
                  }}
                  disabled={state.isValidating}
                  className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
                >
                  {state.isValidating ? 'Submitting...' : 'Submit Application'}
                </button>
              )}
            </div>
          </>
        )}
      </StepNavigation>
    </div>
  );
}
```

## Summary

The `StepNavigation` component provides:

- **Step-by-step validation** using `validateForm`
- **Progress tracking** with completed steps
- **Navigation control** via ref handle pattern
- **Render props** for flexible UI

Key benefits:

1. **Separation of concerns** - Validation logic is in schemas, navigation in component
2. **Reusability** - Works with any form that has step-based validation
3. **Type safety** - Full TypeScript support with generics
4. **Flexibility** - Render any UI through children function

## What's Next?

Now that validation and navigation are complete, the next sections cover:

- **Data Flow** - Loading, saving, and resetting form data
- **Submission** - Handling form submission, errors, and retries

---
sidebar_position: 1
---

# Base Component

Creating the main form component with step navigation.

## Overview

The base component is the entry point for our multi-step form. It:

- Creates and manages the form instance
- Handles step navigation
- Renders the current step
- Manages form submission

## Creating the Form Instance

First, create the form instance using `useMemo` to prevent recreation on each render:

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo } from 'react';
import { createCreditApplicationForm } from './schemas/create-credit-application-form';

function CreditApplicationForm() {
  // Create form instance once
  const form = useMemo(() => createCreditApplicationForm(), []);

  // ...
}
```

:::warning Important
Always wrap form creation in `useMemo`. Without it, the form would be recreated on every render, losing all user input.
:::

## Step Navigation

For multi-step forms, you need to track the current step and provide navigation:

```tsx
import { useState } from 'react';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;

  const goToNextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // ...
}
```

## Rendering Steps

Render the appropriate step component based on `currentStep`:

```tsx
import { BasicInfoForm } from './steps/BasicInfoForm';
import { PersonalInfoForm } from './steps/PersonalInfoForm';
import { ContactInfoForm } from './steps/ContactInfoForm';
import { EmploymentForm } from './steps/EmploymentForm';
import { AdditionalInfoForm } from './steps/AdditionalInfoForm';
import { ConfirmationForm } from './steps/ConfirmationForm';

function CreditApplicationForm() {
  // ... form and state setup

  return (
    <div>
      {/* Step indicator */}
      <div className="mb-6">
        Step {currentStep} of {totalSteps}
      </div>

      {/* Current step content */}
      <div className="bg-white p-6 rounded-lg shadow">
        {currentStep === 1 && <BasicInfoForm control={form} />}
        {currentStep === 2 && <PersonalInfoForm control={form} />}
        {currentStep === 3 && <ContactInfoForm control={form} />}
        {currentStep === 4 && <EmploymentForm control={form} />}
        {currentStep === 5 && <AdditionalInfoForm control={form} />}
        {currentStep === 6 && <ConfirmationForm control={form} />}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between mt-6">
        <button
          onClick={goToPreviousStep}
          disabled={currentStep === 1}
        >
          Previous
        </button>

        {currentStep < totalSteps ? (
          <button onClick={goToNextStep}>
            Next
          </button>
        ) : (
          <button onClick={handleSubmit}>
            Submit
          </button>
        )}
      </div>
    </div>
  );
}
```

## Passing Form to Steps

Each step component receives the entire form as a `control` prop:

```tsx
interface StepProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

function BasicInfoForm({ control }: StepProps) {
  return (
    <div>
      <FormField control={control.loanType} />
      <FormField control={control.loanAmount} />
      {/* ... */}
    </div>
  );
}
```

This approach:
- Gives each step access to all form fields
- Enables cross-step dependencies (e.g., showing fields based on values from other steps)
- Keeps a single source of truth for form state

## Form Submission

Handle form submission when the user completes all steps:

```tsx
function CreditApplicationForm() {
  // ... form and state setup

  const handleSubmit = async () => {
    // Get all form values
    const values = form.getValue();

    try {
      // Send to server
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        alert('Application submitted successfully!');
      }
    } catch (error) {
      console.error('Submission failed:', error);
    }
  };

  // ...
}
```

## Complete Example

Here's the complete base component:

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo, useState } from 'react';
import type { GroupNodeWithControls } from 'reformer';
import { createCreditApplicationForm } from './schemas/create-credit-application-form';
import type { CreditApplicationForm } from './types';

// Step components
import { BasicInfoForm } from './steps/BasicInfoForm';
import { PersonalInfoForm } from './steps/PersonalInfoForm';
import { ContactInfoForm } from './steps/ContactInfoForm';
import { EmploymentForm } from './steps/EmploymentForm';
import { AdditionalInfoForm } from './steps/AdditionalInfoForm';
import { ConfirmationForm } from './steps/ConfirmationForm';

const STEPS = [
  { id: 1, title: 'Loan Info' },
  { id: 2, title: 'Personal' },
  { id: 3, title: 'Contact' },
  { id: 4, title: 'Employment' },
  { id: 5, title: 'Additional' },
  { id: 6, title: 'Confirmation' },
];

function CreditApplicationForm() {
  // Create form instance
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Step navigation state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = STEPS.length;

  // Navigation handlers
  const goToNextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step: number) => {
    if (step >= 1 && step <= totalSteps) {
      setCurrentStep(step);
    }
  };

  // Form submission
  const handleSubmit = async () => {
    const values = form.getValue();

    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Application submitted! ID: ${data.id}`);
      }
    } catch (error) {
      console.error('Submission failed:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Step indicator */}
      <div className="flex justify-between mb-8">
        {STEPS.map((step) => (
          <button
            key={step.id}
            onClick={() => goToStep(step.id)}
            className={`px-4 py-2 rounded ${
              currentStep === step.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {step.id}. {step.title}
          </button>
        ))}
      </div>

      {/* Current step content */}
      <div className="bg-white p-8 rounded-lg shadow-md">
        {currentStep === 1 && <BasicInfoForm control={form} />}
        {currentStep === 2 && <PersonalInfoForm control={form} />}
        {currentStep === 3 && <ContactInfoForm control={form} />}
        {currentStep === 4 && <EmploymentForm control={form} />}
        {currentStep === 5 && <AdditionalInfoForm control={form} />}
        {currentStep === 6 && <ConfirmationForm control={form} />}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between mt-6">
        <button
          onClick={goToPreviousStep}
          disabled={currentStep === 1}
          className="px-6 py-2 bg-gray-300 rounded disabled:opacity-50"
        >
          Previous
        </button>

        {currentStep < totalSteps ? (
          <button
            onClick={goToNextStep}
            className="px-6 py-2 bg-blue-600 text-white rounded"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-green-600 text-white rounded"
          >
            Submit Application
          </button>
        )}
      </div>

      {/* Progress info */}
      <div className="mt-4 text-center text-sm text-gray-600">
        Step {currentStep} of {totalSteps} • {Math.round((currentStep / totalSteps) * 100)}% complete
      </div>
    </div>
  );
}

export default CreditApplicationForm;
```

## Next Steps

Now that we have the base component, let's create the individual step components that render the form fields.

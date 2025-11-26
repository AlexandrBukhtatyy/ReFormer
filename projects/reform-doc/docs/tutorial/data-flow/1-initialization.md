---
sidebar_position: 1
---

# Form Initialization

Loading and initializing form data from various sources.

## Overview

Forms often need to be initialized with existing data:

- **Edit mode** - Load existing credit application for editing
- **Draft recovery** - Restore previously saved draft
- **Partial pre-fill** - Pre-populate some fields (e.g., from user profile)
- **Default values** - Set initial values in schema

## Setting Initial Values in Schema

The simplest way to initialize is through the schema's `value` property:

```typescript title="src/schemas/credit-application-schema.ts"
import type { FormSchema } from 'reformer';

interface CreditApplicationForm {
  loanType: 'consumer' | 'mortgage' | 'car';
  loanAmount: number;
  loanTerm: number;
  monthlyIncome: number;
}

export const creditApplicationSchema: FormSchema<CreditApplicationForm> = {
  loanType: {
    value: 'consumer', // Default value
    component: Select,
    componentProps: {
      label: 'Loan Type',
      options: [
        { value: 'consumer', label: 'Consumer Loan' },
        { value: 'mortgage', label: 'Mortgage' },
        { value: 'car', label: 'Car Loan' },
      ],
    },
  },
  loanAmount: {
    value: 100000, // Default 100,000
    component: Input,
    componentProps: {
      label: 'Loan Amount',
      type: 'number',
    },
  },
  loanTerm: {
    value: 12, // Default 12 months
    component: Input,
    componentProps: {
      label: 'Term (months)',
      type: 'number',
    },
  },
  monthlyIncome: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Monthly Income',
      type: 'number',
    },
  },
};
```

## setValue - Complete Replacement

Use `setValue` to replace the entire form value:

```typescript title="src/components/CreditApplicationForm.tsx"
import { useEffect } from 'react';
import { createCreditApplicationForm } from '../schemas/create-form';

interface CreditApplicationFormProps {
  applicationId?: string;
}

function CreditApplicationForm({ applicationId }: CreditApplicationFormProps) {
  const form = useMemo(() => createCreditApplicationForm(), []);

  useEffect(() => {
    if (applicationId) {
      // Load existing application
      loadApplication(applicationId).then((data) => {
        // Replace entire form value
        form.setValue(data);
      });
    }
  }, [applicationId, form]);

  return (
    // ... form UI
  );
}

async function loadApplication(id: string) {
  const response = await fetch(`/api/applications/${id}`);
  return response.json();
}
```

### setValue with Options

Control how the value is set:

```typescript
// Silently set value without marking as touched
form.setValue(data, { markAsTouched: false });

// Set value and emit events
form.setValue(data, { emitEvent: true });

// Set value without triggering validation
form.setValue(data, { validate: false });
```

## patchValue - Partial Update

Use `patchValue` to update only specific fields:

```typescript title="src/components/ApplicantInfoStep.tsx"
import { useEffect } from 'react';

function ApplicantInfoStep({ form }: ApplicantInfoStepProps) {
  useEffect(() => {
    // Pre-fill from user profile
    const userProfile = getCurrentUserProfile();

    if (userProfile) {
      // Only update personal info fields
      form.patchValue({
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        middleName: userProfile.middleName,
        birthDate: userProfile.birthDate,
        email: userProfile.email,
        phoneMain: userProfile.phone,
      });
    }
  }, [form]);

  return (
    // ... step UI
  );
}
```

### Nested Object Updates

Update nested objects partially:

```typescript
// Update only city in registration address
form.patchValue({
  registrationAddress: {
    city: 'Москва',
  },
});

// Other address fields remain unchanged
```

### Array Updates

Update specific array items:

```typescript
// Update first co-borrower's income
form.patchValue({
  coBorrowers: [
    { monthlyIncome: 50000 }, // First item
    undefined, // Skip second item
    { monthlyIncome: 60000 }, // Third item
  ],
});
```

## Loading from API

### Simple Load

```typescript title="src/hooks/useLoadApplication.ts"
import { useEffect, useState } from 'react';
import type { FormNode } from 'reformer';

export function useLoadApplication(
  form: FormNode<CreditApplicationForm>,
  applicationId?: string
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!applicationId) return;

    setLoading(true);
    setError(null);

    fetch(`/api/applications/${applicationId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load application');
        return res.json();
      })
      .then((data) => {
        form.setValue(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [applicationId, form]);

  return { loading, error };
}
```

Usage:

```typescript
function CreditApplicationForm({ applicationId }: Props) {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const { loading, error } = useLoadApplication(form, applicationId);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return <FormContent form={form} />;
}
```

### Load with Transform

Transform API data before setting:

```typescript title="src/utils/transform-application.ts"
interface ApiApplication {
  id: string;
  loan_amount: number; // snake_case from API
  loan_term: number;
  applicant: {
    first_name: string;
    last_name: string;
    birth_date: string;
  };
}

export function transformApiToForm(
  apiData: ApiApplication
): Partial<CreditApplicationForm> {
  return {
    loanAmount: apiData.loan_amount,
    loanTerm: apiData.loan_term,
    firstName: apiData.applicant.first_name,
    lastName: apiData.applicant.last_name,
    birthDate: apiData.applicant.birth_date,
  };
}

// Usage
loadApplication(id).then((apiData) => {
  const formData = transformApiToForm(apiData);
  form.setValue(formData);
});
```

## Draft Auto-Save and Recovery

### Save Draft

```typescript title="src/hooks/useAutoSaveDraft.ts"
import { useEffect } from 'react';
import { debounce } from 'lodash';

export function useAutoSaveDraft(
  form: FormNode<CreditApplicationForm>,
  draftKey: string
) {
  useEffect(() => {
    // Debounced save function
    const saveDraft = debounce(() => {
      const value = form.value.value;
      localStorage.setItem(draftKey, JSON.stringify(value));
      console.log('Draft saved');
    }, 1000);

    // Subscribe to form changes
    const subscription = form.value.subscribe(() => {
      saveDraft();
    });

    return () => {
      subscription.unsubscribe();
      saveDraft.cancel();
    };
  }, [form, draftKey]);
}
```

### Recover Draft

```typescript title="src/components/CreditApplicationForm.tsx"
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [draftData, setDraftData] = useState<CreditApplicationForm | null>(null);

  useEffect(() => {
    // Check for saved draft
    const savedDraft = localStorage.getItem('credit-application-draft');

    if (savedDraft) {
      try {
        const data = JSON.parse(savedDraft);
        setDraftData(data);
        setShowDraftPrompt(true);
      } catch (error) {
        console.error('Failed to parse draft', error);
      }
    }
  }, []);

  const handleRestoreDraft = () => {
    if (draftData) {
      form.setValue(draftData);
      setShowDraftPrompt(false);
    }
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem('credit-application-draft');
    setShowDraftPrompt(false);
  };

  // Auto-save draft
  useAutoSaveDraft(form, 'credit-application-draft');

  return (
    <>
      {showDraftPrompt && (
        <DraftPrompt
          onRestore={handleRestoreDraft}
          onDiscard={handleDiscardDraft}
        />
      )}
      <FormContent form={form} />
    </>
  );
}
```

## Conditional Initialization

### Based on User Type

```typescript
function CreditApplicationForm({ userType }: Props) {
  const form = useMemo(() => createCreditApplicationForm(), []);

  useEffect(() => {
    if (userType === 'returning') {
      // Pre-fill from previous application
      loadPreviousApplication().then((data) => {
        form.patchValue({
          firstName: data.firstName,
          lastName: data.lastName,
          middleName: data.middleName,
          email: data.email,
          phoneMain: data.phoneMain,
        });
      });
    } else if (userType === 'employee') {
      // Pre-select specific loan type for employees
      form.patchValue({
        loanType: 'consumer',
        employmentStatus: 'employed',
      });
    }
  }, [form, userType]);

  return <FormContent form={form} />;
}
```

### Based on URL Parameters

```typescript
import { useSearchParams } from 'react-router-dom';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Pre-fill from URL params
    const loanType = searchParams.get('loanType');
    const amount = searchParams.get('amount');

    if (loanType || amount) {
      form.patchValue({
        loanType: loanType as any,
        loanAmount: amount ? parseInt(amount) : undefined,
      });
    }
  }, [form, searchParams]);

  return <FormContent form={form} />;
}
```

## Best Practices

### 1. Use setValue for Complete Data

```typescript
// ✅ Use setValue when loading complete application
loadApplication(id).then((data) => {
  form.setValue(data);
});

// ❌ Don't use patchValue for complete replacement
loadApplication(id).then((data) => {
  form.patchValue(data); // May leave old data in untouched fields
});
```

### 2. Use patchValue for Partial Updates

```typescript
// ✅ Use patchValue for partial updates
form.patchValue({
  loanAmount: 150000,
});

// ❌ Don't use setValue for partial updates
form.setValue({
  loanAmount: 150000,
  // All other fields will be undefined!
});
```

### 3. Transform API Data

```typescript
// ✅ Transform before setting
const formData = transformApiToForm(apiData);
form.setValue(formData);

// ❌ Don't set API data directly
form.setValue(apiData); // Field names may not match
```

### 4. Handle Loading States

```typescript
// ✅ Show loading indicator
if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage />;
return <FormContent form={form} />;

// ❌ Don't show form while loading
return (
  <>
    {loading && <LoadingSpinner />}
    <FormContent form={form} /> {/* Shows empty form during load */}
  </>
);
```

### 5. Validate After Loading

```typescript
// ✅ Optionally validate after setting data
form.setValue(data);
await form.validate();

// Check if loaded data is valid
if (!form.valid.value) {
  console.warn('Loaded application has validation errors');
}
```

## Common Patterns

### Edit vs Create Mode

```typescript
interface FormProps {
  mode: 'create' | 'edit';
  applicationId?: string;
}

function CreditApplicationForm({ mode, applicationId }: FormProps) {
  const form = useMemo(() => createCreditApplicationForm(), []);

  useEffect(() => {
    if (mode === 'edit' && applicationId) {
      loadApplication(applicationId).then((data) => {
        form.setValue(data);
      });
    } else {
      // Create mode - use defaults from schema
      // Or pre-fill from user profile
      const profile = getUserProfile();
      if (profile) {
        form.patchValue({
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
        });
      }
    }
  }, [mode, applicationId, form]);

  return <FormContent form={form} />;
}
```

### Multi-Step with Progress Persistence

```typescript
function MultiStepForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [currentStep, setCurrentStep] = useState(1);

  // Save progress on each step
  const handleNextStep = async () => {
    await form.validate();

    if (form.valid.value) {
      // Save current state
      await saveProgress(form.value.value);
      setCurrentStep((prev) => prev + 1);
    }
  };

  // Load progress on mount
  useEffect(() => {
    loadProgress().then((data) => {
      if (data) {
        form.setValue(data.formData);
        setCurrentStep(data.step);
      }
    });
  }, [form]);

  return (
    <Stepper currentStep={currentStep}>
      {/* Step components */}
    </Stepper>
  );
}
```

## Next Step

Now that you understand form initialization, let's learn how to reset forms and restore default values.

---
sidebar_position: 2
---

# Data Transformation

Converting data between form format and API format.

## Overview

Our credit application form uses JavaScript types like `Date` objects, but APIs typically work with strings. We need transformation functions:

- **Deserialize**: API → Form (when loading)
- **Serialize**: Form → API (when saving)

## Date Transformers

The form uses `Date` objects for `personalData.birthDate` and `passportData.issueDate`:

```typescript title="src/forms/credit-application/utils/transformers.ts"
// API → Form: ISO string to Date
export function deserializeDate(isoString: string | null): Date | null {
  if (!isoString) return null;
  return new Date(isoString);
}

// Form → API: Date to ISO string
export function serializeDate(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString().split('T')[0]; // "2024-01-15"
}
```

## Complete Transformer Module

```typescript title="src/forms/credit-application/utils/formTransformers.ts"
import type { CreditApplicationForm } from '../types/credit-application.types';

// API response type (what comes from server)
interface ApiApplicationData {
  loanType: string;
  loanAmount: number;
  loanTerm: number;
  loanPurpose: string;
  personalData: {
    lastName: string;
    firstName: string;
    middleName: string;
    birthDate: string; // ISO string from API
    birthPlace: string;
    gender: string;
  };
  passportData: {
    series: string;
    number: string;
    issueDate: string; // ISO string from API
    issuedBy: string;
    departmentCode: string;
  };
  email: string;
  phoneMain: string;
  // ... other fields
}

// Deserialize: API → Form
export function deserializeApplication(
  api: ApiApplicationData
): Partial<CreditApplicationForm> {
  return {
    loanType: api.loanType as CreditApplicationForm['loanType'],
    loanAmount: api.loanAmount,
    loanTerm: api.loanTerm,
    loanPurpose: api.loanPurpose,
    personalData: {
      ...api.personalData,
      birthDate: new Date(api.personalData.birthDate),
    },
    passportData: {
      ...api.passportData,
      issueDate: new Date(api.passportData.issueDate),
    },
    email: api.email,
    phoneMain: api.phoneMain,
  };
}

// Serialize: Form → API
export function serializeApplication(
  form: CreditApplicationForm
): ApiApplicationData {
  return {
    loanType: form.loanType,
    loanAmount: form.loanAmount,
    loanTerm: form.loanTerm,
    loanPurpose: form.loanPurpose,
    personalData: {
      ...form.personalData,
      birthDate: form.personalData.birthDate?.toISOString().split('T')[0] ?? '',
    },
    passportData: {
      ...form.passportData,
      issueDate: form.passportData.issueDate?.toISOString().split('T')[0] ?? '',
    },
    email: form.email,
    phoneMain: form.phoneMain,
  };
}
```

## Using Transformers

### When Loading Data

```typescript title="src/forms/credit-application/services/api.ts"
import { deserializeApplication } from '../utils/formTransformers';

export async function fetchApplication(id: string) {
  const response = await fetch(`/api/applications/${id}`);
  const apiData = await response.json();

  // Transform API data to form format
  return deserializeApplication(apiData);
}
```

### When Saving Data

```typescript title="src/forms/credit-application/CreditApplicationForm.tsx"
import { serializeApplication } from './utils/formTransformers';

const handleSubmit = async () => {
  const formData = form.getValue();

  // Transform form data to API format
  const apiData = serializeApplication(formData);

  await fetch('/api/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(apiData),
  });
};
```

## Using in Component

```tsx title="src/forms/credit-application/CreditApplicationForm.tsx"
import { useMemo, useEffect, useState } from 'react';
import { createCreditApplicationForm } from './createCreditApplicationForm';
import { deserializeApplication, serializeApplication } from './utils/formTransformers';

interface Props {
  applicationId?: string;
}

export function ApplicationForm({ applicationId }: Props) {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [isLoading, setIsLoading] = useState(!!applicationId);

  // Load and deserialize
  useEffect(() => {
    if (!applicationId) return;

    async function load() {
      const response = await fetch(`/api/applications/${applicationId}`);
      const apiData = await response.json();

      // Deserialize: API → Form
      const formData = deserializeApplication(apiData);
      form.patchValue(formData);

      setIsLoading(false);
    }

    load();
  }, [form, applicationId]);

  // Serialize and save
  const handleSubmit = async () => {
    const formData = form.getValue();

    // Serialize: Form → API
    const apiData = serializeApplication(formData);

    await fetch('/api/applications', {
      method: applicationId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiData),
    });
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      {/* Form fields */}
      <button type="submit">Save</button>
    </form>
  );
}
```

## Common Transformations

### Phone Number

```typescript
// Clean phone for API (digits only)
export function serializePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

// Format for display
export function deserializePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
  }
  return phone;
}
```

### Passport Data

```typescript
// Format passport series and number
export function formatPassport(series: string, number: string): string {
  return `${series} ${number}`;
}

// Parse passport string
export function parsePassport(passport: string): { series: string; number: string } {
  const [series, number] = passport.split(' ');
  return { series: series || '', number: number || '' };
}
```

## Key Points

1. **Keep transformers pure** - no side effects, just data conversion
2. **Handle null/undefined** - always check for missing values
3. **Type your transformers** - use TypeScript for API and form types
4. **Centralize transformers** - keep all transformations in one place
5. **Test transformers** - they're easy to unit test

## Next Steps

- [Validation and Saving](./3-validation-and-saving.md) - Complete the flow with validation and submission

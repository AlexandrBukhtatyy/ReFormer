---
sidebar_position: 7
---

# Data Transformation

Converting data between form and API formats.

## What We're Building

A bidirectional data transformation system:

- **Serialize** - Transform form data for API (Form → API)
- **Deserialize** - Transform API data for form (API → Form)
- **Date handling** - Convert between Date objects and ISO strings
- **Normalization** - Clean and format data
- **Computed fields** - Remove calculated values
- **Custom transforms** - Domain-specific conversions

## Why Transform Data?

Forms and APIs often use different formats:

| Form Format | API Format | Reason |
|-------------|------------|--------|
| `Date` object | ISO string | JSON serialization |
| `"+7 (999) 123-45-67"` | `"79991234567"` | Storage format |
| `"John Doe"` (computed) | Not sent | Computed field |
| `null` values | Not sent | Clean payload |
| Nested objects | Flat structure | API design |

## Data Transformer Interface

Define the transformer interface:

```typescript title="src/types/transformer.types.ts"
/**
 * Data transformer interface
 */
export interface DataTransformer<TForm = any, TApi = any> {
  /**
   * Transform form data to API format
   */
  serialize: (formData: TForm) => TApi;

  /**
   * Transform API data to form format
   */
  deserialize: (apiData: TApi) => TForm;
}

/**
 * Transformation options
 */
export interface TransformOptions {
  /** Remove null values */
  removeNulls?: boolean;
  /** Remove undefined values */
  removeUndefined?: boolean;
  /** Remove empty strings */
  removeEmptyStrings?: boolean;
  /** Remove computed fields */
  removeComputed?: boolean;
  /** Fields to exclude */
  exclude?: string[];
  /** Fields to include (if specified, only these are included) */
  include?: string[];
}
```

## Creating the Base Transformer

Create utility functions for common transformations:

```bash
touch src/services/data-transform.service.ts
```

### Implementation

```typescript title="src/services/data-transform.service.ts"
import type { TransformOptions } from '@/types/transformer.types';

/**
 * Remove empty/null/undefined values from object
 */
export function removeEmptyValues(
  obj: any,
  options: TransformOptions = {}
): any {
  const {
    removeNulls = true,
    removeUndefined = true,
    removeEmptyStrings = false,
  } = options;

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeEmptyValues(item, options));
  }

  if (typeof obj === 'object') {
    const result: any = {};

    for (const key in obj) {
      const value = obj[key];

      // Skip based on options
      if (removeNulls && value === null) continue;
      if (removeUndefined && value === undefined) continue;
      if (removeEmptyStrings && value === '') continue;

      result[key] = removeEmptyValues(value, options);
    }

    return result;
  }

  return obj;
}

/**
 * Convert Date objects to ISO strings
 */
export function datesToISOStrings(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (Array.isArray(obj)) {
    return obj.map(item => datesToISOStrings(item));
  }

  if (typeof obj === 'object') {
    const result: any = {};

    for (const key in obj) {
      result[key] = datesToISOStrings(obj[key]);
    }

    return result;
  }

  return obj;
}

/**
 * Convert ISO strings to Date objects
 */
export function isoStringsToDates(obj: any, dateFields: string[] = []): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => isoStringsToDates(item, dateFields));
  }

  if (typeof obj === 'object') {
    const result: any = {};

    for (const key in obj) {
      const value = obj[key];

      // Check if this field should be converted to Date
      if (dateFields.includes(key) && typeof value === 'string') {
        try {
          result[key] = new Date(value);
        } catch {
          result[key] = value;
        }
      } else {
        result[key] = isoStringsToDates(value, dateFields);
      }
    }

    return result;
  }

  return obj;
}

/**
 * Exclude fields from object
 */
export function excludeFields(obj: any, fields: string[]): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result: any = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (!fields.includes(key)) {
      result[key] = obj[key];
    }
  }

  return result;
}

/**
 * Include only specified fields
 */
export function includeFields(obj: any, fields: string[]): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result: any = {};

  for (const field of fields) {
    if (field in obj) {
      result[field] = obj[field];
    }
  }

  return result;
}

/**
 * Normalize phone number (remove formatting)
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Format phone number for display
 */
export function formatPhone(phone: string): string {
  const cleaned = normalizePhone(phone);

  if (cleaned.length === 11 && cleaned.startsWith('7')) {
    return `+${cleaned[0]} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`;
  }

  if (cleaned.length === 10) {
    return `+7 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 8)}-${cleaned.slice(8)}`;
  }

  return phone;
}

/**
 * Normalize email (lowercase, trim)
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Trim all string values in object
 */
export function trimStrings(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return obj.trim();
  }

  if (Array.isArray(obj)) {
    return obj.map(item => trimStrings(item));
  }

  if (typeof obj === 'object') {
    const result: any = {};

    for (const key in obj) {
      result[key] = trimStrings(obj[key]);
    }

    return result;
  }

  return obj;
}
```

## Creating Credit Application Transformer

Create a transformer specific to the credit application:

```typescript title="src/services/transformers/credit-application.transformer.ts"
import type { DataTransformer } from '@/types/transformer.types';
import {
  removeEmptyValues,
  datesToISOStrings,
  isoStringsToDates,
  excludeFields,
  normalizePhone,
  formatPhone,
  normalizeEmail,
  trimStrings,
} from '@/services/data-transform.service';

/**
 * List of computed/calculated fields that shouldn't be sent to API
 */
const COMPUTED_FIELDS = [
  'fullName',
  'age',
  'monthlyPayment',
  'totalPayment',
  'interestRate',
  'totalIncome',
  'coBorrowersIncome',
  'paymentToIncomeRatio',
  'debtToIncomeRatio',
];

/**
 * Date fields that need conversion
 */
const DATE_FIELDS = [
  'birthDate',
  'issueDate',
  'startDate',
  'endDate',
];

/**
 * Credit application data transformer
 */
export const creditApplicationTransformer: DataTransformer = {
  /**
   * Serialize: Form → API
   */
  serialize: (formData: any) => {
    // Start with form data
    let data = { ...formData };

    // 1. Trim all strings
    data = trimStrings(data);

    // 2. Normalize email
    if (data.email) {
      data.email = normalizeEmail(data.email);
    }

    // 3. Normalize phones
    if (data.phoneMain) {
      data.phoneMain = normalizePhone(data.phoneMain);
    }
    if (data.phoneAdditional) {
      data.phoneAdditional = normalizePhone(data.phoneAdditional);
    }

    // 4. Convert dates to ISO strings
    data = datesToISOStrings(data);

    // 5. Remove computed fields
    data = excludeFields(data, COMPUTED_FIELDS);

    // 6. Remove empty values
    data = removeEmptyValues(data, {
      removeNulls: true,
      removeUndefined: true,
      removeEmptyStrings: true,
    });

    return data;
  },

  /**
   * Deserialize: API → Form
   */
  deserialize: (apiData: any) => {
    // Start with API data
    let data = { ...apiData };

    // 1. Convert ISO strings to Date objects
    data = convertDatesInObject(data);

    // 2. Format phones for display
    if (data.phoneMain) {
      data.phoneMain = formatPhone(data.phoneMain);
    }
    if (data.phoneAdditional) {
      data.phoneAdditional = formatPhone(data.phoneAdditional);
    }

    // 3. Ensure nested objects exist
    data.personalData = data.personalData || {};
    data.passportData = data.passportData || {};
    data.registrationAddress = data.registrationAddress || {};
    data.employment = data.employment || {};

    return data;
  },
};

/**
 * Convert date fields in nested object
 */
function convertDatesInObject(obj: any, path: string = ''): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) =>
      convertDatesInObject(item, `${path}[${index}]`)
    );
  }

  if (typeof obj === 'object') {
    const result: any = {};

    for (const key in obj) {
      const value = obj[key];
      const fieldPath = path ? `${path}.${key}` : key;

      // Check if this field or its parent is a date field
      const isDateField = DATE_FIELDS.some(dateField =>
        fieldPath.includes(dateField)
      );

      if (isDateField && typeof value === 'string') {
        try {
          result[key] = new Date(value);
        } catch {
          result[key] = value;
        }
      } else {
        result[key] = convertDatesInObject(value, fieldPath);
      }
    }

    return result;
  }

  return obj;
}
```

## Creating Custom Transformers

Create transformers for specific scenarios:

```typescript title="src/services/transformers/draft.transformer.ts"
import type { DataTransformer } from '@/types/transformer.types';
import { datesToISOStrings, isoStringsToDates } from '@/services/data-transform.service';

/**
 * Draft transformer (keeps all data including computed fields)
 */
export const draftTransformer: DataTransformer = {
  serialize: (formData: any) => {
    // Keep everything, just convert dates
    return datesToISOStrings(formData);
  },

  deserialize: (draftData: any) => {
    // Convert dates back
    return isoStringsToDates(draftData, [
      'birthDate',
      'issueDate',
      'startDate',
      'endDate',
    ]);
  },
};
```

```typescript title="src/services/transformers/submission.transformer.ts"
import type { DataTransformer } from '@/types/transformer.types';
import { creditApplicationTransformer } from './credit-application.transformer';

/**
 * Submission transformer (extra validation and cleanup)
 */
export const submissionTransformer: DataTransformer = {
  serialize: (formData: any) => {
    // Use base transformer
    let data = creditApplicationTransformer.serialize(formData);

    // Add submission metadata
    data = {
      ...data,
      submittedAt: new Date().toISOString(),
      version: '1.0',
    };

    // Remove draft-only fields
    delete data.draftId;
    delete data.autoSavedAt;

    return data;
  },

  deserialize: (apiData: any) => {
    return creditApplicationTransformer.deserialize(apiData);
  },
};
```

## Using Transformers with Data Loading

Integrate with data loading:

```typescript title="src/hooks/useDataLoader.ts"
import { creditApplicationTransformer } from '@/services/transformers/credit-application.transformer';

export function useDataLoader(form: FormNode, applicationId?: string) {
  const [state, setState] = useState<LoadingState>('idle');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!applicationId) return;

    setState('loading');

    loadApplication(applicationId)
      .then((apiData) => {
        // Deserialize API data
        const formData = creditApplicationTransformer.deserialize(apiData);

        // Patch form
        form.patchValue(formData);

        setState('success');
      })
      .catch((err) => {
        setError(err);
        setState('error');
      });
  }, [applicationId, form]);

  return { state, loading: state === 'loading', error };
}
```

## Using Transformers with Auto-Save

Integrate with auto-save:

```typescript title="src/hooks/useAutoSave.ts"
import { draftTransformer } from '@/services/transformers/draft.transformer';

export function useAutoSave(form: FormNode, options: AutoSaveOptions) {
  return useAutoSaveBase(form, {
    ...options,
    saveFn: async (formData) => {
      // Serialize for storage
      const draftData = draftTransformer.serialize(formData);

      // Save
      await options.saveFn(draftData);
    },
  });
}
```

## Using Transformers with Submission

Integrate with form submission:

```typescript title="src/hooks/useFormSubmission.ts"
import { useState, useCallback } from 'react';
import type { FormNode } from 'reformer';
import { submissionTransformer } from '@/services/transformers/submission.transformer';
import { submitApplication } from '@/services/api/application.api';

export function useFormSubmission(form: FormNode) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setError(null);

    try {
      // Validate
      await form.validateTree();

      if (!form.isValid.value) {
        throw new Error('Form has validation errors');
      }

      // Get form data
      const formData = form.value.value;

      // Serialize for submission
      const apiData = submissionTransformer.serialize(formData);

      // Submit to API
      await submitApplication(apiData);

      setSubmitting(false);
      return true;
    } catch (err) {
      console.error('Submission failed:', err);
      setError(err as Error);
      setSubmitting(false);
      return false;
    }
  }, [form]);

  return { submit, submitting, error };
}
```

## Validation with Transformers

Validate serialized data before sending:

```typescript title="src/services/transformers/validation.ts"
/**
 * Validate serialized data
 */
export function validateSerializedData(data: any): string[] {
  const errors: string[] = [];

  // Check required fields
  if (!data.personalData?.firstName) {
    errors.push('First name is required');
  }

  // Check phone format
  if (data.phoneMain && !/^\d{10,11}$/.test(data.phoneMain)) {
    errors.push('Phone number must be 10-11 digits');
  }

  // Check email format
  if (data.email && !data.email.includes('@')) {
    errors.push('Invalid email format');
  }

  // Check dates are ISO strings
  if (data.birthDate && typeof data.birthDate !== 'string') {
    errors.push('Birth date must be ISO string');
  }

  return errors;
}
```

## Testing Transformations

Create tests for transformers:

```typescript title="src/services/transformers/__tests__/credit-application.transformer.test.ts"
import { creditApplicationTransformer } from '../credit-application.transformer';

describe('creditApplicationTransformer', () => {
  describe('serialize', () => {
    it('should convert dates to ISO strings', () => {
      const formData = {
        personalData: {
          birthDate: new Date('1990-01-01'),
        },
      };

      const result = creditApplicationTransformer.serialize(formData);

      expect(result.personalData.birthDate).toBe('1990-01-01T00:00:00.000Z');
    });

    it('should remove computed fields', () => {
      const formData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe', // computed
      };

      const result = creditApplicationTransformer.serialize(formData);

      expect(result.fullName).toBeUndefined();
    });

    it('should normalize phone numbers', () => {
      const formData = {
        phoneMain: '+7 (999) 123-45-67',
      };

      const result = creditApplicationTransformer.serialize(formData);

      expect(result.phoneMain).toBe('79991234567');
    });

    it('should remove empty values', () => {
      const formData = {
        firstName: 'John',
        middleName: null,
        lastName: undefined,
        email: '',
      };

      const result = creditApplicationTransformer.serialize(formData);

      expect(result.middleName).toBeUndefined();
      expect(result.lastName).toBeUndefined();
      expect(result.email).toBeUndefined();
    });
  });

  describe('deserialize', () => {
    it('should convert ISO strings to dates', () => {
      const apiData = {
        personalData: {
          birthDate: '1990-01-01T00:00:00.000Z',
        },
      };

      const result = creditApplicationTransformer.deserialize(apiData);

      expect(result.personalData.birthDate).toBeInstanceOf(Date);
    });

    it('should format phone numbers', () => {
      const apiData = {
        phoneMain: '79991234567',
      };

      const result = creditApplicationTransformer.deserialize(apiData);

      expect(result.phoneMain).toBe('+7 (999) 123-45-67');
    });
  });
});
```

## Testing Data Transformation

Test these scenarios:

### Scenario 1: Serialize for API
- [ ] Create form with data
- [ ] Serialize form data
- [ ] Dates are ISO strings
- [ ] Phone numbers are normalized
- [ ] Email is lowercase
- [ ] Computed fields removed
- [ ] Empty values removed

### Scenario 2: Deserialize from API
- [ ] Load API data
- [ ] Deserialize data
- [ ] ISO strings become Dates
- [ ] Phone numbers formatted
- [ ] Nested objects created
- [ ] Form accepts data

### Scenario 3: Round-Trip
- [ ] Start with form data
- [ ] Serialize to API
- [ ] Deserialize back
- [ ] Data matches original (minus computed fields)

### Scenario 4: Draft Save/Load
- [ ] Save draft with computed fields
- [ ] Load draft
- [ ] All fields restored
- [ ] Computed fields recalculate

### Scenario 5: Submission
- [ ] Fill form completely
- [ ] Validate form
- [ ] Serialize for submission
- [ ] No validation errors on serialized data
- [ ] Successfully submit

## Key Takeaways

1. **Bidirectional** - Serialize and deserialize
2. **Date Handling** - Convert between Date and ISO string
3. **Normalization** - Clean data for storage
4. **Computed Fields** - Remove before sending
5. **Empty Values** - Clean up nulls and empty strings
6. **Type Safety** - Use TypeScript interfaces
7. **Testing** - Test transformations thoroughly

## Common Patterns

### Basic Serialization
```typescript
const apiData = transformer.serialize(formData);
```

### Basic Deserialization
```typescript
const formData = transformer.deserialize(apiData);
```

### Save with Transform
```typescript
const draftData = draftTransformer.serialize(form.value.value);
await saveDraft(draftData);
```

### Load with Transform
```typescript
const apiData = await loadApplication(id);
const formData = transformer.deserialize(apiData);
form.patchValue(formData);
```

### Submit with Transform
```typescript
const formData = form.value.value;
const apiData = submissionTransformer.serialize(formData);
await submitApplication(apiData);
```

## Type Safety Tips

When working with form values in TypeScript, follow these guidelines:

### 1. Use Typed Form Creation

```typescript
// ✅ Create form with type parameter
const form = createForm<CreditApplicationForm>({
  form: creditApplicationSchema,
  behavior: creditApplicationBehaviors,
  validation: creditApplicationValidation,
});

// form.getValue() returns CreditApplicationForm
const data = form.getValue();
```

### 2. Type Assertions for Generic Functions

When creating utility functions that work with any form type, use proper generics:

```typescript
// ✅ Generic function with proper typing
function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// ❌ Avoid: Using unknown[] causes type errors
function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number) {
  // This won't work with typed callbacks
}
```

### 3. Working with getValue()

```typescript
// ✅ Type-safe access to form values
const form = createForm<MyFormType>({ form: schema });
const data = form.getValue(); // Returns MyFormType

// Access nested values with full type support
const loanAmount = data.loanAmount; // number
const firstName = data.personalData.firstName; // string
```

### 4. Type-Safe Transformers

```typescript
// ✅ Properly typed transformer
interface DataTransformer<TForm, TApi> {
  serialize: (formData: TForm) => TApi;
  deserialize: (apiData: TApi) => TForm;
}

const transformer: DataTransformer<CreditApplicationForm, CreditApplicationApi> = {
  serialize: (formData) => ({
    // TypeScript knows formData is CreditApplicationForm
    loan_amount: formData.loanAmount,
    loan_term: formData.loanTerm,
  }),
  deserialize: (apiData) => ({
    // TypeScript knows apiData is CreditApplicationApi
    loanAmount: apiData.loan_amount,
    loanTerm: apiData.loan_term,
  }),
};
```

### 5. Handling Unknown Form Nodes

When working with generic FormNode without type parameter:

```typescript
import type { FormNode } from 'reformer';

// ✅ Use type assertion when you know the type
function submitForm<T>(form: FormNode) {
  const data = form.getValue() as T;
  // Now data has type T
}

// ✅ Or use generic function parameter
function submitForm<T>(form: FormNode<T>) {
  const data = form.getValue(); // data is T
}
```

### 6. Common ESLint Workarounds

When TypeScript strictness conflicts with ReFormer patterns:

```typescript
// ✅ Suppress any[] when needed for callbacks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  // implementation
}
```

## What's Next?

In the final section, we'll bring everything together in **Complete Integration**:
- Combine all Data Flow features
- Complete form component
- Control panel with all features
- Testing all scenarios together
- Best practices
- Performance considerations

We'll see the complete picture of data flow in action!

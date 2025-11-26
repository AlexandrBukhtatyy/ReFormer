---
sidebar_position: 2
---

# Data Mapping

Transforming form data to match API requirements and different data formats.

## Overview

Forms often need data transformation before submission:

- **Field name mapping** - Convert `camelCase` to `snake_case` or other conventions
- **Remove UI fields** - Strip fields used only for UI (computed, display-only)
- **Date formatting** - Convert dates to ISO strings or custom formats
- **Nested object flattening** - Flatten or restructure nested data
- **Type conversion** - Transform strings to numbers, booleans, etc.
- **Null/undefined handling** - Convert empty values to null or omit them

## Basic Mapping

### Simple Field Mapping

Transform field names from form format to API format:

```typescript title="src/utils/map-to-api.ts"
import type { CreditApplicationForm } from '../types';

interface ApiCreditApplication {
  loan_type: string;
  loan_amount: number;
  loan_term: number;
  first_name: string;
  last_name: string;
  middle_name: string;
  email: string;
  phone_main: string;
}

export function mapFormToApi(
  formData: CreditApplicationForm
): ApiCreditApplication {
  return {
    loan_type: formData.loanType,
    loan_amount: formData.loanAmount,
    loan_term: formData.loanTerm,
    first_name: formData.firstName,
    last_name: formData.lastName,
    middle_name: formData.middleName,
    email: formData.email,
    phone_main: formData.phoneMain,
  };
}

// Usage
const handleSubmit = async () => {
  form.markAsTouched();
  await form.validate();

  if (form.valid.value) {
    const apiData = mapFormToApi(form.value.value);
    await submitApplication(apiData);
  }
};
```

### Generic Case Converter

Automatic camelCase to snake_case conversion:

```typescript title="src/utils/case-converter.ts"
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function camelToSnake<T extends Record<string, any>>(
  obj: T
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = toSnakeCase(key);

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively convert nested objects
      result[snakeKey] = camelToSnake(value);
    } else if (Array.isArray(value)) {
      // Convert array items if they're objects
      result[snakeKey] = value.map((item) =>
        item && typeof item === 'object' ? camelToSnake(item) : item
      );
    } else {
      result[snakeKey] = value;
    }
  }

  return result;
}

// Usage
const apiData = camelToSnake(form.value.value);
```

## Removing UI-Only Fields

### Filter Computed and Display Fields

Remove fields that shouldn't be sent to API:

```typescript title="src/utils/filter-ui-fields.ts"
interface CreditApplicationForm {
  // API fields
  loanAmount: number;
  loanTerm: number;
  interestRate: number;

  // UI-only fields (computed)
  monthlyPayment: number; // Computed from other fields
  totalAmount: number; // Computed from other fields
  fullName: string; // Computed from firstName + lastName
  age: number; // Computed from birthDate
}

export function removeUiFields(
  formData: CreditApplicationForm
): Partial<CreditApplicationForm> {
  const {
    monthlyPayment,
    totalAmount,
    fullName,
    age,
    ...apiData
  } = formData;

  // Return only fields needed for API
  return apiData;
}

// Usage
const handleSubmit = async () => {
  const formData = form.value.value;
  const apiData = removeUiFields(formData);
  await submitApplication(apiData);
};
```

### Whitelist Approach

Explicitly specify which fields to include:

```typescript title="src/utils/whitelist-fields.ts"
type ApiFieldName = keyof ApiCreditApplication;

const API_FIELDS: ApiFieldName[] = [
  'loanType',
  'loanAmount',
  'loanTerm',
  'loanPurpose',
  'firstName',
  'lastName',
  'middleName',
  'birthDate',
  'email',
  'phoneMain',
];

export function pickApiFields(
  formData: CreditApplicationForm
): Partial<CreditApplicationForm> {
  const result: Partial<CreditApplicationForm> = {};

  for (const field of API_FIELDS) {
    if (field in formData) {
      result[field] = formData[field];
    }
  }

  return result;
}
```

## Date Formatting

### Convert Dates to ISO Strings

```typescript title="src/utils/format-dates.ts"
interface CreditApplicationForm {
  birthDate: string; // From form: "2025-01-15" or Date object
  passportIssueDate: string;
  employmentStartDate: string;
}

export function formatDatesForApi(
  formData: CreditApplicationForm
): CreditApplicationForm {
  return {
    ...formData,
    birthDate: formatDate(formData.birthDate),
    passportIssueDate: formatDate(formData.passportIssueDate),
    employmentStartDate: formatDate(formData.employmentStartDate),
  };
}

function formatDate(date: string | Date | undefined): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // Return ISO string: "2025-01-15T00:00:00.000Z"
  return dateObj.toISOString();
}

// Usage
const handleSubmit = async () => {
  const formData = form.value.value;
  const withFormattedDates = formatDatesForApi(formData);
  await submitApplication(withFormattedDates);
};
```

### Custom Date Format

```typescript title="src/utils/custom-date-format.ts"
function formatDateCustom(date: string | Date | undefined): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // Return format: "DD.MM.YYYY" (Russian format)
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();

  return `${day}.${month}.${year}`;
}

export function formatDatesRussian(
  formData: CreditApplicationForm
): CreditApplicationForm {
  return {
    ...formData,
    birthDate: formatDateCustom(formData.birthDate),
    passportIssueDate: formatDateCustom(formData.passportIssueDate),
    employmentStartDate: formatDateCustom(formData.employmentStartDate),
  };
}
```

## Nested Object Transformation

### Flatten Nested Structure

Convert nested form structure to flat API structure:

```typescript title="src/utils/flatten-nested.ts"
// Form structure (nested)
interface CreditApplicationForm {
  personalData: {
    firstName: string;
    lastName: string;
    middleName: string;
    birthDate: string;
  };
  registrationAddress: {
    city: string;
    street: string;
    building: string;
    apartment: string;
  };
}

// API structure (flat)
interface ApiCreditApplication {
  first_name: string;
  last_name: string;
  middle_name: string;
  birth_date: string;
  registration_city: string;
  registration_street: string;
  registration_building: string;
  registration_apartment: string;
}

export function flattenFormData(
  formData: CreditApplicationForm
): ApiCreditApplication {
  return {
    first_name: formData.personalData.firstName,
    last_name: formData.personalData.lastName,
    middle_name: formData.personalData.middleName,
    birth_date: formData.personalData.birthDate,
    registration_city: formData.registrationAddress.city,
    registration_street: formData.registrationAddress.street,
    registration_building: formData.registrationAddress.building,
    registration_apartment: formData.registrationAddress.apartment,
  };
}
```

### Nest Flat Structure

Convert flat form to nested API structure:

```typescript title="src/utils/nest-flat.ts"
// Form structure (flat)
interface CreditApplicationForm {
  firstName: string;
  lastName: string;
  city: string;
  street: string;
}

// API structure (nested)
interface ApiCreditApplication {
  applicant: {
    first_name: string;
    last_name: string;
  };
  address: {
    city: string;
    street: string;
  };
}

export function nestFormData(
  formData: CreditApplicationForm
): ApiCreditApplication {
  return {
    applicant: {
      first_name: formData.firstName,
      last_name: formData.lastName,
    },
    address: {
      city: formData.city,
      street: formData.street,
    },
  };
}
```

## Array Transformation

### Transform Array Items

Map form arrays to API format:

```typescript title="src/utils/transform-arrays.ts"
interface FormCoBorrower {
  firstName: string;
  lastName: string;
  monthlyIncome: number;
  relationshipType: string;
}

interface ApiCoBorrower {
  first_name: string;
  last_name: string;
  monthly_income: number;
  relationship_type: string;
}

export function transformCoBorrowers(
  coBorrowers: FormCoBorrower[]
): ApiCoBorrower[] {
  return coBorrowers.map((cb) => ({
    first_name: cb.firstName,
    last_name: cb.lastName,
    monthly_income: cb.monthlyIncome,
    relationship_type: cb.relationshipType,
  }));
}

// Usage
const handleSubmit = async () => {
  const formData = form.value.value;

  const apiData = {
    ...mapFormToApi(formData),
    co_borrowers: transformCoBorrowers(formData.coBorrowers),
  };

  await submitApplication(apiData);
};
```

### Filter Empty Array Items

Remove incomplete or empty items:

```typescript title="src/utils/filter-array-items.ts"
export function filterEmptyCoBorrowers(
  coBorrowers: FormCoBorrower[]
): FormCoBorrower[] {
  return coBorrowers.filter((cb) => {
    // Keep only items with at least first name and last name
    return cb.firstName && cb.lastName;
  });
}

// Usage
const apiData = {
  ...formData,
  coBorrowers: filterEmptyCoBorrowers(formData.coBorrowers),
};
```

## Null and Undefined Handling

### Convert Empty Strings to Null

```typescript title="src/utils/handle-empty-values.ts"
export function emptyStringsToNull<T extends Record<string, any>>(
  obj: T
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === '') {
      result[key] = null;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = emptyStringsToNull(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item && typeof item === 'object' ? emptyStringsToNull(item) : item
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

// Usage
const apiData = emptyStringsToNull(form.value.value);
```

### Omit Null/Undefined Values

Remove fields with null or undefined values:

```typescript title="src/utils/omit-nullish.ts"
export function omitNullish<T extends Record<string, any>>(
  obj: T
): Partial<T> {
  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      result[key as keyof T] = value;
    }
  }

  return result;
}

// Usage
const apiData = omitNullish(form.value.value);
// Only fields with actual values are sent
```

### Convert Undefined to Default Values

```typescript title="src/utils/default-values.ts"
interface CreditApplicationForm {
  loanAmount: number | undefined;
  loanTerm: number | undefined;
  initialPaymentPercent: number | undefined;
}

export function applyDefaults(
  formData: CreditApplicationForm
): Required<CreditApplicationForm> {
  return {
    loanAmount: formData.loanAmount ?? 0,
    loanTerm: formData.loanTerm ?? 12,
    initialPaymentPercent: formData.initialPaymentPercent ?? 0,
  };
}
```

## Complete Transformation Pipeline

### Composable Transform Functions

Chain multiple transformations:

```typescript title="src/utils/transform-pipeline.ts"
export function transformForApi(
  formData: CreditApplicationForm
): ApiCreditApplication {
  // Step 1: Remove UI-only fields
  const withoutUiFields = removeUiFields(formData);

  // Step 2: Format dates
  const withFormattedDates = formatDatesForApi(withoutUiFields);

  // Step 3: Convert to snake_case
  const snakeCaseData = camelToSnake(withFormattedDates);

  // Step 4: Handle empty values
  const withNulls = emptyStringsToNull(snakeCaseData);

  // Step 5: Transform arrays
  const final = {
    ...withNulls,
    co_borrowers: transformCoBorrowers(formData.coBorrowers || []),
  };

  return final as ApiCreditApplication;
}

// Usage
const handleSubmit = async () => {
  form.markAsTouched();
  await form.validate();

  if (form.valid.value) {
    const apiData = transformForApi(form.value.value);
    await submitApplication(apiData);
  }
};
```

### Pipeline with Function Composition

```typescript title="src/utils/compose-transforms.ts"
type TransformFn<T, R> = (data: T) => R;

export function compose<T>(...fns: TransformFn<any, any>[]) {
  return (data: T) => {
    return fns.reduce((result, fn) => fn(result), data);
  };
}

// Define individual transforms
const removeUi = (data: any) => removeUiFields(data);
const formatDates = (data: any) => formatDatesForApi(data);
const toSnake = (data: any) => camelToSnake(data);
const handleNulls = (data: any) => emptyStringsToNull(data);

// Compose pipeline
const transformPipeline = compose(
  removeUi,
  formatDates,
  toSnake,
  handleNulls
);

// Usage
const apiData = transformPipeline(form.value.value);
```

## Partial Submissions

### Submit Only Changed Fields

Send only dirty (modified) fields to API:

```typescript title="src/utils/get-dirty-fields.ts"
import type { FormNode } from 'reformer';

export function getDirtyValues<T extends Record<string, any>>(
  form: FormNode<T>
): Partial<T> {
  const dirtyFields: Partial<T> = {};
  const value = form.value.value;

  // Iterate through all fields
  for (const key in value) {
    const field = form.field(key as keyof T);

    if (field && field.dirty?.value) {
      dirtyFields[key] = value[key];
    }
  }

  return dirtyFields;
}

// Usage - PATCH endpoint
const handleSaveChanges = async () => {
  const changedFields = getDirtyValues(form);

  if (Object.keys(changedFields).length === 0) {
    console.log('No changes to save');
    return;
  }

  await patchApplication(applicationId, changedFields);
};
```

### Submit Specific Sections

Submit only relevant parts of the form:

```typescript title="src/utils/extract-section.ts"
export function extractLoanDetails(
  formData: CreditApplicationForm
): Partial<CreditApplicationForm> {
  return {
    loanType: formData.loanType,
    loanAmount: formData.loanAmount,
    loanTerm: formData.loanTerm,
    loanPurpose: formData.loanPurpose,
    initialPaymentPercent: formData.initialPaymentPercent,
  };
}

export function extractPersonalInfo(
  formData: CreditApplicationForm
): Partial<CreditApplicationForm> {
  return {
    firstName: formData.firstName,
    lastName: formData.lastName,
    middleName: formData.middleName,
    birthDate: formData.birthDate,
    birthPlace: formData.birthPlace,
  };
}

// Usage - Multi-step submission
const handleSaveStep1 = async () => {
  const loanDetails = extractLoanDetails(form.value.value);
  await saveStep('loan-details', loanDetails);
};

const handleSaveStep2 = async () => {
  const personalInfo = extractPersonalInfo(form.value.value);
  await saveStep('personal-info', personalInfo);
};
```

## File Uploads

### Prepare File Data for Upload

```typescript title="src/utils/prepare-files.ts"
interface CreditApplicationForm {
  passportScan: File | null;
  incomeCertificate: File | null;
  additionalDocuments: File[];
}

export async function prepareFormWithFiles(
  formData: CreditApplicationForm
): Promise<FormData> {
  const apiFormData = new FormData();

  // Add regular fields
  apiFormData.append('loanAmount', String(formData.loanAmount));
  apiFormData.append('loanTerm', String(formData.loanTerm));
  apiFormData.append('firstName', formData.firstName);
  apiFormData.append('lastName', formData.lastName);

  // Add file fields
  if (formData.passportScan) {
    apiFormData.append('passport_scan', formData.passportScan);
  }

  if (formData.incomeCertificate) {
    apiFormData.append('income_certificate', formData.incomeCertificate);
  }

  // Add multiple files
  formData.additionalDocuments.forEach((file, index) => {
    apiFormData.append(`additional_document_${index}`, file);
  });

  return apiFormData;
}

// Usage
const handleSubmit = async () => {
  const formDataWithFiles = await prepareFormWithFiles(form.value.value);

  await fetch('/api/applications', {
    method: 'POST',
    body: formDataWithFiles,
    // Don't set Content-Type - browser sets it with boundary
  });
};
```

### Convert Files to Base64

```typescript title="src/utils/file-to-base64.ts"
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

export async function prepareFilesAsBase64(
  formData: CreditApplicationForm
): Promise<any> {
  const apiData = { ...formData };

  if (formData.passportScan) {
    apiData.passportScan = await fileToBase64(formData.passportScan);
  }

  if (formData.incomeCertificate) {
    apiData.incomeCertificate = await fileToBase64(formData.incomeCertificate);
  }

  return apiData;
}
```

## Best Practices

### 1. Create Reusable Transform Functions

```typescript
// ✅ GOOD: Separate, testable functions
const removeUiFields = (data: any) => { /* ... */ };
const formatDates = (data: any) => { /* ... */ };
const toSnakeCase = (data: any) => { /* ... */ };

const apiData = toSnakeCase(formatDates(removeUiFields(formData)));

// ❌ BAD: Inline transformations
const apiData = {
  loan_amount: formData.loanAmount,
  loan_term: formData.loanTerm,
  first_name: formData.firstName,
  // ... repeated in every submit handler
};
```

### 2. Use Type Safety

```typescript
// ✅ GOOD: Typed transformations
export function mapFormToApi(
  formData: CreditApplicationForm
): ApiCreditApplication {
  return {
    loan_type: formData.loanType,
    loan_amount: formData.loanAmount,
    // TypeScript ensures all required fields are mapped
  };
}

// ❌ BAD: Untyped transformations
export function mapFormToApi(formData: any): any {
  return {
    loan_type: formData.loanType,
    // Easy to miss fields, typos, etc.
  };
}
```

### 3. Handle Errors in Transformations

```typescript
// ✅ GOOD: Safe date formatting
function formatDate(date: string | Date | undefined): string {
  if (!date) return '';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      console.warn('Invalid date:', date);
      return '';
    }

    return dateObj.toISOString();
  } catch (error) {
    console.error('Date formatting error:', error);
    return '';
  }
}

// ❌ BAD: Unsafe transformation
function formatDate(date: any): string {
  return new Date(date).toISOString(); // Can throw!
}
```

### 4. Document Field Mappings

```typescript
// ✅ GOOD: Clear documentation
/**
 * Maps credit application form data to API format
 *
 * Transformations:
 * - Field names: camelCase → snake_case
 * - Dates: Date objects → ISO strings
 * - Empty strings → null
 * - Removes: fullName, age, monthlyPayment (UI-only fields)
 *
 * @param formData - Form data from CreditApplicationForm
 * @returns API-ready data in ApiCreditApplication format
 */
export function mapFormToApi(
  formData: CreditApplicationForm
): ApiCreditApplication {
  // ...
}

// ❌ BAD: No documentation
export function transform(data: any): any {
  // What does this do?
}
```

### 5. Test Transformations

```typescript
// ✅ GOOD: Unit tests for transforms
describe('mapFormToApi', () => {
  it('should convert camelCase to snake_case', () => {
    const formData = {
      loanAmount: 100000,
      firstName: 'Ivan',
    };

    const result = mapFormToApi(formData);

    expect(result).toEqual({
      loan_amount: 100000,
      first_name: 'Ivan',
    });
  });

  it('should format dates to ISO strings', () => {
    const formData = {
      birthDate: new Date('1990-01-15'),
    };

    const result = mapFormToApi(formData);

    expect(result.birth_date).toBe('1990-01-15T00:00:00.000Z');
  });
});
```

## Common Patterns

### Transform Before and After Submission

```typescript
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const handleSubmit = async () => {
    form.markAsTouched();
    await form.validate();

    if (!form.valid.value) return;

    // Transform before sending
    const apiData = transformForApi(form.value.value);

    try {
      // Send to API
      const response = await submitApplication(apiData);

      // Transform response back to form format
      const updatedFormData = transformFromApi(response.data);
      form.setValue(updatedFormData);

      showSuccessMessage('Application submitted!');
    } catch (error) {
      showErrorMessage('Submission failed');
    }
  };

  return <FormContent form={form} />;
}
```

### Conditional Transformations

```typescript
export function transformForApi(
  formData: CreditApplicationForm,
  options: { includeComputed?: boolean } = {}
): ApiCreditApplication {
  let data = { ...formData };

  // Conditionally include computed fields
  if (!options.includeComputed) {
    data = removeUiFields(data);
  }

  // Continue with transformations
  return camelToSnake(formatDatesForApi(data));
}

// Usage
// Full submission - exclude computed fields
const fullApiData = transformForApi(formData, { includeComputed: false });

// Draft save - include all fields
const draftApiData = transformForApi(formData, { includeComputed: true });
```

## Next Step

Now that you understand data mapping, let's learn how to handle server-side validation errors and display them in the form.

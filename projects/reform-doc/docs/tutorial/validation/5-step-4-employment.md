---
sidebar_position: 5
---

# Step 4: Employment Validation

Validating employment and income fields with conditional rules based on employment status.

## What We're Validating

Step 4 contains employment-related fields with conditional requirements:

| Field                   | Validation Rules                             |
| ----------------------- | -------------------------------------------- |
| `employmentStatus`      | Required                                     |
| `monthlyIncome`         | Required, min 10,000                         |
| `additionalIncome`      | Optional, min 0                              |
| **For Employed**        |                                              |
| `companyName`           | Required when employed                       |
| `companyAddress`        | Required when employed                       |
| `position`              | Required when employed                       |
| `workExperienceTotal`   | Optional, min 0                              |
| `workExperienceCurrent` | Required when employed, min 3 months         |
| **For Self-Employed**   |                                              |
| `businessType`          | Required when self-employed                  |
| `businessInn`           | Required when self-employed, 10 or 12 digits |
| `businessAddress`       | Required when self-employed                  |
| `businessExperience`    | Required when self-employed, min 6 months    |

## Creating the Validator File

Create the validator file for Step 4:

```bash
touch src/schemas/validators/employment.ts
```

## Implementation

### Basic Employment Fields

Start with required fields that apply to all employment statuses:

```typescript title="src/schemas/validators/employment.ts"
import { required, min, pattern, applyWhen } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Validation for Step 4: Employment
 *
 * Validates:
 * - Employment status (required for all)
 * - Income fields (required for all)
 * - Employment-specific fields (conditionally required)
 * - Self-employment fields (conditionally required)
 */
export const step4EmploymentValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Basic Employment Fields
  // ==========================================

  // Employment status (always required)
  required(path.employmentStatus, { message: 'Employment status is required' });

  // Monthly income (always required, minimum threshold)
  required(path.monthlyIncome, { message: 'Monthly income is required' });
  min(path.monthlyIncome, 10000, {
    message: 'Minimum monthly income: 10,000',
  });

  // Additional income (optional, but must be non-negative if provided)
  min(path.additionalIncome, 0, {
    message: 'Additional income cannot be negative',
  });
};
```

### Conditional Validation: Employed

Add validation for employed individuals:

```typescript title="src/schemas/validators/employment.ts"
export const step4EmploymentValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // Conditional: Employed Fields
  // ==========================================

  applyWhen(path.employmentStatus, (status) => status === 'employed', (p) => {
    required(p.companyName, { message: 'Company name is required' });
    required(p.companyAddress, { message: 'Company address is required' });
    required(p.position, { message: 'Position is required' });

    required(p.workExperienceCurrent, { message: 'Work experience at current job is required' });
    min(p.workExperienceCurrent, 3, {
      message: 'Minimum 3 months of experience at current job required',
    });

    min(p.workExperienceTotal, 0, {
      message: 'Total work experience cannot be negative',
    });
  });
};
```

### Conditional Validation: Self-Employed

Add validation for self-employed individuals:

```typescript title="src/schemas/validators/employment.ts"
export const step4EmploymentValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // Conditional: Self-Employed Fields
  // ==========================================

  applyWhen(path.employmentStatus, (status) => status === 'selfEmployed', (p) => {
    required(p.businessType, { message: 'Business type is required' });
    required(p.businessInn, { message: 'Business INN is required' });
  });

  pattern(path.businessInn, /^\d{10}$|^\d{12}$/, {
    message: 'Business INN must be 10 or 12 digits',
  });
};
```

## Complete Code

Here's the complete validator for Step 4:

```typescript title="src/schemas/validators/employment.ts"
import { required, min, pattern, applyWhen } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Validation for Step 4: Employment
 *
 * Validates:
 * - Employment status (required for all)
 * - Income fields (required for all)
 * - Employment-specific fields (conditionally required)
 * - Self-employment fields (conditionally required)
 */
export const step4EmploymentValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Basic Employment Fields
  // ==========================================

  required(path.employmentStatus, { message: 'Employment status is required' });

  required(path.monthlyIncome, { message: 'Monthly income is required' });
  min(path.monthlyIncome, 10000, {
    message: 'Minimum monthly income: 10,000',
  });

  min(path.additionalIncome, 0, {
    message: 'Additional income cannot be negative',
  });

  // ==========================================
  // Conditional: Employed Fields
  // ==========================================

  applyWhen(path.employmentStatus, (status) => status === 'employed', (p) => {
    required(p.companyName, { message: 'Company name is required' });
    required(p.companyAddress, { message: 'Company address is required' });
    required(p.position, { message: 'Position is required' });

    required(p.workExperienceCurrent, { message: 'Work experience at current job is required' });
    min(p.workExperienceCurrent, 3, {
      message: 'Minimum 3 months of experience at current job required',
    });

    min(p.workExperienceTotal, 0, {
      message: 'Total work experience cannot be negative',
    });
  });

  // ==========================================
  // Conditional: Self-Employed Fields
  // ==========================================

  applyWhen(path.employmentStatus, (status) => status === 'selfEmployed', (p) => {
    required(p.businessType, { message: 'Business type is required' });
    required(p.businessInn, { message: 'Business INN is required' });
  });

  pattern(path.businessInn, /^\d{10}$|^\d{12}$/, {
    message: 'Business INN must be 10 or 12 digits',
  });
};
```

## How It Works

### Always Required Fields

These fields are required regardless of employment status:

```typescript
required(path.employmentStatus, { message: 'Employment status is required' });
required(path.monthlyIncome, { message: 'Monthly income is required' });
min(path.monthlyIncome, 10000, { message: 'Minimum monthly income: 10,000' });
```

### Conditionally Required Fields

These fields are only required for specific employment statuses:

```typescript
// Required only when employed
applyWhen(path.employmentStatus, (status) => status === 'employed', (p) => {
  required(p.companyName, { message: 'Company name is required' });
  min(p.workExperienceCurrent, 3, {
    message: 'Minimum 3 months of experience at current job required',
  });
});

// Required only when self-employed
applyWhen(path.employmentStatus, (status) => status === 'selfEmployed', (p) => {
  required(p.businessType, { message: 'Business type is required' });
});
```

### Integration with Behaviors

From the Behaviors section, we have:

```typescript
// Behavior: Show company fields only when employed
enableWhen(path.companyName, path.employmentStatus, (status) => status === 'employed');
enableWhen(path.companyAddress, path.employmentStatus, (status) => status === 'employed');

// Validation: Require company fields only when employed
applyWhen(path.employmentStatus, (status) => status === 'employed', (p) => {
  required(p.companyName, { message: 'Company name is required' });
});
```

Perfect alignment! Fields are hidden/shown and required/optional in sync.

## Testing the Validation

Test these scenarios:

### Basic Fields (All Statuses)

- [ ] Leave employment status empty → Error shown
- [ ] Leave monthly income empty → Error shown
- [ ] Enter monthly income < 10,000 → Error shown
- [ ] Enter monthly income >= 10,000 → No error
- [ ] Enter negative additional income → Error shown
- [ ] Leave additional income empty → No error (optional)

### Employed Status

- [ ] Select "employed" → Company fields become required
- [ ] Leave company name empty → Error shown
- [ ] Leave company address empty → Error shown
- [ ] Leave position empty → Error shown
- [ ] Leave work experience empty → Error shown
- [ ] Enter work experience < 3 months → Error shown
- [ ] Enter work experience >= 3 months → No error

### Self-Employed Status

- [ ] Select "self-employed" → Business fields become required
- [ ] Leave business type empty → Error shown
- [ ] Leave business INN empty → Error shown
- [ ] Enter business INN with 9 digits → Error shown
- [ ] Enter business INN with 10 digits → No error
- [ ] Enter business INN with 12 digits → No error
- [ ] Leave business address empty → Error shown
- [ ] Leave business experience empty → Error shown
- [ ] Enter business experience < 6 months → Error shown
- [ ] Enter business experience >= 6 months → No error

### Unemployed/Other Status

- [ ] Select "unemployed" → Only basic fields required
- [ ] Company fields not required
- [ ] Business fields not required
- [ ] Monthly income still required

### Switching Employment Status

- [ ] Fill employed fields → Switch to "self-employed" → Employed errors disappear
- [ ] Fill business fields → Switch to "employed" → Business errors disappear
- [ ] Switch to "unemployed" → All conditional errors disappear

## Employment Status Values

Typical employment status values:

```typescript
type EmploymentStatus =
  | 'employed' // Full-time employment
  | 'selfEmployed' // Self-employed / entrepreneur
  | 'unemployed' // Unemployed
  | 'retired' // Retired
  | 'student'; // Student
```

Each status may have different validation requirements.

## Key Takeaways

1. **Always Required** - Some fields required regardless of status
2. **Conditionally Required** - Use `applyWhen()` for status-specific fields
3. **Works with Behaviors** - Hidden fields skip validation
4. **Business Rules** - Different minimum thresholds (3 months employed, 6 months business)

## Common Patterns

### Required for Specific Status

```typescript
applyWhen(path.employmentStatus, (status) => status === 'employed', (p) => {
  required(p.field, { message: 'Field is required' });
  min(p.field, minimumValue, { message: 'Minimum value not met' });
});
```

### Non-Negative Optional Field

```typescript
// No required(), just min(0) to prevent negatives
min(path.additionalIncome, 0, {
  message: 'Cannot be negative',
});
```

## What's Next?

In the next section, we'll add validation for **Step 5: Additional Information**, including:

- Array validation (properties, existing loans, co-borrowers)
- Array length constraints (min/max)
- Validating individual array elements
- Nested object validation within arrays
- Conditional array requirements

This will demonstrate the powerful array validation capabilities of ReFormer!

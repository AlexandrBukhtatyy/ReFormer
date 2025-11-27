---
sidebar_position: 6
---

# Step 5: Additional Information Validation

Validating arrays and their elements with conditional requirements and nested object validation.

## What We're Validating

Step 5 contains array fields that need special validation:

| Field | Validation Rules |
|-------|------------------|
| **Properties Array** | |
| `properties` | Min 1 item when `hasProperty` = true, max 10 items |
| `properties[*].type` | Required for each item |
| `properties[*].description` | Required, minLength 10 |
| `properties[*].estimatedValue` | Required, min 0 |
| **Existing Loans Array** | |
| `existingLoans` | Min 1 item when `hasExistingLoans` = true, max 20 items |
| `existingLoans[*].bank` | Required for each item |
| `existingLoans[*].amount` | Required, min 0 |
| `existingLoans[*].remainingAmount` | Optional, min 0 |
| **Co-Borrowers Array** | |
| `coBorrowers` | Min 1 item when `hasCoBorrower` = true, max 5 items |
| `coBorrowers[*].personalData.firstName` | Required for each item |
| `coBorrowers[*].personalData.lastName` | Required for each item |
| `coBorrowers[*].phone` | Required, phone format |
| `coBorrowers[*].email` | Required, email format |
| `coBorrowers[*].monthlyIncome` | Required, min 0 |

## Creating the Validator File

Create the validator file for Step 5:

```bash
touch src/schemas/validators/steps/step-5-additional-info.validators.ts
```

## Implementation

### Properties Array Validation

Start with properties array validation:

```typescript title="src/schemas/validators/steps/step-5-additional-info.validators.ts"
import {
  required,
  min,
  minLength,
  email,
  phone,
  arrayMinLengthWhen,
  arrayMaxLength
} from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Validation for Step 5: Additional Information
 *
 * Validates:
 * - Properties array (conditional, max 10 items)
 * - Existing loans array (conditional, max 20 items)
 * - Co-borrowers array (conditional, max 5 items)
 * - Array element validation for all arrays
 */
export const step5AdditionalValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Properties Array
  // ==========================================

  // Array length validation
  arrayMinLengthWhen(
    path.properties,
    1,
    path.hasProperty,
    (has) => has === true,
    { message: 'Add at least one property' }
  );

  arrayMaxLength(path.properties, 10, {
    message: 'Maximum 10 properties allowed',
  });

  // Validate each property item using '*' wildcard
  required(path.properties['*'].type, {
    message: 'Property type is required',
  });

  required(path.properties['*'].description, {
    message: 'Property description is required',
  });

  minLength(path.properties['*'].description, 10, {
    message: 'Minimum 10 characters for description',
  });

  required(path.properties['*'].estimatedValue, {
    message: 'Estimated value is required',
  });

  min(path.properties['*'].estimatedValue, 0, {
    message: 'Value must be non-negative',
  });
};
```

:::tip Array Element Validation
Use the `'*'` wildcard to validate all elements in an array:
- `path.properties['*'].type` validates the `type` field of every property
- Validation runs for each existing array element
- New elements are validated when added
:::

### Existing Loans Array Validation

Add validation for existing loans:

```typescript title="src/schemas/validators/steps/step-5-additional-info.validators.ts"
export const step5AdditionalValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // Existing Loans Array
  // ==========================================

  // Array length validation
  arrayMinLengthWhen(
    path.existingLoans,
    1,
    path.hasExistingLoans,
    (has) => has === true,
    { message: 'Add at least one existing loan' }
  );

  arrayMaxLength(path.existingLoans, 20, {
    message: 'Maximum 20 loans allowed',
  });

  // Validate each loan item
  required(path.existingLoans['*'].bank, {
    message: 'Bank name is required',
  });

  required(path.existingLoans['*'].amount, {
    message: 'Loan amount is required',
  });

  min(path.existingLoans['*'].amount, 0, {
    message: 'Amount must be non-negative',
  });

  // Remaining amount is optional, but must be non-negative if provided
  min(path.existingLoans['*'].remainingAmount, 0, {
    message: 'Remaining amount must be non-negative',
  });

  required(path.existingLoans['*'].monthlyPayment, {
    message: 'Monthly payment is required',
  });

  min(path.existingLoans['*'].monthlyPayment, 0, {
    message: 'Monthly payment must be non-negative',
  });
};
```

### Co-Borrowers Array Validation

Add validation for co-borrowers with nested object validation:

```typescript title="src/schemas/validators/steps/step-5-additional-info.validators.ts"
export const step5AdditionalValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // Co-Borrowers Array
  // ==========================================

  // Array length validation
  arrayMinLengthWhen(
    path.coBorrowers,
    1,
    path.hasCoBorrower,
    (has) => has === true,
    { message: 'Add at least one co-borrower' }
  );

  arrayMaxLength(path.coBorrowers, 5, {
    message: 'Maximum 5 co-borrowers allowed',
  });

  // Validate nested personalData object within each co-borrower
  required(path.coBorrowers['*'].personalData.firstName, {
    message: 'First name is required',
  });

  required(path.coBorrowers['*'].personalData.lastName, {
    message: 'Last name is required',
  });

  // Phone validation
  required(path.coBorrowers['*'].phone, {
    message: 'Phone number is required',
  });

  phone(path.coBorrowers['*'].phone, {
    message: 'Invalid phone format',
  });

  // Email validation
  required(path.coBorrowers['*'].email, {
    message: 'Email is required',
  });

  email(path.coBorrowers['*'].email, {
    message: 'Invalid email format',
  });

  // Monthly income
  required(path.coBorrowers['*'].monthlyIncome, {
    message: 'Monthly income is required',
  });

  min(path.coBorrowers['*'].monthlyIncome, 0, {
    message: 'Income must be non-negative',
  });

  // Relationship to applicant
  required(path.coBorrowers['*'].relationship, {
    message: 'Relationship is required',
  });
};
```

## Complete Code

Here's the complete validator for Step 5:

```typescript title="src/schemas/validators/steps/step-5-additional-info.validators.ts"
import {
  required,
  min,
  minLength,
  email,
  phone,
  arrayMinLengthWhen,
  arrayMaxLength
} from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Validation for Step 5: Additional Information
 *
 * Validates:
 * - Properties array (conditional, max 10 items)
 * - Existing loans array (conditional, max 20 items)
 * - Co-borrowers array (conditional, max 5 items)
 * - Array element validation for all arrays
 */
export const step5AdditionalValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Properties Array
  // ==========================================

  arrayMinLengthWhen(
    path.properties,
    1,
    path.hasProperty,
    (has) => has === true,
    { message: 'Add at least one property' }
  );

  arrayMaxLength(path.properties, 10, {
    message: 'Maximum 10 properties allowed',
  });

  required(path.properties['*'].type, {
    message: 'Property type is required',
  });

  required(path.properties['*'].description, {
    message: 'Property description is required',
  });

  minLength(path.properties['*'].description, 10, {
    message: 'Minimum 10 characters for description',
  });

  required(path.properties['*'].estimatedValue, {
    message: 'Estimated value is required',
  });

  min(path.properties['*'].estimatedValue, 0, {
    message: 'Value must be non-negative',
  });

  // ==========================================
  // Existing Loans Array
  // ==========================================

  arrayMinLengthWhen(
    path.existingLoans,
    1,
    path.hasExistingLoans,
    (has) => has === true,
    { message: 'Add at least one existing loan' }
  );

  arrayMaxLength(path.existingLoans, 20, {
    message: 'Maximum 20 loans allowed',
  });

  required(path.existingLoans['*'].bank, {
    message: 'Bank name is required',
  });

  required(path.existingLoans['*'].amount, {
    message: 'Loan amount is required',
  });

  min(path.existingLoans['*'].amount, 0, {
    message: 'Amount must be non-negative',
  });

  min(path.existingLoans['*'].remainingAmount, 0, {
    message: 'Remaining amount must be non-negative',
  });

  required(path.existingLoans['*'].monthlyPayment, {
    message: 'Monthly payment is required',
  });

  min(path.existingLoans['*'].monthlyPayment, 0, {
    message: 'Monthly payment must be non-negative',
  });

  // ==========================================
  // Co-Borrowers Array
  // ==========================================

  arrayMinLengthWhen(
    path.coBorrowers,
    1,
    path.hasCoBorrower,
    (has) => has === true,
    { message: 'Add at least one co-borrower' }
  );

  arrayMaxLength(path.coBorrowers, 5, {
    message: 'Maximum 5 co-borrowers allowed',
  });

  required(path.coBorrowers['*'].personalData.firstName, {
    message: 'First name is required',
  });

  required(path.coBorrowers['*'].personalData.lastName, {
    message: 'Last name is required',
  });

  required(path.coBorrowers['*'].phone, {
    message: 'Phone number is required',
  });

  phone(path.coBorrowers['*'].phone, {
    message: 'Invalid phone format',
  });

  required(path.coBorrowers['*'].email, {
    message: 'Email is required',
  });

  email(path.coBorrowers['*'].email, {
    message: 'Invalid email format',
  });

  required(path.coBorrowers['*'].monthlyIncome, {
    message: 'Monthly income is required',
  });

  min(path.coBorrowers['*'].monthlyIncome, 0, {
    message: 'Income must be non-negative',
  });

  required(path.coBorrowers['*'].relationship, {
    message: 'Relationship is required',
  });
};
```

## How It Works

### Array Length Validation

#### Conditional Minimum Length
```typescript
arrayMinLengthWhen(
  path.properties,
  1,  // Minimum length
  path.hasProperty,  // Dependency field
  (has) => has === true,  // Condition
  { message: 'Add at least one property' }
);
```

- Array must have at least 1 item when condition is true
- No validation when condition is false
- Works with behaviors that show/hide arrays

#### Maximum Length
```typescript
arrayMaxLength(path.properties, 10, {
  message: 'Maximum 10 properties allowed',
});
```

- Always enforced (not conditional)
- Prevents adding more items than allowed
- User sees error when trying to add too many items

### Array Element Validation

Use `'*'` wildcard to validate all array elements:

```typescript
// Validates 'type' field in every property
required(path.properties['*'].type, {
  message: 'Property type is required',
});

// Validates 'description' field in every property
minLength(path.properties['*'].description, 10, {
  message: 'Minimum 10 characters for description',
});
```

**How it works**:
- `path.properties['*']` means "every element in properties array"
- Validation runs for each existing element
- New elements are validated when added to array
- Removing elements removes their validation errors

### Nested Object Validation

Validate fields within nested objects in arrays:

```typescript
// Validates firstName inside personalData inside each co-borrower
required(path.coBorrowers['*'].personalData.firstName, {
  message: 'First name is required',
});
```

**Structure**:
```typescript
coBorrowers: [
  {
    personalData: {
      firstName: 'John',    // ← This field
      lastName: 'Doe'
    },
    phone: '+1234567890',
    email: 'john@example.com',
    monthlyIncome: 50000
  }
]
```

### Integration with Behaviors

From Behaviors section:

```typescript
// Behavior: Show properties array only when checkbox is checked
showWhen(path.properties, path.hasProperty, (has) => has === true);

// Validation: Require at least one property when visible
arrayMinLengthWhen(
  path.properties,
  1,
  path.hasProperty,
  (has) => has === true,
  { message: 'Add at least one property' }
);
```

Perfect synchronization! Array is hidden/visible and required/optional together.

## Testing the Validation

Test these scenarios:

### Properties Array
- [ ] Check "has property" → Array becomes required
- [ ] Leave array empty → Error shown
- [ ] Add one property → No error
- [ ] Try to add 11th property → Error shown
- [ ] Leave property type empty → Error shown
- [ ] Leave description empty → Error shown
- [ ] Enter description < 10 characters → Error shown
- [ ] Leave estimated value empty → Error shown
- [ ] Enter negative estimated value → Error shown

### Existing Loans Array
- [ ] Check "has existing loans" → Array becomes required
- [ ] Leave array empty → Error shown
- [ ] Add one loan → No error
- [ ] Try to add 21st loan → Error shown
- [ ] Leave bank name empty → Error shown
- [ ] Leave amount empty → Error shown
- [ ] Enter negative amount → Error shown
- [ ] Enter negative remaining amount → Error shown

### Co-Borrowers Array
- [ ] Check "has co-borrower" → Array becomes required
- [ ] Leave array empty → Error shown
- [ ] Add one co-borrower → No error
- [ ] Try to add 6th co-borrower → Error shown
- [ ] Leave first name empty → Error shown
- [ ] Leave last name empty → Error shown
- [ ] Leave phone empty → Error shown
- [ ] Enter invalid phone format → Error shown
- [ ] Leave email empty → Error shown
- [ ] Enter invalid email format → Error shown
- [ ] Leave monthly income empty → Error shown
- [ ] Enter negative income → Error shown

### Array Management
- [ ] Add item → Item gets validated
- [ ] Remove item → Item's errors disappear
- [ ] Uncheck "has property" → Array not required, errors cleared

## Key Takeaways

1. **Array Length** - Use `arrayMinLengthWhen()` and `arrayMaxLength()`
2. **Element Validation** - Use `'*'` wildcard for all elements
3. **Nested Objects** - Can validate deep nested fields in arrays
4. **Conditional Arrays** - Arrays can be conditionally required
5. **Works with Behaviors** - Hidden arrays skip validation

## Common Patterns

### Conditional Array with Element Validation
```typescript
// Array must have at least 1 item when checkbox is true
arrayMinLengthWhen(
  path.items,
  1,
  path.hasItems,
  (has) => has === true,
  { message: 'Add at least one item' }
);

// Each item must have required fields
required(path.items['*'].name, { message: 'Name is required' });
min(path.items['*'].value, 0, { message: 'Value must be non-negative' });
```

### Array with Maximum Length
```typescript
arrayMaxLength(path.items, 10, {
  message: 'Maximum 10 items allowed',
});
```

### Nested Object in Array
```typescript
// Validate fields within nested objects
required(path.items['*'].contact.email, {
  message: 'Email is required',
});
```

## What's Next?

In the next section, we'll add **Cross-Step Validation**, including:
- Validation that spans multiple form steps
- Business rules (down payment >= 20%, monthly payment <= 50% income)
- Age-based validation (minimum/maximum age)
- Async validation (INN, SNILS, email uniqueness)
- Complex cross-field validation

This is where we tie everything together!

---
sidebar_position: 6
---

# Step 5: Additional Information Validation

Validating arrays and their elements with conditional requirements and nested object validation.

## What We're Validating

Step 5 contains array fields that need special validation:

| Field                                   | Validation Rules                                        |
| --------------------------------------- | ------------------------------------------------------- |
| **Properties Array**                    |                                                         |
| `properties`                            | Min 1 item when `hasProperty` = true, max 10 items      |
| `properties[*].type`                    | Required for each item                                  |
| `properties[*].description`             | Required, minLength 10                                  |
| `properties[*].estimatedValue`          | Required, min 0                                         |
| **Existing Loans Array**                |                                                         |
| `existingLoans`                         | Min 1 item when `hasExistingLoans` = true, max 20 items |
| `existingLoans[*].bank`                 | Required for each item                                  |
| `existingLoans[*].amount`               | Required, min 0                                         |
| `existingLoans[*].remainingAmount`      | Optional, min 0                                         |
| **Co-Borrowers Array**                  |                                                         |
| `coBorrowers`                           | Min 1 item when `hasCoBorrower` = true, max 5 items     |
| `coBorrowers[*].personalData.firstName` | Required for each item                                  |
| `coBorrowers[*].personalData.lastName`  | Required for each item                                  |
| `coBorrowers[*].phone`                  | Required, phone format                                  |
| `coBorrowers[*].email`                  | Required, email format                                  |
| `coBorrowers[*].monthlyIncome`          | Required, min 0                                         |

## Creating the Validator File

Create the validator file for Step 5:

```bash
touch src/schemas/validators/additional-info.ts
```

## Implementation

### Properties Array Validation

Start with properties array validation:

```typescript title="src/schemas/validators/additional-info.ts"
import {
  required,
  min,
  minLength,
  email,
  phone,
  applyWhen,
  notEmpty,
  validateItems,
  validate,
} from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { CreditApplicationForm } from '@/types';

/**
 * Validation for element of properties array
 */
const propertyValidation: ValidationSchemaFn<Property> = (path: FieldPath<Property>) => {
  required(path.type, { message: 'Property type is required' });

  required(path.description, { message: 'Property description is required' });
  minLength(path.description, 10, { message: 'Minimum 10 characters for description' });

  required(path.estimatedValue, { message: 'Estimated value is required' });
  min(path.estimatedValue, 0, { message: 'Value must be non-negative' });
};

/**
 * Validation for Step 5: Additional Information
 *
 * Validates:
 * - Properties array (conditional, max 10 items)
 * - Existing loans array (conditional, max 20 items)
 * - Co-borrowers array (conditional, max 5 items)
 * - Array element validation for all arrays
 */
export const additionalValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Properties Array
  // ==========================================

  applyWhen(
    path.hasProperty,
    (has) => has === true,
    (p) => {
      notEmpty(p.properties, { message: 'Add at least one property' });
    }
  );

  // Maximum 10 items in array
  validate(path.properties, (properties) => {
    if (!properties || properties.length <= 10) return null;
    return {
      code: 'maxArrayLength',
      message: 'Maximum 10 properties allowed',
    };
  });

  // Validate each array element
  validateItems(path.properties, propertyValidation);
};
```

:::tip Array Element Validation
Use `validateItems()` to validate all elements in an array:

- Define a separate validation schema function for the array element type
- Pass it to `validateItems()` along with the array path
- Validation runs for each existing array element
- New elements are validated when added
  :::

### Existing Loans Array Validation

Add validation for existing loans:

```typescript title="src/schemas/validators/additional-info.ts"
/**
 * Validation for element of existing loans array
 */
const existingLoanValidation: ValidationSchemaFn<ExistingLoan> = (
  path: FieldPath<ExistingLoan>
) => {
  required(path.bank, { message: 'Bank name is required' });

  required(path.amount, { message: 'Loan amount is required' });
  min(path.amount, 0, { message: 'Amount must be non-negative' });

  min(path.remainingAmount, 0, { message: 'Remaining amount must be non-negative' });

  required(path.monthlyPayment, { message: 'Monthly payment is required' });
  min(path.monthlyPayment, 0, { message: 'Monthly payment must be non-negative' });
};

export const additionalValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // Existing Loans Array
  // ==========================================

  applyWhen(
    path.hasExistingLoans,
    (has) => has === true,
    (p) => {
      notEmpty(p.existingLoans, { message: 'Add at least one existing loan' });
    }
  );

  // Maximum 20 items in array
  validate(path.existingLoans, (loans) => {
    if (!loans || loans.length <= 20) return null;
    return {
      code: 'maxArrayLength',
      message: 'Maximum 20 loans allowed',
    };
  });

  // Validate each array element
  validateItems(path.existingLoans, existingLoanValidation);
};
```

### Co-Borrowers Array Validation

Add validation for co-borrowers with nested object validation:

```typescript title="src/schemas/validators/additional-info.ts"
/**
 * Validation for element of co-borrowers array
 */
const coBorrowerValidation: ValidationSchemaFn<CoBorrower> = (path: FieldPath<CoBorrower>) => {
  required(path.personalData.firstName, { message: 'First name is required' });
  required(path.personalData.lastName, { message: 'Last name is required' });

  required(path.phone, { message: 'Phone number is required' });
  phone(path.phone, { message: 'Invalid phone format' });

  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email format' });

  required(path.monthlyIncome, { message: 'Monthly income is required' });
  min(path.monthlyIncome, 0, { message: 'Income must be non-negative' });

  required(path.relationship, { message: 'Relationship is required' });
};

export const additionalValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // Co-Borrowers Array
  // ==========================================

  applyWhen(
    path.hasCoBorrower,
    (has) => has === true,
    (p) => {
      notEmpty(p.coBorrowers, { message: 'Add at least one co-borrower' });
    }
  );

  // Maximum 5 items in array
  validate(path.coBorrowers, (coBorrowers) => {
    if (!coBorrowers || coBorrowers.length <= 5) return null;
    return {
      code: 'maxArrayLength',
      message: 'Maximum 5 co-borrowers allowed',
    };
  });

  // Validate each array element
  validateItems(path.coBorrowers, coBorrowerValidation);
};
```

## Complete Code

Here's the complete validator for Step 5:

```typescript title="src/schemas/validators/additional-info.ts"
import {
  required,
  min,
  minLength,
  email,
  phone,
  applyWhen,
  notEmpty,
  validateItems,
  validate,
} from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
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
export const additionalValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Properties Array
  // ==========================================

  applyWhen(
    path.hasProperty,
    (has) => has === true,
    (p) => {
      notEmpty(p.properties, { message: 'Add at least one property' });
    }
  );

  validate(path.properties, (properties) => {
    if (!properties || properties.length <= 10) return null;
    return {
      code: 'maxArrayLength',
      message: 'Maximum 10 properties allowed',
    };
  });

  validateItems(path.properties, propertyValidation);

  // ==========================================
  // Existing Loans Array
  // ==========================================

  applyWhen(
    path.hasExistingLoans,
    (has) => has === true,
    (p) => {
      notEmpty(p.existingLoans, { message: 'Add at least one existing loan' });
    }
  );

  validate(path.existingLoans, (loans) => {
    if (!loans || loans.length <= 20) return null;
    return {
      code: 'maxArrayLength',
      message: 'Maximum 20 loans allowed',
    };
  });

  validateItems(path.existingLoans, existingLoanValidation);

  // ==========================================
  // Co-Borrowers Array
  // ==========================================

  applyWhen(
    path.hasCoBorrower,
    (has) => has === true,
    (p) => {
      notEmpty(p.coBorrowers, { message: 'Add at least one co-borrower' });
    }
  );

  validate(path.coBorrowers, (coBorrowers) => {
    if (!coBorrowers || coBorrowers.length <= 5) return null;
    return {
      code: 'maxArrayLength',
      message: 'Maximum 5 co-borrowers allowed',
    };
  });

  validateItems(path.coBorrowers, coBorrowerValidation);
};
```

## How It Works

### Array Length Validation

#### Conditional Not Empty

```typescript
applyWhen(
  path.hasProperty,
  (has) => has === true,
  (p) => {
    notEmpty(p.properties, { message: 'Add at least one property' });
  }
);
```

- Array must not be empty when condition is true
- No validation when condition is false
- Works with behaviors that show/hide arrays

#### Maximum Length

```typescript
validate(path.properties, (properties) => {
  if (!properties || properties.length <= 10) return null;
  return {
    code: 'maxArrayLength',
    message: 'Maximum 10 properties allowed',
  };
});
```

- Custom validation for maximum array length
- Prevents adding more items than allowed
- User sees error when trying to add too many items

### Array Element Validation

Use `validateItems()` to validate all array elements:

```typescript
// Define validation schema for array element
const propertyValidation: ValidationSchemaFn<Property> = (path: FieldPath<Property>) => {
  required(path.type, { message: 'Property type is required' });
  minLength(path.description, 10, { message: 'Minimum 10 characters for description' });
};

// Apply to all items in the array
validateItems(path.properties, propertyValidation);
```

**How it works**:

- Define a validation schema function for the element type
- Pass it to `validateItems()` with the array path
- Validation runs for each existing element
- New elements are validated when added to array
- Removing elements removes their validation errors

### Nested Object Validation

Validate fields within nested objects in arrays:

```typescript
const coBorrowerValidation: ValidationSchemaFn<CoBorrower> = (path: FieldPath<CoBorrower>) => {
  // Validates firstName inside personalData inside each co-borrower
  required(path.personalData.firstName, { message: 'First name is required' });
  required(path.personalData.lastName, { message: 'Last name is required' });
};

validateItems(path.coBorrowers, coBorrowerValidation);
```

**Structure**:

```typescript
coBorrowers: [
  {
    personalData: {
      firstName: 'John', // ← This field
      lastName: 'Doe',
    },
    phone: '+1234567890',
    email: 'john@example.com',
    monthlyIncome: 50000,
  },
];
```

### Integration with Behaviors

From Behaviors section:

```typescript
// Behavior: Show properties array only when checkbox is checked
enableWhen(path.properties, path.hasProperty, (has) => has === true);

// Validation: Require at least one property when visible
applyWhen(
  path.hasProperty,
  (has) => has === true,
  (p) => {
    notEmpty(p.properties, { message: 'Add at least one property' });
  }
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

1. **Array Length** - Use `notEmpty()` and custom `validate()` for length constraints
2. **Element Validation** - Use `validateItems()` with element validation schema
3. **Nested Objects** - Can validate deep nested fields in arrays
4. **Conditional Arrays** - Arrays can be conditionally required with `applyWhen()`
5. **Works with Behaviors** - Hidden arrays skip validation

## Common Patterns

### Conditional Array with Element Validation

```typescript
// Define element validation
const itemValidation: ValidationSchemaFn<Item> = (path: FieldPath<Item>) => {
  required(path.name, { message: 'Name is required' });
  min(path.value, 0, { message: 'Value must be non-negative' });
};

// Array must not be empty when checkbox is true
applyWhen(
  path.hasItems,
  (has) => has === true,
  (p) => {
    notEmpty(p.items, { message: 'Add at least one item' });
  }
);

// Validate each item
validateItems(path.items, itemValidation);
```

### Array with Maximum Length

```typescript
validate(path.items, (items) => {
  if (!items || items.length <= 10) return null;
  return {
    code: 'maxArrayLength',
    message: 'Maximum 10 items allowed',
  };
});
```

### Nested Object in Array

```typescript
// Validate fields within nested objects
const itemValidation: ValidationSchemaFn<Item> = (path: FieldPath<Item>) => {
  required(path.contact.email, { message: 'Email is required' });
};

validateItems(path.items, itemValidation);
```

## What's Next?

In the next section, we'll add **Cross-Step Validation**, including:

- Validation that spans multiple form steps
- Business rules (down payment >= 20%, monthly payment <= 50% income)
- Age-based validation (minimum/maximum age)
- Async validation (INN, SNILS, email uniqueness)
- Complex cross-field validation

This is where we tie everything together!

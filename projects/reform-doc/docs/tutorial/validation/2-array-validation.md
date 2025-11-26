---
sidebar_position: 2
---

# Array Validation

Validating arrays with `notEmpty` and `validateItems`.

## Overview

ReFormer provides specialized validators for working with arrays:

| Validator | Purpose |
|-----------|---------|
| `notEmpty` | Ensure array has at least one item |
| `validateItems` | Apply validation schema to each array item |
| `minLength` | Minimum number of items |
| `maxLength` | Maximum number of items |

## notEmpty

The `notEmpty` validator ensures an array contains at least one item.

```typescript
import { notEmpty } from 'reformer/validators';

notEmpty(path.items, { message: 'Add at least one item' });
```

### Basic Example

```typescript title="src/validators/credit-validators.ts"
import { notEmpty } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  hasProperty: boolean;
  properties: Property[];
}

interface Property {
  address: string;
  value: number;
  type: 'apartment' | 'house' | 'land';
}

export const propertyValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  notEmpty(path.properties, { message: 'Add at least one property' });
};
```

## validateItems

The `validateItems` validator applies a validation schema to each item in an array.

```typescript
import { validateItems } from 'reformer/validators';

validateItems(
  arrayField,     // Array field to validate
  itemValidation  // Validation schema for each item
);
```

### Basic Example

```typescript title="src/validators/existing-loan-validators.ts"
import { validateItems, required, min } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface ExistingLoan {
  bankName: string;
  loanType: string;
  remainingAmount: number;
  monthlyPayment: number;
}

interface CreditApplicationForm {
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];
}

// Validation for a single existing loan
const existingLoanValidation: ValidationSchemaFn<ExistingLoan> = (
  path: FieldPath<ExistingLoan>
) => {
  required(path.bankName, { message: 'Bank name is required' });
  required(path.loanType, { message: 'Loan type is required' });
  min(path.remainingAmount, 0, { message: 'Remaining amount cannot be negative' });
  min(path.monthlyPayment, 0, { message: 'Monthly payment cannot be negative' });
};

// Main form validation
export const loansValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  notEmpty(path.existingLoans, { message: 'Add information about existing loans' });
  validateItems(path.existingLoans, existingLoanValidation);
};
```

### Property List Validation

```typescript title="src/validators/property-list-validators.ts"
import { validateItems, required, min, notEmpty, pattern } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface Property {
  address: string;
  cadastralNumber: string;
  value: number;
  type: 'apartment' | 'house' | 'land';
}

interface CreditApplicationForm {
  hasProperty: boolean;
  properties: Property[];
}

// Validation for a single property
const propertyItemValidation: ValidationSchemaFn<Property> = (path: FieldPath<Property>) => {
  required(path.address, { message: 'Property address is required' });
  required(path.cadastralNumber, { message: 'Cadastral number is required' });
  pattern(path.cadastralNumber, /^\d{2}:\d{2}:\d{6,7}:\d+$/, {
    message: 'Invalid cadastral number format (e.g., 77:01:0001001:123)',
  });
  required(path.type, { message: 'Property type is required' });
  min(path.value, 100000, { message: 'Minimum property value is 100,000' });
};

// Main form validation
export const propertyFormValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  notEmpty(path.properties, { message: 'Add at least one property' });
  validateItems(path.properties, propertyItemValidation);
};
```

## Combining Array Validators

Use multiple validators together for comprehensive array validation:

```typescript title="src/validators/co-borrower-validators.ts"
import {
  notEmpty,
  validateItems,
  minLength,
  maxLength,
  required,
  email,
  min,
  pattern
} from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CoBorrower {
  firstName: string;
  lastName: string;
  birthDate: string;
  email: string;
  phone: string;
  monthlyIncome: number;
  relationship: string;
}

interface CreditApplicationForm {
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];
}

// Co-borrower validation
const coBorrowerValidation: ValidationSchemaFn<CoBorrower> = (path: FieldPath<CoBorrower>) => {
  required(path.firstName, { message: 'First name is required' });
  required(path.lastName, { message: 'Last name is required' });
  required(path.birthDate, { message: 'Birth date is required' });
  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email format' });
  required(path.phone, { message: 'Phone is required' });
  pattern(path.phone, /^\+7\d{10}$/, { message: 'Phone format: +7XXXXXXXXXX' });
  required(path.relationship, { message: 'Relationship is required' });
  min(path.monthlyIncome, 10000, { message: 'Minimum monthly income is 10,000' });
};

// Credit application validation
export const coBorrowerFormValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Array must not be empty
  notEmpty(path.coBorrowers, { message: 'Add at least one co-borrower' });

  // Array length limits
  minLength(path.coBorrowers, 1, { message: 'At least 1 co-borrower required' });
  maxLength(path.coBorrowers, 3, { message: 'Maximum 3 co-borrowers allowed' });

  // Validate each co-borrower
  validateItems(path.coBorrowers, coBorrowerValidation);
};
```

## Nested Arrays

Validate nested arrays with recursive validation schemas:

```typescript title="src/validators/nested-validators.ts"
import { validateItems, required, notEmpty } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface Task {
  title: string;
  completed: boolean;
}

interface Project {
  name: string;
  tasks: Task[];
}

interface Portfolio {
  title: string;
  projects: Project[];
}

// Task validation
const taskValidation: ValidationSchemaFn<Task> = (path: FieldPath<Task>) => {
  required(path.title, { message: 'Task title is required' });
};

// Project validation (includes nested tasks)
const projectValidation: ValidationSchemaFn<Project> = (path: FieldPath<Project>) => {
  required(path.name, { message: 'Project name is required' });
  notEmpty(path.tasks, { message: 'Add at least one task' });
  validateItems(path.tasks, taskValidation);
};

// Portfolio validation (includes nested projects)
export const portfolioValidation: ValidationSchemaFn<Portfolio> = (path) => {
  required(path.title, { message: 'Portfolio title is required' });
  notEmpty(path.projects, { message: 'Add at least one project' });
  validateItems(path.projects, projectValidation);
};
```

## Credit Application Example

Real-world example from a credit application form:

```typescript title="src/validators/credit-validators.ts"
import {
  notEmpty,
  validateItems,
  required,
  min,
  pattern
} from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface Property {
  address: string;
  cadastralNumber: string;
  value: number;
  type: 'apartment' | 'house' | 'land';
}

interface Vehicle {
  brand: string;
  model: string;
  year: number;
  value: number;
  registrationNumber: string;
}

interface CreditApplicationForm {
  hasProperty: boolean;
  properties: Property[];
  hasVehicles: boolean;
  vehicles: Vehicle[];
}

// Property item validation
const propertyValidation: ValidationSchemaFn<Property> = (path: FieldPath<Property>) => {
  required(path.address, { message: 'Property address is required' });
  required(path.cadastralNumber, { message: 'Cadastral number is required' });
  pattern(path.cadastralNumber, /^\d{2}:\d{2}:\d{6,7}:\d+$/, {
    message: 'Invalid cadastral number format',
  });
  required(path.type, { message: 'Property type is required' });
  min(path.value, 100000, { message: 'Minimum property value is 100,000' });
};

// Vehicle item validation
const vehicleValidation: ValidationSchemaFn<Vehicle> = (path: FieldPath<Vehicle>) => {
  required(path.brand, { message: 'Vehicle brand is required' });
  required(path.model, { message: 'Vehicle model is required' });
  min(path.year, 1990, { message: 'Vehicle year must be 1990 or later' });
  min(path.value, 0, { message: 'Vehicle value cannot be negative' });
  required(path.registrationNumber, { message: 'Registration number is required' });
};

// Main form validation for additional sections
export const additionalValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Properties validation
  notEmpty(path.properties, { message: 'Add at least one property' });
  validateItems(path.properties, propertyValidation);

  // Vehicles validation
  notEmpty(path.vehicles, { message: 'Add at least one vehicle' });
  validateItems(path.vehicles, vehicleValidation);
};
```

## Conditional Array Validation

Validate arrays only when certain conditions are met:

```typescript title="src/validators/conditional-array-validators.ts"
import { notEmpty, validateItems, applyWhen, required, min, pattern } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface Property {
  address: string;
  cadastralNumber: string;
  value: number;
  type: 'apartment' | 'house' | 'land';
}

interface CreditApplicationForm {
  hasProperty: boolean;
  properties: Property[];
}

// Property validation
const propertyValidation: ValidationSchemaFn<Property> = (path: FieldPath<Property>) => {
  required(path.address, { message: 'Property address is required' });
  required(path.cadastralNumber, { message: 'Cadastral number is required' });
  pattern(path.cadastralNumber, /^\d{2}:\d{2}:\d{6,7}:\d+$/, {
    message: 'Invalid cadastral number format',
  });
  required(path.type, { message: 'Property type is required' });
  min(path.value, 100000, { message: 'Minimum property value is 100,000' });
};

// Credit application validation
export const propertyFormValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Only validate properties array when hasProperty is true
  applyWhen(
    path.hasProperty,
    (value) => value === true,
    (path) => {
      notEmpty(path.properties, { message: 'Add at least one property' });
      validateItems(path.properties, propertyValidation);
    }
  );
};
```

## Complex Nested Structure

Validate deeply nested structures with arrays and objects:

```typescript title="src/validators/co-borrower-nested-validators.ts"
import {
  validateItems,
  required,
  email,
  notEmpty,
  pattern,
  min
} from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface Address {
  street: string;
  city: string;
  postalCode: string;
}

interface ContactInfo {
  email: string;
  phone: string;
  address: Address;
}

interface CoBorrower {
  firstName: string;
  lastName: string;
  contact: ContactInfo;
  monthlyIncome: number;
}

interface CreditApplicationForm {
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];
}

// Address validation
const addressValidation: ValidationSchemaFn<Address> = (path: FieldPath<Address>) => {
  required(path.street, { message: 'Street is required' });
  required(path.city, { message: 'City is required' });
  required(path.postalCode, { message: 'Postal code is required' });
  pattern(path.postalCode, /^\d{6}$/, { message: 'Postal code must be 6 digits' });
};

// Contact validation
const contactValidation: ValidationSchemaFn<ContactInfo> = (path: FieldPath<ContactInfo>) => {
  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email format' });
  required(path.phone, { message: 'Phone is required' });
  pattern(path.phone, /^\+7\d{10}$/, { message: 'Phone format: +7XXXXXXXXXX' });
  // Note: nested object validation would use apply() for address
};

// Co-borrower validation
const coBorrowerValidation: ValidationSchemaFn<CoBorrower> = (path: FieldPath<CoBorrower>) => {
  required(path.firstName, { message: 'First name is required' });
  required(path.lastName, { message: 'Last name is required' });
  min(path.monthlyIncome, 10000, { message: 'Minimum income is 10,000' });
  // Note: nested object validation would use apply() for contact
};

// Credit application validation
export const coBorrowerFormValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  notEmpty(path.coBorrowers, { message: 'Add at least one co-borrower' });
  validateItems(path.coBorrowers, coBorrowerValidation);
};
```

## Best Practices

### 1. Always Validate Array Existence First

```typescript
// ✅ Check array is not empty before validating items
notEmpty(path.properties, { message: 'Add at least one property' });
validateItems(path.properties, propertyValidation);

// ❌ Validating items without checking array existence
validateItems(path.properties, propertyValidation);
```

### 2. Create Reusable Item Validators

```typescript
// ✅ Separate item validation for reuse
const propertyValidation: ValidationSchemaFn<Property> = (path) => {
  required(path.address, { message: 'Address is required' });
  required(path.type, { message: 'Property type is required' });
  min(path.value, 100000, { message: 'Minimum value is 100,000' });
};

// Use in multiple places
validateItems(path.properties, propertyValidation);
validateItems(path.inheritedProperties, propertyValidation);

// ❌ Duplicating validation logic inline
```

### 3. Use Conditional Validation for Optional Arrays

```typescript
// ✅ Only validate when the array should have items
applyWhen(
  path.hasCoBorrower,
  (value) => value === true,
  (path) => {
    notEmpty(path.coBorrowers, { message: 'Add co-borrower information' });
    validateItems(path.coBorrowers, coBorrowerValidation);
  }
);

// ❌ Always requiring items even when not applicable
notEmpty(path.coBorrowers, { message: 'Add co-borrower information' });
```

### 4. Set Reasonable Limits

```typescript
// ✅ Set both minimum and maximum limits
notEmpty(path.coBorrowers, { message: 'Add at least one co-borrower' });
maxLength(path.coBorrowers, 3, { message: 'Maximum 3 co-borrowers allowed' });
validateItems(path.coBorrowers, coBorrowerValidation);

// ❌ No upper limit - potential performance issues
```

### 5. Clear Error Messages

```typescript
// ✅ Context-specific messages
notEmpty(path.existingLoans, { message: 'Add information about existing loans' });
notEmpty(path.properties, { message: 'Add at least one property to continue' });

// ❌ Generic messages
notEmpty(path.existingLoans, { message: 'Required' });
notEmpty(path.properties, { message: 'Cannot be empty' });
```

## Next Step

Now that you understand array validation, let's learn about conditional validation with `applyWhen`.

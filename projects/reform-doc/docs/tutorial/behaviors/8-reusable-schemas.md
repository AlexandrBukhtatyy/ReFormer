---
sidebar_position: 8
---

# Reusable Behavior Schemas

Creating reusable behavior schemas for common patterns.

## Overview

When the same behavior patterns appear across multiple forms, you can extract them into reusable behavior schemas. This approach:

- Eliminates code duplication
- Ensures consistent behavior across forms
- Makes testing easier
- Simplifies maintenance

## Creating a Reusable Behavior Schema

A reusable behavior schema is a `BehaviorSchemaFn` designed for a specific nested structure:

```typescript title="src/behaviors/address-behavior.ts"
import { watchField, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';
import { fetchCities } from '../api';

// Define the Address interface
export interface Address {
  region: string;
  city: string;
  street: string;
  postalCode: string;
}

/**
 * Reusable behavior schema for Address fields
 *
 * Features:
 * - Loads cities when region changes
 * - Clears city when region changes
 * - Auto-formats postal code
 */
export const addressBehavior: BehaviorSchemaFn<Address> = (path: FieldPath<Address>) => {
  // Load cities when region changes
  watchField(
    path.region,
    async (region, ctx) => {
      if (region) {
        try {
          const { data: cities } = await fetchCities(region);
          ctx.form.city.updateComponentProps({ options: cities });
        } catch (error) {
          console.error('Failed to load cities:', error);
          ctx.form.city.updateComponentProps({ options: [] });
        }
      }
    },
    { debounce: 300, immediate: false }
  );

  // Clear city when region changes
  watchField(
    path.region,
    (_region, ctx) => {
      ctx.setFieldValue('city', '');
    },
    { immediate: false }
  );

  // Auto-format postal code
  watchField(
    path.postalCode,
    (postalCode, ctx) => {
      const cleaned = postalCode?.replace(/\D/g, '').slice(0, 6);
      if (cleaned !== postalCode) {
        ctx.setFieldValue('postalCode', cleaned || '');
      }
    },
    { immediate: false }
  );
};
```

## Applying Reusable Behaviors

### Direct Application

Apply the behavior directly in a form's behavior schema:

```typescript title="src/behaviors/user-form-behavior.ts"
import { type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';
import { addressBehavior, type Address } from './address-behavior';

interface UserForm {
  name: string;
  email: string;
  address: Address;
}

export const userFormBehavior: BehaviorSchemaFn<UserForm> = (path: FieldPath<UserForm>) => {
  // Apply address behavior to the nested address field
  addressBehavior(path.address);
};
```

### Multiple Instances

Apply the same behavior to multiple fields:

```typescript title="src/behaviors/credit-application-behavior.ts"
import { copyFrom, enableWhen, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';
import { addressBehavior, type Address } from './address-behavior';

interface CreditApplicationForm {
  sameAsRegistration: boolean;
  registrationAddress: Address;
  residenceAddress: Address;
}

export const creditApplicationBehavior: BehaviorSchemaFn<CreditApplicationForm> = (path: FieldPath<CreditApplicationForm>) => {
  // Apply address behavior to both address fields
  addressBehavior(path.registrationAddress);
  addressBehavior(path.residenceAddress);

  // Copy registration → residence when checkbox is checked
  copyFrom(path.residenceAddress, path.registrationAddress, {
    when: (form) => form.sameAsRegistration === true,
    fields: 'all',
  });

  // Disable residence address when same as registration
  enableWhen(path.residenceAddress, (form) => !form.sameAsRegistration, {
    resetOnDisable: true,
  });
};
```

## Composing Behavior Schemas

Create higher-level behaviors by composing smaller ones:

```typescript title="src/behaviors/complete-user-behavior.ts"
import { computeFrom, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';
import { addressBehavior } from './address-behavior';
import { personalDataBehavior } from './personal-data-behavior';
import { contactBehavior } from './contact-behavior';

interface CompleteUserForm {
  personalData: {
    lastName: string;
    firstName: string;
    middleName: string;
    birthDate: string;
  };
  contact: {
    phone: string;
    email: string;
    emailAdditional: string;
  };
  address: Address;
  fullName: string;
  age: number;
}

export const completeUserBehavior: BehaviorSchemaFn<CompleteUserForm> = (path: FieldPath<CompleteUserForm>) => {
  // Apply modular behaviors
  personalDataBehavior(path.personalData);
  contactBehavior(path.contact);
  addressBehavior(path.address);

  // Add form-specific computations
  computeFrom([path.personalData], path.fullName, (values) => {
    const data = values.personalData as CompleteUserForm['personalData'];
    return [data.lastName, data.firstName, data.middleName].filter(Boolean).join(' ');
  });

  computeFrom([path.personalData], path.age, (values) => {
    const data = values.personalData as CompleteUserForm['personalData'];
    if (!data?.birthDate) return 0;
    const birth = new Date(data.birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  });
};
```

## Personal Data Behavior Example

```typescript title="src/behaviors/personal-data-behavior.ts"
import { computeFrom, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface PersonalData {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
}

export const personalDataBehavior: BehaviorSchemaFn<PersonalData> = (path: FieldPath<PersonalData>) => {
  // Could add behaviors for:
  // - Name capitalization
  // - Birth date validation
  // - Age-based restrictions
};
```

## Contact Behavior Example

```typescript title="src/behaviors/contact-behavior.ts"
import { copyFrom, watchField, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface Contact {
  phone: string;
  email: string;
  emailAdditional: string;
  sameEmail?: boolean;
}

export const contactBehavior: BehaviorSchemaFn<Contact> = (path: FieldPath<Contact>) => {
  // Format phone number
  watchField(
    path.phone,
    (phone, ctx) => {
      const cleaned = phone?.replace(/\D/g, '').slice(0, 11);
      if (cleaned !== phone) {
        ctx.form.phone.setValue(cleaned || '');
      }
    },
    { immediate: false }
  );

  // Lowercase email
  watchField(
    path.email,
    (email, ctx) => {
      const lower = email?.toLowerCase();
      if (lower !== email) {
        ctx.form.email.setValue(lower || '');
      }
    },
    { immediate: false }
  );

  // Copy email to additional email if sameEmail
  if ('sameEmail' in path) {
    copyFrom(path.emailAdditional, path.email, {
      when: (form) => form.sameEmail === true,
    });
  }
};
```

## Loan Calculation Behavior

A more complex reusable behavior for loan calculations:

```typescript title="src/behaviors/loan-calculation-behavior.ts"
import { computeFrom, watchField, revalidateWhen, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface LoanFields {
  loanAmount: number;
  loanTerm: number;
  interestRate: number;
  monthlyPayment: number;
  totalPayment: number;
  overpayment: number;
}

const calculateMonthlyPayment = (amount: number, termMonths: number, annualRate: number): number => {
  if (!amount || !termMonths || annualRate <= 0) return 0;

  const monthlyRate = annualRate / 100 / 12;
  const factor = Math.pow(1 + monthlyRate, termMonths);
  return (amount * monthlyRate * factor) / (factor - 1);
};

export const loanCalculationBehavior: BehaviorSchemaFn<LoanFields> = (path: FieldPath<LoanFields>) => {
  // Calculate monthly payment
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    (values) => {
      const amount = values.loanAmount as number;
      const term = values.loanTerm as number;
      const rate = values.interestRate as number;
      return Math.round(calculateMonthlyPayment(amount, term, rate));
    }
  );

  // Calculate total payment
  computeFrom(
    [path.monthlyPayment, path.loanTerm],
    path.totalPayment,
    (values) => {
      const monthly = values.monthlyPayment as number;
      const term = values.loanTerm as number;
      return Math.round(monthly * term);
    }
  );

  // Calculate overpayment
  computeFrom(
    [path.totalPayment, path.loanAmount],
    path.overpayment,
    (values) => {
      const total = values.totalPayment as number;
      const amount = values.loanAmount as number;
      return Math.max(0, total - amount);
    }
  );

  // Revalidate amount when rate changes
  revalidateWhen(path.loanAmount, [path.interestRate]);
};
```

## Best Practices

### 1. Define Clear Interfaces

```typescript
// ✅ Clear interface definition
export interface Address {
  region: string;
  city: string;
  street: string;
  postalCode: string;
}

export const addressBehavior: BehaviorSchemaFn<Address> = (path) => {
  // ...
};

// ❌ Unclear structure
export const addressBehavior = (path: any) => {
  // ...
};
```

### 2. Export Interfaces with Behaviors

```typescript title="src/behaviors/index.ts"
// Export both the behavior and its interface
export { addressBehavior, type Address } from './address-behavior';
export { contactBehavior, type Contact } from './contact-behavior';
export { loanCalculationBehavior, type LoanFields } from './loan-calculation-behavior';
```

### 3. Keep Behaviors Modular

```typescript
// ✅ Focused, single-purpose behavior
export const addressBehavior: BehaviorSchemaFn<Address> = (path) => {
  // Only address-related logic
};

// ❌ Behavior doing too much
export const addressAndValidationAndLoadingBehavior: BehaviorSchemaFn<Address> = (path) => {
  // Address logic + validation + loading states + ...
};
```

### 4. Document Dependencies

```typescript
/**
 * Address behavior for cascading selects
 *
 * Dependencies:
 * - fetchCities API function
 *
 * @requires Form schema must have Select component for city field
 * @requires Options property on city field componentProps
 */
export const addressBehavior: BehaviorSchemaFn<Address> = (path) => {
  // ...
};
```

### 5. Handle Edge Cases

```typescript
export const addressBehavior: BehaviorSchemaFn<Address> = (path) => {
  watchField(path.region, async (region, ctx) => {
    // Handle empty region
    if (!region) {
      ctx.form.city.updateComponentProps({ options: [] });
      return;
    }

    try {
      const cities = await fetchCities(region);
      ctx.form.city.updateComponentProps({ options: cities });
    } catch (error) {
      // Handle API errors gracefully
      console.error('Failed to load cities:', error);
      ctx.form.city.updateComponentProps({ options: [] });
    }
  }, { immediate: false, debounce: 300 });
};
```

## Testing Reusable Behaviors

```typescript title="src/behaviors/__tests__/address-behavior.test.ts"
import { GroupNode } from 'reformer';
import { addressBehavior, addressSchema } from '../address-behavior';

describe('addressBehavior', () => {
  let form: GroupNode<Address>;

  beforeEach(() => {
    form = new GroupNode({
      form: addressSchema,
      behavior: addressBehavior,
    });
  });

  it('should clear city when region changes', () => {
    form.city.setValue('Moscow');
    form.region.setValue('new-region');
    expect(form.city.getValue()).toBe('');
  });

  it('should format postal code to 6 digits', () => {
    form.postalCode.setValue('123-456-789');
    expect(form.postalCode.getValue()).toBe('123456');
  });

  it('should load cities when region is set', async () => {
    // Mock fetchCities API
    jest.mock('../api', () => ({
      fetchCities: jest.fn().mockResolvedValue({ data: [
        { value: 'city1', label: 'City 1' },
        { value: 'city2', label: 'City 2' },
      ]}),
    }));

    form.region.setValue('test-region');

    await new Promise((r) => setTimeout(r, 400)); // Wait for debounce

    const options = form.city.componentProps.value.options;
    expect(options).toHaveLength(2);
  });
});
```

## Summary

Reusable behavior schemas help you:

- **Reduce duplication** — Write behavior logic once, use everywhere
- **Ensure consistency** — Same behavior pattern across all forms
- **Simplify testing** — Test behavior in isolation
- **Improve maintainability** — Update logic in one place

Key patterns:
1. Define clear interfaces for behavior types
2. Export behaviors with their interfaces
3. Compose behaviors for complex forms
4. Document dependencies and requirements
5. Test behaviors in isolation

You've now completed the Behaviors section of the tutorial. You understand how to use built-in behaviors and create custom, reusable behavior schemas for your forms.

---
sidebar_position: 1
---

# Computed Fields

Creating automatically calculated fields with `computeFrom`.

## Overview

Computed fields automatically calculate their values based on other form fields. Common use cases:

- `fullName` = `firstName` + ` ` + `lastName`
- `totalIncome` = `salary` + `additionalIncome`
- `age` calculated from date of birth
- `monthlyPayment` calculated from loan amount, term, and interest rate

## computeFrom

The `computeFrom` behavior watches specified source fields and automatically updates the target field when any source changes.

```typescript
import { computeFrom } from 'reformer/behaviors';

computeFrom(
  sourceFields,    // Array of field paths to watch
  targetField,     // Field path to update
  computeFn        // Function that computes the new value
);
```

### Basic Example: Initial Payment Calculation

```typescript title="src/behaviors/credit-application-behavior.ts"
import { computeFrom, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface CreditApplicationForm {
  loanAmount: number;
  initialPaymentPercent: number;
  initialPayment: number;
}

export const creditBehavior: BehaviorSchemaFn<CreditApplicationForm> = (path: FieldPath<CreditApplicationForm>) => {
  // initialPayment = loanAmount × initialPaymentPercent / 100
  computeFrom(
    [path.loanAmount, path.initialPaymentPercent],
    path.initialPayment,
    (values) => {
      const amount = values.loanAmount as number;
      const percent = values.initialPaymentPercent as number;
      return amount && percent ? Math.round((amount * percent) / 100) : 0;
    }
  );
};
```

### Full Name Computation

```typescript title="src/behaviors/personal-data-behavior.ts"
interface CreditApplicationForm {
  firstName: string;
  lastName: string;
  middleName: string;
  fullName: string;
}

export const personalDataBehavior: BehaviorSchemaFn<CreditApplicationForm> = (path: FieldPath<CreditApplicationForm>) => {
  // Automatically compute full name from parts (Russian FIO format)
  computeFrom(
    [path.firstName, path.lastName, path.middleName],
    path.fullName,
    (values) => {
      const parts = [
        values.lastName,
        values.firstName,
        values.middleName,
      ].filter(Boolean);
      return parts.join(' ');
    }
  );
};
```

### Age from Birth Date

```typescript title="src/behaviors/age-computation-behavior.ts"
interface CreditApplicationForm {
  birthDate: string;
  age: number;
}

const computeAge = (values: Record<string, unknown>): number => {
  const birthDate = values.birthDate as string;
  if (!birthDate) return 0;

  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
};

export const ageBehavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // Automatically compute applicant's age
  computeFrom([path.birthDate], path.age, computeAge);
};
```

## Complex Computed Fields

### Loan Monthly Payment

Calculate monthly payment using the annuity formula:

```typescript title="src/behaviors/monthly-payment-behavior.ts"
interface CreditApplicationForm {
  loanAmount: number;
  loanTerm: number;      // months
  interestRate: number;  // annual percentage
  monthlyPayment: number;
}

const computeMonthlyPayment = (values: Record<string, unknown>): number => {
  const amount = values.loanAmount as number;
  const termMonths = values.loanTerm as number;
  const annualRate = values.interestRate as number;

  if (!amount || !termMonths || !annualRate) return 0;

  // Monthly interest rate
  const monthlyRate = annualRate / 100 / 12;

  // Annuity formula: P = A * (r * (1+r)^n) / ((1+r)^n - 1)
  const factor = Math.pow(1 + monthlyRate, termMonths);
  const payment = amount * (monthlyRate * factor) / (factor - 1);

  return Math.round(payment);
};

export const monthlyPaymentBehavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // Automatically calculate monthly payment based on loan parameters
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    computeMonthlyPayment
  );
};
```

### Interest Rate Based on Multiple Factors

```typescript title="src/behaviors/interest-rate-behavior.ts"
interface CreditApplicationForm {
  loanType: 'mortgage' | 'car' | 'consumer';
  registrationAddress: {
    city: string;
  };
  hasProperty: boolean;
  interestRate: number;
}

const computeInterestRate = (values: Record<string, unknown>): number => {
  const loanType = values.loanType as string;
  const address = values.registrationAddress as { city: string };
  const hasProperty = values.hasProperty as boolean;

  // Base rates
  const baseRates: Record<string, number> = {
    mortgage: 8.5,
    car: 12.0,
    consumer: 15.0,
  };

  let rate = baseRates[loanType] || 15.0;

  // Region discount for major cities
  const city = address?.city || '';
  if (city === 'Москва' || city === 'Санкт-Петербург') {
    rate -= 0.5;
  }

  // Property collateral discount
  if (hasProperty) {
    rate -= 1.0;
  }

  return Math.max(rate, 5.0); // Minimum 5%
};

export const interestRateBehavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // Dynamically compute interest rate based on loan type, region, and collateral
  computeFrom(
    [path.loanType, path.registrationAddress, path.hasProperty],
    path.interestRate,
    computeInterestRate
  );
};
```

### Computing from Nested Groups

When computing from nested structures in the credit application:

```typescript title="src/behaviors/nested-computation-behavior.ts"
interface PersonalData {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
}

interface CreditApplicationForm {
  personalData: PersonalData;
  fullName: string;
  age: number;
}

const computeFullName = (values: Record<string, unknown>): string => {
  const personalData = values.personalData as PersonalData;
  if (!personalData) return '';

  return [
    personalData.lastName,
    personalData.firstName,
    personalData.middleName,
  ].filter(Boolean).join(' ');
};

const computeAge = (values: Record<string, unknown>): number => {
  const personalData = values.personalData as PersonalData;
  if (!personalData?.birthDate) return 0;

  const birth = new Date(personalData.birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

export const nestedComputationBehavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // Watch the entire personalData group for changes
  computeFrom([path.personalData], path.fullName, computeFullName);
  computeFrom([path.personalData], path.age, computeAge);
};
```

### Computing from Arrays

Sum values from an array of co-borrowers:

```typescript title="src/behaviors/total-income-behavior.ts"
interface CoBorrower {
  monthlyIncome: number;
}

interface CreditApplicationForm {
  coBorrowers: CoBorrower[];
  totalCoBorrowersIncome: number;
}

const computeCoBorrowersIncome = (values: Record<string, unknown>): number => {
  const coBorrowers = values.coBorrowers as CoBorrower[];
  if (!coBorrowers || coBorrowers.length === 0) return 0;

  return coBorrowers.reduce((sum, cb) => sum + (cb.monthlyIncome || 0), 0);
};

export const totalIncomeBehavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // Automatically sum co-borrowers' incomes
  computeFrom([path.coBorrowers], path.totalCoBorrowersIncome, computeCoBorrowersIncome);
};
```

## Displaying Computed Fields

Computed fields are typically displayed as read-only:

```tsx title="src/components/LoanSummary.tsx"
import { useFormControl } from 'reformer';

function LoanSummary({ control }: CreditApplicationFormProps) {
  const { value: monthlyPayment } = useFormControl(control.monthlyPayment);
  const { value: totalAmount } = useFormControl(control.loanAmount);
  const { value: term } = useFormControl(control.loanTerm);

  return (
    <div className="p-4 bg-gray-100 rounded">
      <h3 className="font-semibold mb-2">Loan Summary</h3>
      <div className="flex justify-between">
        <span>Monthly Payment:</span>
        <span className="font-bold">{monthlyPayment.toLocaleString()} ₽</span>
      </div>
      <div className="flex justify-between text-sm text-gray-600">
        <span>Total to repay:</span>
        <span>{(monthlyPayment * term).toLocaleString()} ₽</span>
      </div>
    </div>
  );
}
```

Or define the field as disabled in the schema:

```typescript title="src/schemas/credit-application-schema.ts"
const creditApplicationSchema: FormSchema<CreditApplicationForm> = {
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Monthly Payment',
      type: 'number',
      disabled: true,  // Always read-only
      suffix: '₽',
    },
  },
};
```

## Best Practices

### 1. Extract Compute Functions

Keep compute functions separate for testability:

```typescript
// utils/loan-calculations.ts
export const computeMonthlyPayment = (values: Record<string, unknown>): number => {
  const amount = values.loanAmount as number;
  const term = values.loanTerm as number;
  const rate = values.interestRate as number;

  if (!amount || !term || !rate) return 0;

  const monthlyRate = rate / 100 / 12;
  const factor = Math.pow(1 + monthlyRate, term);
  return Math.round(amount * (monthlyRate * factor) / (factor - 1));
};

// behaviors/loan-behavior.ts
import { computeMonthlyPayment } from '../utils/loan-calculations';

export const loanBehavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    computeMonthlyPayment
  );
};
```

### 2. Handle Edge Cases

Always handle missing or invalid values:

```typescript
const computeMonthlyPayment = (values: Record<string, unknown>): number => {
  const amount = values.loanAmount as number;
  const term = values.loanTerm as number;
  const rate = values.interestRate as number;

  // Handle edge cases
  if (!amount || !term || !rate) {
    return 0;
  }

  if (amount < 0 || term <= 0 || rate < 0) {
    return 0;
  }

  const monthlyRate = rate / 100 / 12;
  const factor = Math.pow(1 + monthlyRate, term);
  return Math.round(amount * (monthlyRate * factor) / (factor - 1));
};
```

### 3. Avoid Circular Dependencies

Don't create circular compute chains:

```typescript
// ❌ BAD: Circular dependency
computeFrom([path.a], path.b, computeB);
computeFrom([path.b], path.a, computeA); // Creates infinite loop!

// ✅ GOOD: One-directional flow
computeFrom([path.price, path.quantity], path.subtotal, computeSubtotal);
computeFrom([path.subtotal, path.taxRate], path.total, computeTotal);
```

## Next Step

Now that you understand computed fields, let's learn about controlling field visibility with `showWhen` and `hideWhen`.
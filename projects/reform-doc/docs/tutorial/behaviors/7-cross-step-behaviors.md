---
sidebar_position: 7
---

# Cross-Step Behaviors

Coordinating behaviors across multiple form steps.

## Overview

Some behaviors need data from multiple steps. These cross-step behaviors handle:

1. **Payment-to-Income Ratio** - Uses Step 1 (payment) and Step 4/5 (income)
2. **Smart Revalidation** - Triggers validation when dependencies change
3. **Age-Based Access Control** - Uses Step 2 (age) to control Step 1 (loan fields)
4. **Analytics Tracking** - Monitors user behavior across the form

## Why Separate Cross-Step Behaviors?

Benefits of separation:
- **Clarity** - Easy to see which behaviors span multiple steps
- **Maintainability** - Changes to step behaviors don't affect cross-step logic
- **Documentation** - Cross-step dependencies are explicit

## Implementation

```typescript title="src/behaviors/cross-step.behaviors.ts"
import { computeFrom, disableWhen, revalidateWhen, watch } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

export const crossStepBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // 1. Payment-to-Income Ratio
  //    Step 1: monthlyPayment
  //    Step 4: totalIncome
  //    Step 5: coBorrowersIncome
  // ==========================================
  computeFrom(
    [path.monthlyPayment, path.totalIncome, path.coBorrowersIncome],
    path.paymentToIncomeRatio,
    (values) => {
      const payment = values.monthlyPayment as number;
      const mainIncome = values.totalIncome as number;
      const coIncome = values.coBorrowersIncome as number;

      const totalHouseholdIncome = (mainIncome || 0) + (coIncome || 0);
      if (!totalHouseholdIncome || !payment) return 0;

      return Math.round((payment / totalHouseholdIncome) * 100);
    }
  );

  // Disable paymentToIncomeRatio (read-only)
  disableWhen(path.paymentToIncomeRatio, path.paymentToIncomeRatio, () => true);

  // ==========================================
  // 2. Revalidate Payment When Income Changes
  //    Validation checks if payment <= 50% of income
  // ==========================================
  revalidateWhen(path.monthlyPayment, [path.totalIncome, path.coBorrowersIncome]);

  // ==========================================
  // 3. Age-Based Access Control
  //    Step 2: age
  //    Step 1: loan fields
  // ==========================================
  disableWhen(path.loanAmount, path.age, (age) => (age as number) < 18);
  disableWhen(path.loanTerm, path.age, (age) => (age as number) < 18);
  disableWhen(path.loanPurpose, path.age, (age) => (age as number) < 18);

  // ==========================================
  // 4. Analytics Tracking
  // ==========================================
  watch(path.loanAmount, (value) => {
    console.log('Loan amount changed:', value);
    // window.analytics?.track('loan_amount_changed', { amount: value });
  });

  watch(path.interestRate, (value) => {
    console.log('Interest rate computed:', value);
    // window.analytics?.track('interest_rate_computed', { rate: value });
  });

  watch(path.employmentStatus, (value) => {
    console.log('Employment status changed:', value);
    // window.analytics?.track('employment_status_changed', { status: value });
  });
};
```

## Understanding Each Behavior

### 1. Payment-to-Income Ratio

This is a critical metric for loan approval:
- **Input**: Monthly payment, applicant income, co-borrowers income
- **Output**: Percentage (e.g., 35% means payment is 35% of income)
- **Use**: Banks typically require ratio < 50%

**Dependency chain:**
```
loanAmount, loanTerm, interestRate
    ↓
monthlyPayment (Step 1)
    ↓
paymentToIncomeRatio ← totalIncome (Step 4)
                      ← coBorrowersIncome (Step 5)
```

### 2. Smart Revalidation

When income changes, we need to revalidate the payment:

```typescript
// Validation rule (implemented in Validation section)
createValidator(
  path.monthlyPayment,
  [path.totalIncome, path.coBorrowersIncome],
  (payment, [income, coIncome]) => {
    const total = (income || 0) + (coIncome || 0);
    if (payment > total * 0.5) {
      return { message: 'Payment exceeds 50% of income' };
    }
    return null;
  }
);

// Behavior: Trigger revalidation when income changes
revalidateWhen(path.monthlyPayment, [path.totalIncome, path.coBorrowersIncome]);
```

**Why needed:**
- User fills loan info first (Step 1)
- Then fills income (Step 4)
- Payment validation should run again with new income data
- Without `revalidateWhen`, validation only runs when payment changes

### 3. Age-Based Access Control

Prevent minors from applying for loans:

```typescript
disableWhen(path.loanAmount, path.age, (age) => (age as number) < 18);
```

**Flow:**
1. User enters birth date (Step 2)
2. Age is computed automatically
3. If age < 18, loan fields in Step 1 become disabled
4. User cannot proceed with application

This demonstrates **backward dependencies** - Step 2 data affects Step 1 UI.

### 4. Analytics Tracking

Monitor user behavior for insights:

```typescript
watch(path.loanAmount, (value) => {
  // Track loan amount changes
  window.analytics?.track('loan_amount_changed', { amount: value });
});
```

**Use cases:**
- Track which loan types are most popular
- Monitor interest rate distribution
- Analyze drop-off points in the form
- A/B testing different form flows

:::tip Production Analytics
In production, integrate with your analytics platform:
```typescript
import { analytics } from '@/services/analytics';

watch(path.loanAmount, (value) => {
  analytics.track('LoanAmountChanged', {
    amount: value,
    timestamp: Date.now(),
    sessionId: getSessionId(),
  });
});
```
:::

## Complete Code

```typescript title="src/behaviors/cross-step.behaviors.ts"
import { computeFrom, disableWhen, revalidateWhen, watch } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

export const crossStepBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Payment-to-Income Ratio
  computeFrom(
    [path.monthlyPayment, path.totalIncome, path.coBorrowersIncome],
    path.paymentToIncomeRatio,
    (values) => {
      const payment = values.monthlyPayment as number;
      const mainIncome = values.totalIncome as number;
      const coIncome = values.coBorrowersIncome as number;

      const totalHouseholdIncome = (mainIncome || 0) + (coIncome || 0);
      if (!totalHouseholdIncome || !payment) return 0;

      return Math.round((payment / totalHouseholdIncome) * 100);
    }
  );

  disableWhen(path.paymentToIncomeRatio, path.paymentToIncomeRatio, () => true);

  // Smart Revalidation
  revalidateWhen(path.monthlyPayment, [path.totalIncome, path.coBorrowersIncome]);

  // Age-Based Access Control
  disableWhen(path.loanAmount, path.age, (age) => (age as number) < 18);
  disableWhen(path.loanTerm, path.age, (age) => (age as number) < 18);
  disableWhen(path.loanPurpose, path.age, (age) => (age as number) < 18);

  // Analytics Tracking
  watch(path.loanAmount, (value) => {
    console.log('Loan amount changed:', value);
  });

  watch(path.interestRate, (value) => {
    console.log('Interest rate computed:', value);
  });

  watch(path.employmentStatus, (value) => {
    console.log('Employment status changed:', value);
  });
};
```

## Displaying Cross-Step Data

Show the payment-to-income ratio in a summary widget:

```tsx title="src/components/LoanSummary.tsx"
import { useFormControl } from 'reformer';

function LoanSummary({ control }: Props) {
  const { value: monthlyPayment } = useFormControl(control.monthlyPayment);
  const { value: paymentToIncomeRatio } = useFormControl(control.paymentToIncomeRatio);

  const isAcceptable = paymentToIncomeRatio <= 50;

  return (
    <div className="p-4 bg-gray-50 rounded">
      <h3 className="font-semibold mb-2">Loan Summary</h3>

      <div className="flex justify-between mb-2">
        <span>Monthly Payment:</span>
        <span className="font-bold">{monthlyPayment.toLocaleString()} ₽</span>
      </div>

      <div className="flex justify-between">
        <span>Payment to Income:</span>
        <span className={`font-bold ${isAcceptable ? 'text-green-600' : 'text-red-600'}`}>
          {paymentToIncomeRatio}%
        </span>
      </div>

      {!isAcceptable && (
        <p className="text-sm text-red-600 mt-2">
          Payment exceeds 50% of household income. Consider:
          - Reducing loan amount
          - Extending loan term
          - Adding co-borrowers
        </p>
      )}
    </div>
  );
}
```

## Result

Cross-step behaviors now provide:
- ✅ Payment-to-income ratio calculation
- ✅ Smart revalidation on income changes
- ✅ Age-based access control (prevents minors from applying)
- ✅ Analytics tracking for insights

## Key Takeaways

- **Separate cross-step behaviors** for clarity
- **`revalidateWhen`** ensures validation stays current
- **Backward dependencies** are possible (Step 2 → Step 1)
- **Analytics** via `watch` for monitoring
- **Display cross-step data** in summaries/widgets

## Next Step

Now let's combine all behaviors and register them with the form in the final section.

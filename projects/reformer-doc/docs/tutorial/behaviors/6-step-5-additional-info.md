---
sidebar_position: 6
---

# Step 5: Additional Information Behaviors

Managing conditional arrays and co-borrower income calculations.

## Overview

Step 5 handles optional arrays that appear based on checkboxes:

1. **Conditional Visibility** - Show arrays only when corresponding checkboxes are checked
2. **Computed: Co-Borrowers Income** - Sum income from all co-borrowers

## Implementation

```typescript title="reformer-tutorial/src/forms/credit-application/schemas/behaviors/additional-info.ts"
import { enableWhen, computeFrom, disableWhen } from '@reformer/core/behaviors';
import type { BehaviorSchemaFn, FieldPath } from '@reformer/core';
import type { CreditApplicationForm, CoBorrower } from '@/types';

export const additionalBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Show Properties Array When hasProperty === true
  // ==========================================
  enableWhen(path.properties, path.hasProperty, (value) => value === true);

  // ==========================================
  // Show Existing Loans Array When hasExistingLoans === true
  // ==========================================
  enableWhen(path.existingLoans, path.hasExistingLoans, (value) => value === true);

  // ==========================================
  // Show Co-Borrowers Array When hasCoBorrower === true
  // ==========================================
  enableWhen(path.coBorrowers, path.hasCoBorrower, (value) => value === true);

  // ==========================================
  // Computed: Total Co-Borrowers Income
  // ==========================================
  computeFrom([path.coBorrowers], path.coBorrowersIncome, (values) => {
    const coBorrowers = (values.coBorrowers as CoBorrower[]) || [];
    return coBorrowers.reduce((sum, cb) => sum + (cb.monthlyIncome || 0), 0);
  });

  // Disable coBorrowersIncome (read-only)
  disableWhen(path.coBorrowersIncome, path.coBorrowersIncome, () => true);
};
```

## Key Points

**Conditional Arrays:**

- Arrays are hidden until user opts in via checkbox
- Cleaner UX - user doesn't see irrelevant sections
- Validation only runs on visible arrays

**Array Computation:**

- Watch entire array: `computeFrom([path.coBorrowers], ...)`
- When array changes (items added/removed/modified), sum recalculates
- Use `reduce` to sum values from array items

**Use Case:**

- User checks "I have co-borrowers"
- Array section appears with "Add Co-Borrower" button
- User adds co-borrowers
- Total co-borrowers income updates automatically
- This value will be used in cross-step behaviors for payment-to-income ratio

## Result

Step 5 now has:

- ✅ Conditional array visibility (properties, loans, co-borrowers)
- ✅ Co-borrowers income calculation
- ✅ Clean progressive disclosure UX

## Next Step

Now let's implement cross-step behaviors that coordinate data between multiple steps.

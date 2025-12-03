---
sidebar_position: 5
---

# Step 4: Employment Behaviors

Managing employment-specific fields and income calculations.

## Overview

Step 4 handles different employment statuses with their specific fields:

1. **Conditional Visibility** - Show company fields for employed, business fields for self-employed
2. **Watch & Reset** - Clear fields when employment status changes
3. **Computed: Total Income** - Sum main income and additional income
4. **Disable Computed** - Make total income read-only

## Implementation

```typescript title="reformer-tutorial/src/forms/credit-application/schemas/behaviors/employment.ts"
import { enableWhen, watch, computeFrom, disableWhen } from '@reformer/core/behaviors';
import type { BehaviorSchemaFn, FieldPath } from '@reformer/core';
import type { CreditApplicationForm } from '@/types';

export const employmentBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Show Company Fields for Employed
  // ==========================================
  enableWhen(path.companyName, path.employmentStatus, (s) => s === 'employed');
  enableWhen(path.companyInn, path.employmentStatus, (s) => s === 'employed');
  enableWhen(path.companyPhone, path.employmentStatus, (s) => s === 'employed');
  enableWhen(path.companyAddress, path.employmentStatus, (s) => s === 'employed');
  enableWhen(path.position, path.employmentStatus, (s) => s === 'employed');
  enableWhen(path.workExperienceTotal, path.employmentStatus, (s) => s === 'employed');
  enableWhen(path.workExperienceCurrent, path.employmentStatus, (s) => s === 'employed');

  // ==========================================
  // Show Business Fields for Self-Employed
  // ==========================================
  enableWhen(path.businessType, path.employmentStatus, (s) => s === 'selfEmployed');
  enableWhen(path.businessInn, path.employmentStatus, (s) => s === 'selfEmployed');
  enableWhen(path.businessActivity, path.employmentStatus, (s) => s === 'selfEmployed');

  // ==========================================
  // Watch: Clear Fields When Status Changes
  // ==========================================
  watch(path.employmentStatus, (value, { form }) => {
    // Clear company fields if not employed
    if (value !== 'employed') {
      form.field(path.companyName).setValue('', { emitEvent: false });
      form.field(path.companyInn).setValue('', { emitEvent: false });
      form.field(path.companyPhone).setValue('', { emitEvent: false });
      form.field(path.companyAddress).setValue('', { emitEvent: false });
      form.field(path.position).setValue('', { emitEvent: false });
      form.field(path.workExperienceTotal).setValue(null, { emitEvent: false });
      form.field(path.workExperienceCurrent).setValue(null, { emitEvent: false });
    }

    // Clear business fields if not self-employed
    if (value !== 'selfEmployed') {
      form.field(path.businessType).setValue('', { emitEvent: false });
      form.field(path.businessInn).setValue('', { emitEvent: false });
      form.field(path.businessActivity).setValue('', { emitEvent: false });
    }
  });

  // ==========================================
  // Computed: Total Income
  // ==========================================
  computeFrom([path.monthlyIncome, path.additionalIncome], path.totalIncome, (values) => {
    const main = (values.monthlyIncome as number) || 0;
    const additional = (values.additionalIncome as number) || 0;
    return main + additional;
  });

  // Disable totalIncome (read-only)
  disableWhen(path.totalIncome, path.totalIncome, () => true);
};
```

## Key Points

**Multiple Conditional Fields:**

- Group related fields by condition (employed vs self-employed)
- Use `enableWhen` for each field individually
- Fields hide/show together when status changes

**Field Reset Pattern:**

- Clear values when switching employment types
- Prevents stale data (e.g., company name for self-employed)
- Use `{ emitEvent: false }` to avoid triggering validations

**Total Income:**

- Simple sum of two income sources
- Handles missing values (`|| 0`)
- Updates automatically when either income changes

## Result

Step 4 now has:

- ✅ Employment-specific fields (company/business)
- ✅ Automatic field reset on status change
- ✅ Total income calculation
- ✅ Clean conditional UI

## Next Step

Let's add behaviors for Step 5: Additional Information, handling arrays and co-borrowers.

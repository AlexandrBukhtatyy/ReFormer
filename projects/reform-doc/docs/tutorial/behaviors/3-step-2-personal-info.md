---
sidebar_position: 3
---

# Step 2: Personal Information Behaviors

Auto-generating full name and calculating age from personal data.

## Overview

For Step 2 (Personal Information), we need simpler behaviors that derive values from the `personalData` group:

1. **Computed: Full Name** - Generate from first, last, and middle names (Russian FIO format)
2. **Computed: Age** - Calculate from birth date
3. **Disable: Computed Fields** - Make them read-only

These computed fields will be displayed in other parts of the form and used in validation/submission logic.

## Creating the Behavior File

Create the behavior file for Step 2:

```bash
touch src/behaviors/steps/step-2-personal-info.behaviors.ts
```

## Implementing the Behaviors

### 1. Full Name Computation

In Russian forms, the full name (ФИО) is typically formatted as: **Фамилия Имя Отчество** (Last First Middle).

```typescript title="src/behaviors/steps/step-2-personal-info.behaviors.ts"
import { computeFrom, disableWhen } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm, PersonalData } from '@/types';

export const step2PersonalBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Computed: Full Name (ФИО)
  // ==========================================
  computeFrom(
    [path.personalData],
    path.fullName,
    (values) => {
      const pd = values.personalData as PersonalData;
      if (!pd) return '';

      // Russian format: Фамилия Имя Отчество
      // Filter out empty values
      const parts = [pd.lastName, pd.firstName, pd.middleName].filter(Boolean);

      return parts.join(' ');
    }
  );

  // ... more behaviors
};
```

**How it works:**
- We watch the entire `personalData` group (not individual fields)
- When any field in `personalData` changes, the full name updates
- Empty values are filtered out (e.g., if middleName is optional)
- The result is a clean, properly formatted full name

:::tip Watching Groups
You can watch entire groups instead of individual fields:
```typescript
// ✅ Watch the entire group
computeFrom([path.personalData], ...)

// ❌ Watch individual fields (more verbose)
computeFrom([path.personalData.firstName, path.personalData.lastName, ...], ...)
```
Both work, but watching groups is simpler when you need all fields.
:::

### 2. Age Calculation

Calculate the applicant's age from their birth date:

```typescript title="src/behaviors/steps/step-2-personal-info.behaviors.ts"
export const step2PersonalBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous behaviors

  // ==========================================
  // Computed: Age
  // ==========================================
  computeFrom(
    [path.personalData],
    path.age,
    (values) => {
      const birthDate = (values.personalData as PersonalData)?.birthDate;
      if (!birthDate) return null;

      const today = new Date();
      const birth = new Date(birthDate);

      // Calculate year difference
      let age = today.getFullYear() - birth.getFullYear();

      // Adjust if birthday hasn't occurred this year
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }

      return age;
    }
  );

  // ... more behaviors
};
```

**Edge cases handled:**
- Returns `null` if birth date is not set
- Correctly handles birthdays that haven't occurred yet this year
- Accounts for month and day differences

:::info Age Calculation Logic
The age calculation checks:
1. Year difference (e.g., 2025 - 1990 = 35)
2. If the birthday hasn't occurred yet this year, subtract 1
   - Month check: Current month < birth month → birthday not yet
   - Day check: Same month, but current day < birth day → birthday not yet
:::

### 3. Making Computed Fields Read-Only

Since `fullName` and `age` are computed automatically, they should be read-only (disabled):

```typescript title="src/behaviors/steps/step-2-personal-info.behaviors.ts"
export const step2PersonalBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous behaviors

  // ==========================================
  // Disable Computed Fields (Always Read-Only)
  // ==========================================
  disableWhen(path.fullName, path.fullName, () => true);
  disableWhen(path.age, path.age, () => true);
};
```

**Why `disableWhen(path.fullName, path.fullName, () => true)`?**
- First argument: the field to disable
- Second argument: the field to watch (we watch itself)
- Third argument: condition (always `true` means always disabled)

This pattern ensures the field is always disabled, regardless of form state.

:::tip Alternative: Schema-level Disable
You can also disable fields in the schema:
```typescript
fullName: {
  value: '',
  component: Input,
  componentProps: {
    label: 'Full Name',
    disabled: true, // ← Always disabled
  },
},
```

However, using `disableWhen` keeps all behaviors centralized and makes them easier to find and modify.
:::

## Complete Code

Here's the complete behavior file for Step 2:

```typescript title="src/behaviors/steps/step-2-personal-info.behaviors.ts"
import { computeFrom, disableWhen } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm, PersonalData } from '@/types';

export const step2PersonalBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Computed: Full Name (ФИО)
  // ==========================================
  computeFrom(
    [path.personalData],
    path.fullName,
    (values) => {
      const pd = values.personalData as PersonalData;
      if (!pd) return '';

      const parts = [pd.lastName, pd.firstName, pd.middleName].filter(Boolean);
      return parts.join(' ');
    }
  );

  // ==========================================
  // Computed: Age
  // ==========================================
  computeFrom(
    [path.personalData],
    path.age,
    (values) => {
      const birthDate = (values.personalData as PersonalData)?.birthDate;
      if (!birthDate) return null;

      const today = new Date();
      const birth = new Date(birthDate);

      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }

      return age;
    }
  );

  // ==========================================
  // Disable Computed Fields
  // ==========================================
  disableWhen(path.fullName, path.fullName, () => true);
  disableWhen(path.age, path.age, () => true);
};
```

## Testing the Behaviors

Add Step 2 behaviors to your form temporarily:

```typescript title="src/schemas/create-form.ts"
import { step1LoanBehaviors } from '../behaviors/steps/step-1-loan-info.behaviors';
import { step2PersonalBehaviors } from '../behaviors/steps/step-2-personal-info.behaviors';

export function createCreditApplicationForm() {
  return createForm({
    schema: creditApplicationSchema,
    behaviors: (path) => {
      step1LoanBehaviors(path);
      step2PersonalBehaviors(path); // ← Add Step 2
    },
  });
}
```

### Test Scenarios

1. **Full Name Generation:**
   - Enter first name: "Иван"
   - Enter last name: "Петров"
   - Enter middle name: "Сергеевич"
   - Check that `fullName` field shows: "Петров Иван Сергеевич"
   - Leave middle name empty → Full name should be "Петров Иван"

2. **Age Calculation:**
   - Enter birth date: "1990-05-15"
   - Check that `age` field calculates correctly
   - Try different dates (before/after birthday this year)
   - Check that age updates when birth date changes

3. **Read-Only Fields:**
   - Try to click on `fullName` field → Should be disabled
   - Try to click on `age` field → Should be disabled
   - Fields should have a disabled/read-only visual state

## Displaying Computed Fields

These computed fields can be displayed anywhere in your form. For example, you might show them in a summary:

```tsx title="src/components/ApplicantSummary.tsx"
import { useFormControl } from 'reformer';

function ApplicantSummary({ control }: Props) {
  const { value: fullName } = useFormControl(control.fullName);
  const { value: age } = useFormControl(control.age);

  return (
    <div className="p-4 bg-gray-50 rounded">
      <h3 className="font-semibold mb-2">Applicant Information</h3>
      <div className="space-y-1 text-sm">
        <div>
          <span className="text-gray-600">Full Name:</span>
          <span className="ml-2 font-medium">{fullName || '—'}</span>
        </div>
        <div>
          <span className="text-gray-600">Age:</span>
          <span className="ml-2 font-medium">{age ? `${age} years` : '—'}</span>
        </div>
      </div>
    </div>
  );
}
```

Or as read-only fields in the form:

```tsx title="src/steps/PersonalInfoStep.tsx"
<FormField control={control.personalData.firstName} />
<FormField control={control.personalData.lastName} />
<FormField control={control.personalData.middleName} />
<FormField control={control.personalData.birthDate} />

{/* Computed fields shown as read-only */}
<div className="grid grid-cols-2 gap-4 mt-4">
  <FormField control={control.fullName} />
  <FormField control={control.age} />
</div>
```

## Result

Now Step 2 of the form has:
- ✅ Auto-generated full name in Russian FIO format
- ✅ Auto-calculated age with correct birthday handling
- ✅ Read-only display of computed fields

These computed values will be useful in:
- **Display** - Showing applicant info in summaries
- **Validation** - Age-based validation rules (e.g., must be 18+)
- **Cross-step behaviors** - Controlling access based on age
- **Submission** - Including full name in API payload

## Key Takeaways

- Watch entire groups when you need all fields: `computeFrom([path.personalData], ...)`
- Handle edge cases in date calculations (birthdays not yet occurred)
- Use `disableWhen(..., ..., () => true)` for always-disabled fields
- Computed fields can be displayed anywhere in the form
- Centralize behaviors for easier maintenance

## Next Step

Now let's add behaviors for Step 3: Contact Information, where we'll implement address copying and conditional visibility for the residence address.

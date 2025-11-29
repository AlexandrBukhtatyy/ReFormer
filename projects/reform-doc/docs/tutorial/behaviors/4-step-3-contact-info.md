---
sidebar_position: 4
---

# Step 3: Contact Information Behaviors

Managing address synchronization and conditional visibility.

## Overview

For Step 3 (Contact Information), we'll implement:

1. **Conditional Visibility** - Hide residence address when same as registration
2. **Conditional Access** - Disable residence address when same as registration
3. **Data Synchronization** - Copy registration address to residence address

This demonstrates a common pattern: giving users the option to use the same value for multiple fields.

## Creating the Behavior File

```bash
touch reform-tutorial/src/forms/credit-application/schemas/behaviors/contact-info.ts
```

## Implementing the Behaviors

```typescript title="reform-tutorial/src/forms/credit-application/schemas/behaviors/contact-info.ts"
import { disableWhen, disableWhen, copyTo } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

export const contactBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // 1. Hide Residence Address When Same as Registration
  // ==========================================
  disableWhen(path.residenceAddress, path.sameAsRegistration, (value) => value === true);

  // ==========================================
  // 2. Disable Residence Address When Same as Registration
  // ==========================================
  disableWhen(path.residenceAddress, path.sameAsRegistration, (value) => value === true);

  // ==========================================
  // 3. Copy Registration Address to Residence Address
  // ==========================================
  copyTo(
    path.registrationAddress, // Source
    path.residenceAddress, // Target
    path.sameAsRegistration, // Condition field
    (shouldCopy) => shouldCopy === true // When to copy
  );
};
```

### Understanding Each Behavior

**1. disableWhen:**

- Hides the `residenceAddress` fields from the UI
- Fields are not validated when hidden
- Fields are not included in form submission

**2. disableWhen:**

- Makes `residenceAddress` fields read-only
- Prevents user from editing
- Works together with `disableWhen` (though hidden fields are already inaccessible)

**3. copyTo:**

- Watches `registrationAddress` for changes
- When `sameAsRegistration` is `true`, copies the value to `residenceAddress`
- Runs whenever `registrationAddress` changes while condition is met

:::tip disableWhen vs disableWhen
You might wonder why we use both `disableWhen` and `disableWhen` for the same condition:

- `disableWhen` - Removes fields from UI completely (cleaner UX)
- `disableWhen` - Prevents editing if fields are shown

While redundant here, in some cases you might want disabled-but-visible fields. Using both is defensive programming.
:::

## How copyTo Works

The `copyTo` behavior creates a smart synchronization:

```typescript
copyTo(
  sourceField, // What to copy FROM
  targetField, // What to copy TO
  conditionField, // Field that determines if copying should happen
  conditionFn // Function that evaluates the condition
);
```

**Execution flow:**

1. User fills in registration address (city, street, house, etc.)
2. User checks "Same as registration" checkbox
3. `copyTo` immediately copies `registrationAddress` → `residenceAddress`
4. If user modifies `registrationAddress`, `residenceAddress` updates automatically
5. If user unchecks "Same as registration", copying stops (but value remains)

:::caution copyTo vs syncWith

- **`copyTo`** - One-way copying (source → target)
- **`syncWith`** - Two-way synchronization (source ↔ target)

For addresses, `copyTo` is correct because we don't want changes to `residenceAddress` to affect `registrationAddress`.
:::

## Complete Code

```typescript title="reform-tutorial/src/forms/credit-application/schemas/behaviors/contact-info.ts"
import { disableWhen, disableWhen, copyTo } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

export const contactBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  disableWhen(path.residenceAddress, path.sameAsRegistration, (value) => value === true);

  disableWhen(path.residenceAddress, path.sameAsRegistration, (value) => value === true);

  copyTo(
    path.registrationAddress,
    path.residenceAddress,
    path.sameAsRegistration,
    (shouldCopy) => shouldCopy === true
  );
};
```

## Testing

### Test Scenarios

1. **Address Copying:**
   - Fill in registration address (all fields)
   - Check "Same as registration" checkbox
   - Verify residence address is filled automatically
   - Modify registration address
   - Verify residence address updates automatically

2. **Conditional Visibility:**
   - With "Same as registration" checked → Residence address should be hidden
   - Uncheck the checkbox → Residence address should appear
   - Check again → Address should hide again (with copied values)

3. **Manual Override:**
   - Check "Same as registration" (address copied)
   - Uncheck it
   - Modify residence address manually
   - Check "Same as registration" again
   - Verify manual changes are overwritten by registration address

## UI Integration

In your contact info step component:

```tsx title="src/steps/ContactInfoStep.tsx"
function ContactInfoStep({ control }: Props) {
  return (
    <div className="space-y-6">
      {/* Registration Address */}
      <div>
        <h3 className="font-semibold mb-4">Registration Address</h3>
        <AddressForm control={control.registrationAddress} testIdPrefix="registration" />
      </div>

      {/* Same as Registration Checkbox */}
      <FormField control={control.sameAsRegistration} />

      {/* Residence Address - will hide/disable automatically */}
      <div>
        <h3 className="font-semibold mb-4">Residence Address</h3>
        <AddressForm control={control.residenceAddress} testIdPrefix="residence" />
      </div>
    </div>
  );
}
```

The behaviors handle the rest automatically!

## Result

Step 3 now has:

- ✅ Smart address copying (registration → residence)
- ✅ Conditional visibility (hide when same)
- ✅ Conditional access control (disable when same)
- ✅ Clean UX (no manual duplication needed)

## Key Takeaways

- `disableWhen` for conditional visibility
- `disableWhen` for conditional access control
- `copyTo` for one-way data synchronization
- Combine multiple behaviors for robust UX
- Behaviors eliminate manual checkbox handling logic

## Next Step

Let's add behaviors for Step 4: Employment, where we'll handle different employment types with conditional fields and income calculations.

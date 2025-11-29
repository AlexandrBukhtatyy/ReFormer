---
sidebar_position: 3
---

# Conditional Logic

Show, hide, enable, or disable fields based on conditions.

## enableWhen

Enable field only when condition is true.

```typescript
import { enableWhen } from 'reformer/behaviors';

behaviors: (path, ctx) => [
  enableWhen(path.submitButton, () => form.controls.agreeToTerms.value === true),
];
```

### Example: Step Form

```typescript
const form = new GroupNode({
  form: {
    step1Complete: { value: false },
    step2Data: { value: '' },
  },
  behaviors: (path, ctx) => [
    enableWhen(path.step2Data, () => form.controls.step1Complete.value === true),
  ],
});
```

## resetWhen

Reset field to initial value when condition becomes true.

```typescript
import { resetWhen } from 'reformer/behaviors';

behaviors: (path, ctx) => [
  // Reset details when type changes
  resetWhen(path.typeDetails, () => form.controls.type.value, { watchValue: true }),
];
```

### Example: Dependent Dropdowns

```typescript
const form = new GroupNode({
  form: {
    country: { value: '' },
    city: { value: '' },
  },
  behaviors: (path, ctx) => [
    // Reset city when country changes
    resetWhen(path.city, () => form.controls.country.value, { watchValue: true }),
  ],
});

form.controls.country.setValue('US');
form.controls.city.setValue('NYC');
form.controls.country.setValue('UK'); // city resets to ''
```

## Combining Conditions

Use multiple behaviors together:

```typescript
behaviors: (path, ctx) => [
  // Show business fields only for business accounts
  enableWhen(path.companyName, () => form.controls.accountType.value === 'business'),
  enableWhen(path.taxId, () => form.controls.accountType.value === 'business'),

  // Reset business fields when switching to personal
  resetWhen(path.companyName, () => form.controls.accountType.value === 'personal'),
  resetWhen(path.taxId, () => form.controls.accountType.value === 'personal'),
];
```

## Complex Conditions

```typescript
behaviors: (path, ctx) => [
  enableWhen(path.spouseInfo, () => {
    const status = form.controls.maritalStatus.value;
    const includeSpouse = form.controls.includeSpouse.value;
    return status === 'married' && includeSpouse === true;
  }),
];
```

## Next Steps

- [Field Sync](/docs/behaviors/sync) — Copy and synchronize fields
- [Watch Behaviors](/docs/behaviors/watch) — React to changes

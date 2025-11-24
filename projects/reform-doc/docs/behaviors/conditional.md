---
sidebar_position: 3
---

# Conditional Logic

Show, hide, enable, or disable fields based on conditions.

## showWhen

Show field only when condition is true.

```typescript
import { showWhen } from 'reformer/behaviors';

behaviors: (path, ctx) => [
  showWhen(
    path.otherIncome,
    () => form.controls.hasOtherIncome.value === true
  ),
]
```

### Example: Contact Preferences

```typescript
const form = new GroupNode({
  form: {
    contactMethod: { value: 'email' },
    email: { value: '' },
    phone: { value: '' },
  },
  behaviors: (path, ctx) => [
    showWhen(path.email, () =>
      form.controls.contactMethod.value === 'email'
    ),
    showWhen(path.phone, () =>
      form.controls.contactMethod.value === 'phone'
    ),
  ],
});
```

### React Usage

```tsx
function ContactForm() {
  const email = useFormControl(form.controls.email);
  const phone = useFormControl(form.controls.phone);

  return (
    <form>
      <select {...bindSelect(form.controls.contactMethod)}>
        <option value="email">Email</option>
        <option value="phone">Phone</option>
      </select>

      {email.visible && <input {...bindInput(email)} />}
      {phone.visible && <input {...bindInput(phone)} />}
    </form>
  );
}
```

## enableWhen

Enable field only when condition is true.

```typescript
import { enableWhen } from 'reformer/behaviors';

behaviors: (path, ctx) => [
  enableWhen(
    path.submitButton,
    () => form.controls.agreeToTerms.value === true
  ),
]
```

### Example: Step Form

```typescript
const form = new GroupNode({
  form: {
    step1Complete: { value: false },
    step2Data: { value: '' },
  },
  behaviors: (path, ctx) => [
    enableWhen(path.step2Data, () =>
      form.controls.step1Complete.value === true
    ),
  ],
});
```

## resetWhen

Reset field to initial value when condition becomes true.

```typescript
import { resetWhen } from 'reformer/behaviors';

behaviors: (path, ctx) => [
  // Reset details when type changes
  resetWhen(
    path.typeDetails,
    () => form.controls.type.value,
    { watchValue: true }
  ),
]
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
    resetWhen(
      path.city,
      () => form.controls.country.value,
      { watchValue: true }
    ),
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
  showWhen(path.companyName, () =>
    form.controls.accountType.value === 'business'
  ),
  showWhen(path.taxId, () =>
    form.controls.accountType.value === 'business'
  ),

  // Reset business fields when switching to personal
  resetWhen(path.companyName, () =>
    form.controls.accountType.value === 'personal'
  ),
  resetWhen(path.taxId, () =>
    form.controls.accountType.value === 'personal'
  ),
]
```

## Complex Conditions

```typescript
behaviors: (path, ctx) => [
  showWhen(path.spouseInfo, () => {
    const status = form.controls.maritalStatus.value;
    const includeSpouse = form.controls.includeSpouse.value;
    return status === 'married' && includeSpouse === true;
  }),
]
```

## Next Steps

- [Field Sync](/docs/behaviors/sync) — Copy and synchronize fields
- [Watch Behaviors](/docs/behaviors/watch) — React to changes

## 16. READING FIELD VALUES (CRITICALLY IMPORTANT)

### Why .value.value?

ReFormer uses `@preact/signals-core` for reactivity:
- `field.value` -> `Signal<T>` (reactive container)
- `field.value.value` -> `T` (actual value)
- `field.getValue()` -> `T` (shorthand method, non-reactive)

```typescript
// Reading values in different contexts:

// In React components - use hooks
const { value } = useFormControl(control.email);     // Object with value
const email = useFormControlValue(control.email);    // Value directly

// In BehaviorContext (watchField, etc.)
watchField(path.firstName, (firstName, ctx) => {
  // ctx.form is typed as the PARENT GROUP of the watched field!
  // For path.nested.field: ctx.form = NestedType, NOT RootForm!

  const lastName = ctx.form.lastName.value.value;  // Read sibling field

  // Use setFieldValue with full path for root-level fields
  ctx.setFieldValue('fullName', `${firstName} ${lastName}`);
});

// Direct access on form controls
form.email.value.value;           // Read current value
form.address.city.value.value;    // Read nested value
```

### Reading Nested Values in watchField

```typescript
// IMPORTANT: ctx.form type depends on the watched path!

// Watching root-level field
watchField(path.loanAmount, (amount, ctx) => {
  // ctx.form is MyForm - can access all fields
  const rate = ctx.form.interestRate.value.value;
  ctx.setFieldValue('monthlyPayment', amount * rate / 12);
});

// Watching nested field
watchField(path.personalData.lastName, (lastName, ctx) => {
  // ctx.form is PersonalData, NOT MyForm!
  const firstName = ctx.form.firstName.value.value;   // Works
  const middleName = ctx.form.middleName.value.value; // Works

  // For root-level field, use setFieldValue with full path
  ctx.setFieldValue('fullName', `${lastName} ${firstName}`);
});
```

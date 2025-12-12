## 3. COMMON PATTERNS

### Conditional Fields with Auto-Reset

```typescript
enableWhen(path.mortgageFields, (form) => form.loanType === 'mortgage', {
  resetOnDisable: true,
});
```

### Computed Field from Nested to Root Level

```typescript
// DO NOT use computeFrom for cross-level computations
// Use watchField instead:
watchField(path.nested.field, (value, ctx) => {
  ctx.setFieldValue('rootField', computedValue);
}, { immediate: false });
```

### Type-Safe useFormControl

```typescript
const { value } = useFormControl(form.field as FieldNode<ExpectedType>);
```

### Validation Priority (IMPORTANT)

**Always prefer built-in validators over custom ones:**

```typescript
// 1. BEST: Use built-in validators when available
required(path.email);
email(path.email);
min(path.age, 18);
minLength(path.password, 8);
pattern(path.phone, /^\+7\d{10}$/);

// 2. GOOD: Use validate() only when no built-in validator exists
validate(path.customField, (value, ctx) => {
  // Custom logic that can't be expressed with built-in validators
  if (customCondition(value)) {
    return { code: 'custom', message: 'Custom error' };
  }
  return null;
});

// 3. WRONG: Don't recreate built-in validators
validate(path.email, (value) => {
  if (!value) return { code: 'required', message: 'Required' };  // Use required() instead!
  if (!value.includes('@')) return { code: 'email', message: 'Invalid' };  // Use email() instead!
  return null;
});
```

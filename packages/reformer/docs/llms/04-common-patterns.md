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

**Operators register validators; built-in factories return validators. Pass factories to `validate()`.**

Operators: `validate`, `validateAsync`, `validateGroup`, `applyWhen`, `apply`, `validateItems`.
Factories (return `Validator<TForm, TField>`): `required`, `email`, `min`, `max`, `minLength`, `maxLength`,
`pattern`, `url`, `phone`, `number`, `date`, `notEmpty`.

```typescript
// 1. BEST: Pass built-in factories to validate()
validate(path.email, required());
validate(path.email, email());
validate(path.age, min(18));
validate(path.password, minLength(8));
validate(path.phone, pattern(/^\+7\d{10}$/));

// 2. GOOD: Custom validator when no factory fits. Signature: (value, control, root).
validate(path.customField, (value, control, root) => {
  if (customCondition(value)) {
    return { code: 'custom', message: 'Custom error' };
  }
  return null;
});

// 3. WRONG: Don't recreate built-in validators inline
validate(path.email, (value) => {
  if (!value) return { code: 'required', message: 'Required' };  // Use required() instead!
  if (!value.includes('@')) return { code: 'email', message: 'Invalid' };  // Use email() instead!
  return null;
});
```

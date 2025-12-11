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

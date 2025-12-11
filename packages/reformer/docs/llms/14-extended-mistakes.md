## 13. EXTENDED COMMON MISTAKES

### Behavior Composition (Cycle Error)

```typescript
// WRONG - apply() in behavior causes "Cycle detected"
const mainBehavior: BehaviorSchemaFn<Form> = (path) => {
  apply(addressBehavior, path.address);  // WILL FAIL!
};

// CORRECT - inline or use setup function
const setupAddressBehavior = (path: FieldPath<Address>) => {
  watchField(path.region, async (region, ctx) => {
    // ...
  }, { immediate: false });
};

const mainBehavior: BehaviorSchemaFn<Form> = (path) => {
  setupAddressBehavior(path.address);  // Works!
};
```

### Infinite Loop in watchField

```typescript
// WRONG - causes infinite loop
watchField(path.field, (value, ctx) => {
  ctx.form.field.setValue(value.toUpperCase());  // Loop!
});

// CORRECT - write to different field OR add guard
watchField(path.input, (value, ctx) => {
  const upper = value?.toUpperCase() || '';
  if (ctx.form.display.value.value !== upper) {
    ctx.form.display.setValue(upper);
  }
}, { immediate: false });
```

### validateTree Typing

```typescript
// WRONG - implicit any
validateTree((ctx) => { ... });

// CORRECT - explicit typing
validateTree((ctx: { form: MyForm }) => {
  if (ctx.form.field1 > ctx.form.field2) {
    return { code: 'error', message: 'Invalid' };
  }
  return null;
});
```

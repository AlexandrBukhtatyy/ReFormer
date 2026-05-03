## 13. EXTENDED COMMON MISTAKES

### Behavior Composition (Cycle Error)

```typescript
// WRONG - apply() in behavior causes "Cycle detected"
const mainBehavior: BehaviorSchemaFn<Form> = (path) => {
  apply(addressBehavior, path.address); // WILL FAIL!
};

// CORRECT - inline or use setup function
const setupAddressBehavior = (path: FieldPath<Address>) => {
  watchField(
    path.region,
    async (region, ctx) => {
      // ...
    },
    { immediate: false }
  );
};

const mainBehavior: BehaviorSchemaFn<Form> = (path) => {
  setupAddressBehavior(path.address); // Works!
};
```

### Infinite Loop in watchField

```typescript
// WRONG - causes infinite loop
watchField(path.field, (value, ctx) => {
  ctx.form.field.setValue(value.toUpperCase()); // Loop!
});

// CORRECT - write to different field OR add guard
watchField(
  path.input,
  (value, ctx) => {
    const upper = value?.toUpperCase() || '';
    if (ctx.form.display.value.value !== upper) {
      ctx.form.display.setValue(upper);
    }
  },
  { immediate: false }
);
```

### Multiple Watchers on Same Field (Cycle Error)

```typescript
// WRONG - multiple watchers on insuranceType + missing { immediate: false }
watchField(path.insuranceType, (_, ctx) => {
  ctx.form.vehicle.vin.disable();
  ctx.form.vehicle.vin.setValue('');
}); // NO OPTIONS - BAD!
watchField(path.insuranceType, (_, ctx) => {
  ctx.form.property.type.disable(); // CYCLE!
}); // NO OPTIONS - BAD!

// CORRECT - consolidate into ONE watcher with guards AND { immediate: false }
watchField(
  path.insuranceType,
  (_, ctx) => {
    const type = ctx.form.insuranceType.value.value;
    const isVehicle = type === 'casco';

    // Guard: only disable if not already disabled
    if (!isVehicle && !ctx.form.vehicle.vin.disabled.value) {
      ctx.form.vehicle.vin.disable();
    }
    // Guard: only setValue if value differs
    if (!isVehicle && ctx.form.vehicle.vin.getValue() !== '') {
      ctx.form.vehicle.vin.setValue('');
    }
    // Arrays: compare by length, not reference
    if (!isVehicle) {
      const drivers = ctx.form.drivers.getValue();
      if (Array.isArray(drivers) && drivers.length > 0) {
        ctx.form.drivers.setValue([]);
      }
    }
  },
  { immediate: false }
); // REQUIRED!

// BEST - use enableWhen instead of watchField
enableWhen(path.vehicle.vin, (form) => form.insuranceType === 'casco', { resetOnDisable: true });
```

See `22-cycle-detection.md` for complete pattern.

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

## Cycle Detection Prevention Checklist

**ALWAYS follow these rules to prevent "Cycle detected" error:**

1. ✅ **ONE watchField per trigger field** - consolidate all logic into single handler
2. ✅ **ALWAYS use `{ immediate: false }`** - required option for watchField
3. ✅ **Guard all disable/enable calls** - check `field.disabled.value` before calling
4. ✅ **Guard all setValue calls** - only call if value actually differs
5. ✅ **Arrays: compare by length** - `[] !== []` is always true, use `.length`
6. ✅ **Prefer enableWhen over watchField** - for simple enable/disable logic

---

## Cycle Detected Error

### Problem

Error `Cycle detected` occurs when reactive system detects circular dependency during field updates.

### Root Cause

Multiple `watchField` handlers on the same field (e.g., `path.insuranceType`) each calling `disable()` and `setValue()` creates reactive cycles:

```typescript
// WRONG - Multiple watchers on same field + missing { immediate: false }
watchField(path.insuranceType, (_, ctx) => {
  // Handler 1: vehicle fields
  if (!isVehicle) {
    ctx.form.vehicle.vin.disable();
    ctx.form.vehicle.vin.setValue('');
  }
}); // NO OPTIONS - BAD!

watchField(path.insuranceType, (_, ctx) => {
  // Handler 2: property fields - CAUSES CYCLE!
  if (!isProperty) {
    ctx.form.property.type.disable();
    ctx.form.property.type.setValue('');
  }
}); // NO OPTIONS - BAD!

// More watchers on same field = more cycles
```

### Solution

1. **Consolidate all watchers for same field into ONE handler**
2. **Check state before calling disable/enable/setValue**
3. **ALWAYS add `{ immediate: false }` option**

```typescript
// CORRECT - Single consolidated watcher with guards AND { immediate: false }
watchField(
  path.insuranceType,
  (_value, ctx) => {
    const insuranceType = ctx.form.insuranceType.value.value;
    const isVehicle = insuranceType === 'casco' || insuranceType === 'osago';
    const isProperty = insuranceType === 'property';

    // Helper: check if array value needs update (compare by length, not reference)
    const needsValueUpdate = <T>(current: T, defaultVal: T): boolean => {
      if (Array.isArray(current) && Array.isArray(defaultVal)) {
        return current.length !== defaultVal.length;
      }
      return current !== defaultVal;
    };

    // Helper: disable only if not already disabled, setValue only if different
    const disableAndReset = <T>(
      field:
        | {
            disable: () => void;
            setValue: (v: T) => void;
            getValue: () => T;
            disabled: { value: boolean };
          }
        | undefined,
      defaultValue: T
    ) => {
      if (field) {
        if (!field.disabled.value) {
          field.disable();
        }
        if (needsValueUpdate(field.getValue(), defaultValue)) {
          field.setValue(defaultValue);
        }
      }
    };

    const enableField = (
      field: { enable: () => void; disabled: { value: boolean } } | undefined
    ) => {
      if (field && field.disabled.value) {
        field.enable();
      }
    };

    // --- All vehicle fields in one place ---
    if (isVehicle) {
      enableField(ctx.form.vehicle.vin);
      enableField(ctx.form.vehicle.brand);
    } else {
      disableAndReset(ctx.form.vehicle.vin, '');
      disableAndReset(ctx.form.vehicle.brand, '');
    }

    // --- All property fields in one place ---
    if (isProperty) {
      enableField(ctx.form.property.type);
    } else {
      disableAndReset(ctx.form.property.type, '');
    }

    // --- Arrays: compare by length ---
    if (isVehicle) {
      enableField(ctx.form.drivers);
    } else {
      disableAndReset(ctx.form.drivers, []); // Won't call setValue if already empty
    }
  },
  { immediate: false }
); // REQUIRED!
```

### Prefer Built-in Behaviors

**Instead of complex watchField with guards, use built-in behaviors when possible:**

```typescript
// ❌ COMPLEX - watchField with manual guards (error-prone)
watchField(
  path.insuranceType,
  (_value, ctx) => {
    const isVehicle = ctx.form.insuranceType.value.value === 'casco';
    if (isVehicle) {
      if (ctx.form.vehicle.vin.disabled.value) ctx.form.vehicle.vin.enable();
    } else {
      if (!ctx.form.vehicle.vin.disabled.value) ctx.form.vehicle.vin.disable();
      if (ctx.form.vehicle.vin.getValue() !== '') ctx.form.vehicle.vin.setValue('');
    }
  },
  { immediate: false }
);

// ✅ SIMPLE - enableWhen with resetOnDisable (recommended)
enableWhen(path.vehicle.vin, (form) => form.insuranceType === 'casco', { resetOnDisable: true });
enableWhen(path.vehicle.brand, (form) => form.insuranceType === 'casco', { resetOnDisable: true });
```

### Key Rules

1. **ONE watcher per trigger field** - consolidate all logic for `insuranceType` into single `watchField`
2. **ALWAYS use `{ immediate: false }`** - prevents execution during initialization
3. **Guard disable()** - only call if `!field.disabled.value`
4. **Guard enable()** - only call if `field.disabled.value`
5. **Guard setValue()** - only call if value actually differs
6. **Arrays special case** - compare by `.length`, not by reference (`[] !== []` is always true)

### Other Watchers

For watchers on different fields (e.g., `path.health.isSmoker`), apply same guards:

```typescript
watchField(
  path.health.isSmoker,
  (_value, ctx) => {
    const isSmoker = ctx.form.health.isSmoker.value.value;
    const smokingYearsField = ctx.form.health.smokingYears;

    if (smokingYearsField) {
      if (isSmoker) {
        if (smokingYearsField.disabled.value) {
          smokingYearsField.enable();
        }
      } else {
        if (!smokingYearsField.disabled.value) {
          smokingYearsField.disable();
        }
        if (smokingYearsField.getValue() !== null) {
          smokingYearsField.setValue(null);
        }
      }
    }
  },
  { immediate: false }
); // REQUIRED!
```

---
sidebar_position: 5
---

# Watch Fields

Reacting to field changes with `watchField`.

## Overview

The `watchField` behavior allows you to react to field value changes and perform side effects:

- Load data when selection changes (cascading dropdowns)
- Update component props dynamically
- Clear dependent fields
- Perform custom validation
- Transform or format values

## watchField

```typescript
import { watchField } from 'reformer/behaviors';

watchField(
  sourceField,  // Field to watch
  callback,     // Function called when value changes
  options       // { immediate?: boolean, debounce?: number }
);
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `immediate` | `boolean` | `true` | Run callback immediately with current value |
| `debounce` | `number` | `0` | Debounce delay in milliseconds |

### Callback Context

The callback receives the field value and a context object:

```typescript
watchField(path.field, (value, ctx) => {
  // value - current field value
  // ctx.form - access to all form fields
  // ctx.setFieldValue(path, value) - set field value by path string
});
```

## Basic Examples

### Loading Dependent Options

Load car models when brand changes:

```typescript title="src/behaviors/car-behavior.ts"
import { watchField, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';
import { fetchCarModels } from '../api';

interface CarForm {
  carBrand: string;
  carModel: string;
}

export const carBehavior: BehaviorSchemaFn<CarForm> = (path: FieldPath<CarForm>) => {
  watchField(
    path.carBrand,
    async (brand, ctx) => {
      // Clear model when brand changes
      ctx.form.carModel.reset();

      if (brand) {
        try {
          const { data: models } = await fetchCarModels(brand);
          ctx.form.carModel.updateComponentProps({ options: models });
        } catch (error) {
          ctx.form.carModel.updateComponentProps({ options: [] });
        }
      } else {
        ctx.form.carModel.updateComponentProps({ options: [] });
      }
    },
    { immediate: false, debounce: 300 }
  );
};
```

### Clearing Arrays on Checkbox Change

Clear array when checkbox is unchecked:

```typescript title="src/behaviors/property-behavior.ts"
interface PropertyForm {
  hasProperty: boolean;
  properties: Property[];
}

export const propertyBehavior: BehaviorSchemaFn<PropertyForm> = (path) => {
  watchField(
    path.hasProperty,
    (hasProperty, ctx) => {
      if (!hasProperty) {
        ctx.form.properties?.clear();
      }
    },
    { immediate: false }
  );
};
```

### Dynamic Field Limits

Update field constraints based on other values:

```typescript title="src/behaviors/loan-behavior.ts"
interface LoanForm {
  totalIncome: number;
  loanAmount: number;
  age: number;
  loanTerm: number;
}

export const loanBehavior: BehaviorSchemaFn<LoanForm> = (path) => {
  // Max loan amount based on income
  watchField(
    path.totalIncome,
    (totalIncome, ctx) => {
      if (totalIncome && totalIncome > 0) {
        const maxLoanAmount = Math.min(totalIncome * 12 * 10, 10000000);
        queueMicrotask(() => {
          ctx.form.loanAmount.updateComponentProps({ max: maxLoanAmount });
        });
      }
    },
    { immediate: false }
  );

  // Max term based on age (repay by 70 years old)
  watchField(
    path.age,
    (age, ctx) => {
      if (age && age >= 18) {
        const maxTermYears = Math.max(70 - age, 1);
        const maxTermMonths = Math.min(maxTermYears * 12, 240);
        queueMicrotask(() => {
          ctx.form.loanTerm.updateComponentProps({ max: maxTermMonths });
        });
      }
    },
    { immediate: false }
  );
};
```

## Advanced Examples

### Cascading Dropdowns

Load cities when region changes:

```typescript title="src/behaviors/address-behavior.ts"
interface Address {
  region: string;
  city: string;
  street: string;
  postalCode: string;
}

export const addressBehavior: BehaviorSchemaFn<Address> = (path) => {
  // Load cities when region changes
  watchField(
    path.region,
    async (region, ctx) => {
      if (region) {
        try {
          const { data: cities } = await fetchCities(region);
          ctx.form.city.updateComponentProps({ options: cities });
        } catch (error) {
          ctx.form.city.updateComponentProps({ options: [] });
        }
      }
    },
    { debounce: 300, immediate: false }
  );

  // Clear city when region changes
  watchField(
    path.region,
    (_region, ctx) => {
      ctx.setFieldValue('city', '');
    },
    { immediate: false }
  );
};
```

### Password Matching Validation

Validate password confirmation in real-time:

```typescript title="src/behaviors/registration-behavior.ts"
interface RegistrationForm {
  password: string;
  confirmPassword: string;
}

export const registrationBehavior: BehaviorSchemaFn<RegistrationForm> = (path) => {
  // When password changes, check confirmPassword
  watchField(path.password, (passwordValue, ctx) => {
    const confirmPasswordValue = ctx.form.confirmPassword.value.value;

    if (confirmPasswordValue) {
      if (passwordValue !== confirmPasswordValue) {
        ctx.form.confirmPassword.setErrors([
          {
            code: 'passwords-mismatch',
            message: 'Passwords do not match',
          },
        ]);
      } else {
        ctx.form.confirmPassword.clearErrors({ code: 'passwords-mismatch' });
      }
    }
  });

  // When confirmPassword changes, check against password
  watchField(path.confirmPassword, (confirmPasswordValue, ctx) => {
    const passwordValue = ctx.form.password.value.value;

    if (confirmPasswordValue && passwordValue) {
      if (passwordValue !== confirmPasswordValue) {
        ctx.form.confirmPassword.setErrors([
          {
            code: 'passwords-mismatch',
            message: 'Passwords do not match',
          },
        ]);
      } else {
        ctx.form.confirmPassword.clearErrors({ code: 'passwords-mismatch' });
      }
    }
  });
};
```

### Auto-Formatting Values

Format postal code as user types:

```typescript title="src/behaviors/postal-behavior.ts"
interface AddressForm {
  postalCode: string;
}

export const postalBehavior: BehaviorSchemaFn<AddressForm> = (path) => {
  watchField(
    path.postalCode,
    (postalCode, ctx) => {
      // Remove non-digits and limit to 6 characters
      const cleaned = postalCode?.replace(/\D/g, '').slice(0, 6);
      if (cleaned !== postalCode) {
        ctx.setFieldValue('postalCode', cleaned || '');
      }
    },
    { immediate: false }
  );
};
```

### Copying with Transformation

Copy value with transformation:

```typescript title="src/behaviors/transform-behavior.ts"
interface FormWithTransform {
  sourceValue: string;
  uppercaseValue: string;
  slug: string;
}

export const transformBehavior: BehaviorSchemaFn<FormWithTransform> = (path) => {
  // Copy and transform to uppercase
  watchField(path.sourceValue, (value, ctx) => {
    ctx.form.uppercaseValue.setValue(value?.toUpperCase() || '');
  });

  // Create slug from source value
  watchField(path.sourceValue, (value, ctx) => {
    const slug = value
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || '';
    ctx.form.slug.setValue(slug);
  });
};
```

## Options Deep Dive

### immediate

By default, `watchField` runs the callback immediately with the current value. Set `immediate: false` to only react to future changes:

```typescript
// Runs immediately with current value + on changes
watchField(path.field, callback);

// Only runs on future changes
watchField(path.field, callback, { immediate: false });
```

Use `immediate: false` when:
- Loading data (avoid duplicate initial load)
- Clearing dependent fields (don't clear on form initialization)
- Performing side effects that shouldn't run on mount

### debounce

Debounce the callback to reduce API calls or expensive computations:

```typescript
// Debounce 300ms - useful for API calls
watchField(path.searchQuery, async (query, ctx) => {
  const results = await searchAPI(query);
  ctx.form.results.setValue(results);
}, { debounce: 300 });
```

### queueMicrotask for Signal Safety

When updating component props inside `watchField`, use `queueMicrotask` to exit the signal effect context:

```typescript
watchField(path.income, (income, ctx) => {
  if (income > 0) {
    // Exit signal effect context before mutating
    queueMicrotask(() => {
      ctx.form.loanAmount.updateComponentProps({ max: income * 10 });
    });
  }
}, { immediate: false });
```

## Best Practices

### 1. Use immediate: false for Side Effects

```typescript
// ✅ Don't clear on initialization
watchField(path.category, (category, ctx) => {
  ctx.form.subcategory.reset();
}, { immediate: false });

// ❌ Clears subcategory on form load
watchField(path.category, (category, ctx) => {
  ctx.form.subcategory.reset();
});
```

### 2. Debounce API Calls

```typescript
// ✅ Debounce to reduce API calls
watchField(path.search, async (query, ctx) => {
  const results = await searchAPI(query);
  // ...
}, { debounce: 300 });

// ❌ API call on every keystroke
watchField(path.search, async (query, ctx) => {
  const results = await searchAPI(query);
  // ...
});
```

### 3. Handle Errors in Async Callbacks

```typescript
watchField(path.region, async (region, ctx) => {
  if (region) {
    try {
      const cities = await fetchCities(region);
      ctx.form.city.updateComponentProps({ options: cities });
    } catch (error) {
      console.error('Failed to load cities:', error);
      ctx.form.city.updateComponentProps({ options: [] });
    }
  }
}, { immediate: false, debounce: 300 });
```

### 4. Avoid Circular Dependencies

```typescript
// ❌ BAD: Creates infinite loop
watchField(path.a, (value, ctx) => {
  ctx.form.b.setValue(value * 2);
});
watchField(path.b, (value, ctx) => {
  ctx.form.a.setValue(value / 2);
});

// ✅ GOOD: One-directional flow
watchField(path.a, (value, ctx) => {
  ctx.form.b.setValue(value * 2);
});
// b is read-only or manually editable
```

### 5. Use computeFrom for Simple Calculations

```typescript
// ✅ Use computeFrom for derived values
computeFrom([path.price, path.quantity], path.total,
  (values) => values.price * values.quantity
);

// ❌ watchField is overkill for simple calculations
watchField(path.price, (price, ctx) => {
  const quantity = ctx.form.quantity.value.value;
  ctx.form.total.setValue(price * quantity);
});
watchField(path.quantity, (quantity, ctx) => {
  const price = ctx.form.price.value.value;
  ctx.form.total.setValue(price * quantity);
});
```

## When to Use watchField

| Use Case | watchField | Alternative |
|----------|------------|-------------|
| Load dependent data | ✅ | - |
| Clear dependent fields | ✅ | - |
| Update component props | ✅ | - |
| Custom validation | ✅ | Schema validation |
| Transform values | ✅ | `transformValue` |
| Compute derived values | Consider | `computeFrom` |
| One-way copy | Consider | `copyFrom` |
| Two-way sync | Consider | `syncFields` |

## Next Step

Now that you understand watching field changes, let's learn about revalidation and reset behaviors with `revalidateWhen` and `resetWhen`.

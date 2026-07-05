---
sidebar_position: 2
---

# Computed Fields

Automatically calculate field values from other fields.

## computeFrom

Calculate a field value based on one or more source fields.

```typescript
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';

const behavior = defineFormBehavior(({ model }) => {
  // Single source — source values arrive positionally
  computeFrom([model.$.price], model.$.priceWithTax, (price) => price * 1.2);

  // Multiple sources
  computeFrom(
    [model.$.price, model.$.quantity, model.$.discount],
    model.$.total,
    (price, quantity, discount) => price * quantity - discount
  );
});
```

### Example: Full Name

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';

interface NameForm {
  firstName: string;
  lastName: string;
  fullName: string;
}

const model = createModel<NameForm>({ firstName: '', lastName: '', fullName: '' });

const behavior = defineFormBehavior<NameForm>(({ model }) => {
  computeFrom([model.$.firstName, model.$.lastName], model.$.fullName, (firstName, lastName) =>
    `${firstName} ${lastName}`.trim()
  );
});

// `schema` binds the fields to components (see Quick Start).
const form = createForm<NameForm>({ model, schema, behavior });

form.firstName.setValue('John');
form.lastName.setValue('Doe');
form.fullName.value.value; // 'John Doe'
```

### Example: Loan Calculator

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';

interface LoanForm {
  principal: number;
  rate: number;
  years: number;
  monthlyPayment: number;
}

const model = createModel<LoanForm>({ principal: 10000, rate: 5, years: 10, monthlyPayment: 0 });

const behavior = defineFormBehavior<LoanForm>(({ model }) => {
  computeFrom(
    [model.$.principal, model.$.rate, model.$.years],
    model.$.monthlyPayment,
    (principal, rate, years) => {
      const monthlyRate = rate / 100 / 12;
      const months = years * 12;
      return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
    }
  );
});

// `schema` binds the fields to components (see Quick Start).
const form = createForm<LoanForm>({ model, schema, behavior });
```

## transformValue

Transform field value when it changes.

```typescript
import { defineFormBehavior, transformValue } from '@reformer/core/behaviors';

const behavior = defineFormBehavior(({ model }) => {
  // Uppercase
  transformValue(model.$.code, (value) => value.toUpperCase());

  // Format phone
  transformValue(model.$.phone, (value) => value.replace(/\D/g, '').slice(0, 10));

  // Clamp number
  transformValue(model.$.quantity, (value) => Math.max(1, Math.min(100, value)));
});
```

### Example: Currency Input

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior, transformValue } from '@reformer/core/behaviors';

interface CurrencyForm {
  amount: string;
}

const model = createModel<CurrencyForm>({ amount: '' });

const behavior = defineFormBehavior<CurrencyForm>(({ model }) => {
  transformValue(model.$.amount, (value) => {
    // Remove non-digits except decimal
    const cleaned = value.replace(/[^\d.]/g, '');
    // Ensure only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    // Limit decimal places
    if (parts[1]?.length > 2) {
      return parts[0] + '.' + parts[1].slice(0, 2);
    }
    return cleaned;
  });
});

// `schema` binds the fields to components (see Quick Start).
const form = createForm<CurrencyForm>({ model, schema, behavior });
```

## Computed with Nested Fields

Access nested fields in computations:

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';

interface CheckoutForm {
  shipping: { method: string; cost: number };
  subtotal: number;
  total: number;
}

const model = createModel<CheckoutForm>({
  shipping: { method: 'standard', cost: 0 },
  subtotal: 100,
  total: 0,
});

const behavior = defineFormBehavior<CheckoutForm>(({ model }) => {
  // Compute shipping cost
  computeFrom([model.$.shipping.method], model.$.shipping.cost, (method) =>
    method === 'express' ? 15 : 5
  );

  // Compute total
  computeFrom(
    [model.$.subtotal, model.$.shipping.cost],
    model.$.total,
    (subtotal, cost) => subtotal + cost
  );
});

// `schema` binds the fields to components (see Quick Start).
const form = createForm<CheckoutForm>({ model, schema, behavior });
```

## Next Steps

- [Conditional Logic](/docs/behaviors/conditional) — Show/hide, enable/disable
- [Field Sync](/docs/behaviors/sync) — Copy and sync fields

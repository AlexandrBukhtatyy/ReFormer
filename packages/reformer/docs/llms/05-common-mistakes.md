## 4. COMMON MISTAKES

### useFormControlValue (CRITICAL)

```typescript
// WRONG - useFormControlValue returns T directly, NOT { value: T }
const { value: loanType } = useFormControlValue(control.loanType);
// Result: loanType is ALWAYS undefined! Conditional rendering will fail.

// CORRECT
const loanType = useFormControlValue(control.loanType);

// ALSO CORRECT - useFormControl returns object
const { value, errors } = useFormControl(control.loanType);
```

### Reading Field Values in BehaviorContext (CRITICAL)

```typescript
// WRONG - getFieldValue does NOT exist!
watchField(path.amount, (amount, ctx) => {
  const rate = ctx.getFieldValue('rate'); // ERROR: Property 'getFieldValue' does not exist
});

// CORRECT - use ctx.form.fieldName.value.value
watchField(path.amount, (amount, ctx) => {
  const rate = ctx.form.rate.value.value;  // Read via signal
  ctx.setFieldValue('total', amount * rate);
});
```

### Validators

```typescript
// WRONG
required(path.email, 'Email is required');

// CORRECT
required(path.email, { message: 'Email is required' });
```

### Types

```typescript
// WRONG
amount: number | null;
[key: string]: unknown;

// CORRECT
amount: number | undefined;
// No index signature
```

### computeFrom

```typescript
// WRONG - different nesting levels
computeFrom([path.nested.a, path.nested.b], path.root, ...)

// CORRECT - use watchField
watchField(path.nested.a, (_, ctx) => {
  ctx.setFieldValue('root', computed);
});
```

### Imports

```typescript
// WRONG - types are not in submodules
import { ValidationSchemaFn } from '@reformer/core/validators';

// CORRECT - types from main module
import type { ValidationSchemaFn } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
```

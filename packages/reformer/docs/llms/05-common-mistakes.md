## 4. COMMON MISTAKES

### Imports rule (#1 cause of cascading errors — read first)

Types live in `@reformer/core`. Functions live in submodules (`/validators`,
`/behaviors`). Mixing them produces TS2614 ("has no exported member"), which
in turn collapses ALL `(path) => ...` callbacks to `implicit any` and looks
like 30+ unrelated errors.

```typescript
// ❌ WRONG — TS2614 cascades to 30+ implicit-any errors below
import { type ValidationSchemaFn } from '@reformer/core/validators';
import { type BehaviorSchemaFn } from '@reformer/core/behaviors';

// ✅ CORRECT — types from main module, functions from submodules
import {
  type ValidationSchemaFn,
  type BehaviorSchemaFn,
  type FieldPath,
  type FormSchema,
  type FormProxy,
  createForm,
} from '@reformer/core';
import { required, min, max, applyWhen, apply } from '@reformer/core/validators';
import { computeFrom, enableWhen, watchField, copyFrom } from '@reformer/core/behaviors';
```

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
  const rate = ctx.form.rate.value.value; // Read via signal
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

### Form-shape types — `type` over `interface`

```typescript
// ❌ WRONG — interface lacks implicit index signature; ArrayNode<T> /
//          FormArraySection<T> constraints (T extends FormFields) reject it.
//          Symptom: "Type 'X' is not assignable to type 'Partial<FormFields>'"
//          on FormArraySection.initialValue, OR "T does not satisfy
//          constraint 'FormFields'" on explicit generic.
export interface PropertyItem {
  type: PropertyType;
  description: string;
}

// ✅ CORRECT — type alias is structurally compatible with Record<string, FormValue>
export type PropertyItem = {
  type: PropertyType;
  description: string;
};
```

`number | null` (vs `number | undefined`) is fine — built-in validators
(`min`, `max`, `minLength`, `maxLength`, `minDate`, `maxDate`, `minAge`,
`maxAge`) accept `number | null | undefined` / `string | null | undefined`.

### computeFrom — type-safe callback (no `as` casts)

Annotate the destructured argument with the form type. Without annotation,
TS sees fields as `unknown` (`computeFn: (values: TForm) => T` infers the
full form, not a narrowed Pick of source fields), and you end up with
`as number | null` casts in every line.

```typescript
// ❌ WRONG — leads to `as` casts in every line
computeFrom([path.loanAmount, path.loanTerm], path.monthlyPayment, ({ loanAmount, loanTerm }) => {
  const a = (loanAmount as number | null) ?? 0;
  const t = (loanTerm as number | null) ?? 0;
  return annuityMonthly(a, t, 0.1);
});

// ✅ CORRECT — annotated destructuring, no casts, fields properly typed
computeFrom(
  [path.loanAmount, path.loanTerm],
  path.monthlyPayment,
  ({ loanAmount, loanTerm }: MyForm) => annuityMonthly(loanAmount ?? 0, loanTerm ?? 0, 0.1)
);
```

### computeFrom across nesting levels — use group-node subscription

```typescript
// ❌ WRONG — subscribing to leaf fields of a nested group leaks
//          implementation details and may fall back to FieldPath<unknown>
computeFrom(
  [path.personalData.firstName, path.personalData.lastName],
  path.fullName,
  ({ personalData }) => `${personalData?.firstName} ${personalData?.lastName}`
);

// ✅ CORRECT — subscribe to the group node itself; destructure the group
computeFrom([path.personalData], path.fullName, ({ personalData }: MyForm) =>
  [personalData.firstName, personalData.lastName].filter(Boolean).join(' ')
);
```

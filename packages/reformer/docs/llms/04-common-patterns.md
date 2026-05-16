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
// Use watchField instead. Write API is ctx.form.<path>.setValue(value) —
// ctx.setFieldValue(name, value) does not exist.
watchField(
  path.nested.field,
  (value, ctx) => {
    if (ctx.form.rootField.value.value !== computedValue) {
      ctx.form.rootField.setValue(computedValue);
    }
  },
  { immediate: false }
);
```

### Validation callback canonical shape

**Default (recommended) — fully typed:** annotate the validation/behavior
function with `ValidationSchemaFn<T>` / `BehaviorSchemaFn<T>` (imported from
`@reformer/core`, NOT from `/validators` or `/behaviors`). `path` and inner
`applyWhen`-callback `p` are inferred automatically — no `any` casts needed.

```typescript
import {
  createForm,
  type FormProxy,
  type ValidationSchemaFn,
  type BehaviorSchemaFn,
} from '@reformer/core';
import { required, min, validate, applyWhen, validateItems } from '@reformer/core/validators';
import { computeFrom } from '@reformer/core/behaviors';

const validation: ValidationSchemaFn<MyForm> = (path) => {
  required(path.step1.loanAmount, { message: 'Введите сумму' });
  min(path.step1.loanAmount, 50000);

  validate(path.step4.workExperienceCurrent, (value, ctx) => {
    const total = ctx.form.step4.workExperienceTotal.value.value;
    if (total != null && value != null && value > total) {
      return { code: 'experience-mismatch', message: 'Текущий стаж не может превышать общий' };
    }
    return null;
  });

  // applyWhen-callback `p` is auto-typed as FieldPath<MyForm> via the signature
  // (path: FieldPath<TForm>) => void — no manual annotation needed.
  applyWhen(
    path.step1.loanType,
    (loanType) => loanType === 'mortgage',
    (p) => {
      required(p.step1.propertyValue, { message: 'Введите стоимость недвижимости' });
      min(p.step1.propertyValue, 500000);
    }
  );

  validateItems(path.step5.properties, (itemPath) => {
    required(itemPath.type);
    min(itemPath.estimatedValue, 0);
  });
};

const behavior: BehaviorSchemaFn<MyForm> = (path) => {
  computeFrom(
    [path.step1.loanAmount],
    path.summary.total,
    ({ step1 }: MyForm) => step1.loanAmount ?? 0
  );
};

export const myForm: FormProxy<MyForm> = createForm({
  form: {
    /* schema */
  },
  validation,
  behavior,
});
```

**Legacy workaround — only when TS2589 hits.** For deeply-nested forms
(typically 6+ levels) the recursive `FormSchema<T>` mapped type can hit
TS2589 ("type instantiation excessively deep"). Only then fall back to a
function-cast on the `createForm` config plus `(path: any)` annotations.
This **disables** type-checking inside the callback — use it only when the
canonical shape literally won't compile, not as a default.

```typescript
// LEGACY — apply ONLY if canonical shape produces TS2589
export const deepForm: FormProxy<DeepForm> = (
  createForm as (config: { form: unknown; validation: unknown }) => FormProxy<DeepForm>
)({
  form: {
    /* very deep schema */
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validation: (path: any) => {
    required(path.a.b.c.d.e.field);
    applyWhen(
      path.a.b,
      (form) => form.a.b.flag,
      (p: typeof path) => {
        // (p: typeof path) preserves field-level type-checking inside the block
        required(p.a.b.x);
      }
    );
  },
});
```

Form-shape `interface` types may need to be converted to `type` aliases for
structural compatibility with `Record<string, FormValue>`-constrained
generics like `ArrayNode<T>` / `FormProxy<T>` (interface lacks an implicit
index signature). See `30-type-safety-recipes.md`.

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
  if (!value) return { code: 'required', message: 'Required' }; // Use required() instead!
  if (!value.includes('@')) return { code: 'email', message: 'Invalid' }; // Use email() instead!
  return null;
});
```

## TYPED schema generic + extracted callback rules

Two rules apply to **every** validation/behavior schema you write:

### Rule A — Use the form interface as `<T>` in the schema generic; never `any`

```typescript
import type { CreditApplicationForm } from './types';

// ✅ generic fixed → path / ctx / value all infer correctly
const validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.email);
  validateTree<CreditApplicationForm>((ctx) => {
    const form = ctx.form.getValue();  // typed CreditApplicationForm
    if (form.loanAmount && form.totalIncome && form.loanAmount > form.totalIncome * 12 * 10) {
      return { code: 'loanCap', message: '...' };
    }
    return null;
  }, { targetField: 'loanAmount' });
};

const behavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  computeFrom([path.price, path.quantity], path.total, (values) => values.price * values.quantity);
};

// ❌ generic dropped or path: any — silent fail on field-name typos
const validation: ValidationSchemaFn<any> = (path: any) => { ... };
const behavior = (path: any) => { ... };  // missing BehaviorSchemaFn<T> annotation entirely
```

`as any` cast is acceptable in narrow call-sites (e.g. TS2589 workaround for very deep forms) but should be **scoped to the expression**, not the entire callback parameter.

### Rule B — Inline OK for short callbacks; extract module-level for content

**Inline acceptable** (1-3 line callbacks):

```typescript
applyWhen(
  path.loanType,
  (t) => t === 'mortgage',
  (p) => required(p.propertyValue)
);
enableWhen(path.discountCode, (form) => form.subtotal > 100);
copyFrom(path.regAddress, path.resAddress, { when: (form) => form.sameAsReg, fields: 'all' });
validate(path.agree, (v: boolean) => (v === true ? null : { code: 'mustAgree', message: '...' }));
```

**Extract module-level when**:

- callback >5 lines or has multiple return branches
- `computeFrom([...], target, callback)` — inline arrow may lose `(values: TForm)` inference and force `(values: any)`. Module-level `function computeX(form: T): R` infers correctly.
- async `watchField` with try/catch
- callback reused in multiple places
- cross-field `validateTree` with branching logic

```typescript
// ✅ extracted typed helpers — used by behavior schema
function computeMonthlyPayment(form: LoanForm): number {
  const P = form.loanAmount,
    n = form.loanTerm,
    annual = form.interestRate;
  if (!P || !n || !annual || P <= 0 || n <= 0) return 0;
  const i = annual / 100 / 12;
  if (i <= 0) return Math.round(P / n);
  const factor = Math.pow(1 + i, n);
  return Math.round((P * (i * factor)) / (factor - 1));
}

const behavior: BehaviorSchemaFn<LoanForm> = (path) => {
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    computeMonthlyPayment // by-reference, signature already typed
  );
};
```

Reference patterns: `complex-multy-step-form/schemas/credit-application-behavior.ts`.

### Extracting Nested Rules

When the body of `applyWhen` / `validateGroup` / `validate` grows beyond a few lines,
extract it to a **named top-level function** typed with one of the public types from
`@reformer/core`:

- `ValidationSchemaFn<TForm>` — sub-schema passed to `applyWhen` or `apply`.
- `GroupValidator<TForm, TScope = TForm>` — cross-field validator passed to `validateGroup`.
- `Validator<TForm, TField>` / `AsyncValidator<TForm, TField>` — field validator passed to `validate` / `validateAsync`.

This keeps the schema body flat (reads like a table of contents) and surfaces the
**intent** of each rule via a meaningful name.

```typescript
import type { GroupValidator, ValidationSchemaFn, Validator } from '@reformer/core';

// 1. Cross-field rule — extracted GroupValidator
const initialPaymentVsPropertyValue: GroupValidator<CreditApplicationForm> = (scope) => {
  const form = scope.getValue();
  if (form.initialPayment && form.propertyValue && form.initialPayment > form.propertyValue) {
    return { code: 'initialPaymentTooHigh', message: 'Взнос не может превышать стоимость' };
  }
  return null;
};

// 2. Custom field validator — extracted Validator
const validateAdultAge: Validator<CreditApplicationForm, string | undefined> = (value) => {
  if (!value) return null;
  const age = new Date().getFullYear() - new Date(value).getFullYear();
  if (age < 18) return { code: 'tooYoung', message: 'Минимум 18 лет' };
  return null;
};

// 3. Nested schema for applyWhen — extracted ValidationSchemaFn
const mortgageFieldsRules: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.propertyValue, required());
  validate(path.propertyValue, min(1000000));
  validate(path.initialPayment, required());
  validateGroup(path, initialPaymentVsPropertyValue, { targetField: path.initialPayment });
};

// 4. Main schema — flat, reads as a table of contents
export const basicInfoValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.loanType, required());
  validate(path.personalData.birthDate, validateAdultAge);
  applyWhen(path.loanType, (type) => type === 'mortgage', mortgageFieldsRules);
};
```

**Naming convention** (camelCase, semantic — not echoing the operator name):

- `applyWhen` sub-schema → describes the conditional branch: `mortgageFieldsRules`, `employedFieldsRules`.
- `GroupValidator` → describes the invariant: `initialPaymentVsPropertyValue`, `paymentToIncomeUnderHalf`.
- `Validator` → describes the check: `validateAdultAge`, `validatePasswordsMatch`.

**When to extract.** Inline lambdas are fine for short one-liners
(`applyWhen(path.x, (v) => v === 'mortgage', mortgageFieldsRules)` — the condition stays inline).
Extract whenever the body spans more than ~3 lines or contains a `validateGroup` /
nested rules.

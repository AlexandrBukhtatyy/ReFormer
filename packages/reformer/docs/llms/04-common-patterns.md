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
watchField(path.nested.field, (value, ctx) => {
  if (ctx.form.rootField.value.value !== computedValue) {
    ctx.form.rootField.setValue(computedValue);
  }
}, { immediate: false });
```

### Validation callback canonical shape (deep nested forms)

For forms with 4+ levels of nesting (e.g. step-grouped credit form), the
recursive `FormSchema<T>` mapped type hits TS2589 ("type instantiation
excessively deep"). The canonical workaround is a function-cast on the
`createForm` config plus `(path: any)` annotations on the validation /
behavior callbacks. Inside `applyWhen` the inner callback uses
`(p: typeof path)` so type checking still works for the callback body.

```typescript
import { required, min, max, email, pattern, validate, applyWhen, validateItems } from '@reformer/core/validators';
import { createForm, type FormProxy } from '@reformer/core';

export const myForm: FormProxy<MyForm> = (
  createForm as (config: { form: unknown; validation: unknown }) => FormProxy<MyForm>
)({
  form: { /* ...nested schema... */ },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validation: (path: any) => {
    // 1. Built-in validators on individual fields
    required(path.step1.loanAmount, { message: 'Введите сумму' });
    min(path.step1.loanAmount, 50000);

    // 2. Cross-field validate(...)
    validate(path.step4.workExperienceCurrent, (value, ctx) => {
      const total = ctx.form.step4.workExperienceTotal.value.value as number | null;
      if (total != null && value != null && (value as number) > total) {
        return { code: 'experience-mismatch', message: 'Текущий стаж не может превышать общий' };
      }
      return null;
    });

    // 3. Conditional block via applyWhen — NOTE the (p: typeof path) annotation
    applyWhen(
      path.step1,
      (form) => form.step1.loanType === 'mortgage',
      (p: typeof path) => {
        required(p.step1.propertyValue, { message: 'Введите стоимость недвижимости' });
        min(p.step1.propertyValue, 500000);
      }
    );

    // 4. Array items
    validateItems(path.step5.properties, (itemPath) => {
      required(itemPath.type);
      min(itemPath.estimatedValue, 0);
    });
  },
});
```

The same `as any` cast + `validation: unknown` cast extension applies to a
`behavior: (path: any) => {...}` block. Without the cast, tsc rejects the
config object; without `(p: typeof path)` on inner `applyWhen` callbacks,
the inner type info is lost and the call doesn't compile.

### Type-Safe useFormControl

```typescript
const { value } = useFormControl(form.field as FieldNode<ExpectedType>);
```

### Validation Priority (IMPORTANT)

**Always prefer built-in validators over custom ones:**

```typescript
// 1. BEST: Use built-in validators when available
required(path.email);
email(path.email);
min(path.age, 18);
minLength(path.password, 8);
pattern(path.phone, /^\+7\d{10}$/);

// 2. GOOD: Use validate() only when no built-in validator exists
validate(path.customField, (value, ctx) => {
  // Custom logic that can't be expressed with built-in validators
  if (customCondition(value)) {
    return { code: 'custom', message: 'Custom error' };
  }
  return null;
});

// 3. WRONG: Don't recreate built-in validators
validate(path.email, (value) => {
  if (!value) return { code: 'required', message: 'Required' };  // Use required() instead!
  if (!value.includes('@')) return { code: 'email', message: 'Invalid' };  // Use email() instead!
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
applyWhen(path.loanType, (t) => t === 'mortgage', (p) => required(p.propertyValue));
enableWhen(path.discountCode, (form) => form.subtotal > 100);
copyFrom(path.regAddress, path.resAddress, { when: (form) => form.sameAsReg, fields: 'all' });
validate(path.agree, (v: boolean) => v === true ? null : { code: 'mustAgree', message: '...' });
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
  const P = form.loanAmount, n = form.loanTerm, annual = form.interestRate;
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
    computeMonthlyPayment,  // by-reference, signature already typed
  );
};
```

Reference patterns: `complex-multy-step-form/schemas/credit-application-behavior.ts` and `mcp-credit-application-v10/schema.ts` (Compute helpers section).

## 30. TYPE-SAFETY RECIPES

Idiomatic patterns that keep generated code free of `any`, `as` casts, and
implicit-any cascades. Use these as defaults; the legacy
`(path: any)` workaround in `04-common-patterns.md` is for TS2589 only.

### Recipe 1 — Imports (root cause prevention)

Types from `@reformer/core`, functions from submodules. Never put types in
`/validators` / `/behaviors` imports.

```typescript
import {
  createForm,
  type FormProxy,
  type FormSchema,
  type FieldPath,
  type ValidationSchemaFn,
  type BehaviorSchemaFn,
} from '@reformer/core';
import { required, min, max, applyWhen, apply } from '@reformer/core/validators';
import { computeFrom, enableWhen, watchField, copyFrom } from '@reformer/core/behaviors';
```

### Recipe 2 — Form-shape types as `type`, not `interface`

`Record<string, FormValue>` (= `FormFields`) needs an index signature.
`interface` doesn't supply one implicitly; `type` does — structurally.

```typescript
// ✅ Use type aliases for everything that ends up inside FormProxy<T>:
//    nested groups, array element shapes, and the root form type.
export type PropertyItem = {
  type: 'apartment' | 'house' | 'car';
  description: string;
  estimatedValue: number;
};

export type CreditApplicationForm = {
  loanAmount: number | null;
  properties: PropertyItem[];
  // ...
};
```

This avoids "Type 'PropertyItem' does not satisfy the constraint
'FormFields'" on explicit generics like `<FormArraySection<PropertyItem>>`,
and "Type 'PropertyItem' is not assignable to type 'Partial<FormFields>'"
on `initialValue` props.

### Recipe 3 — Validation/behavior callbacks: typed signatures

Use `ValidationSchemaFn<T>` / `BehaviorSchemaFn<T>` directly. `path` is
inferred; `applyWhen`-callback `p` is inferred from the function signature
(`validationFn: (path: FieldPath<TForm>) => void`). No `(path: any)` needed.

```typescript
const step1: ValidationSchemaFn<MyForm> = (path) => {
  required(path.loanAmount);
  min(path.loanAmount, 50000);

  applyWhen(
    path.loanType,
    (loanType) => loanType === 'mortgage',
    (p) => {
      required(p.propertyValue);
      min(p.propertyValue, 1_000_000);
    }
  );
};

const fullValidation: ValidationSchemaFn<MyForm> = (path) => {
  step1(path);
  apply(path.personalData, personalDataValidation); // delegate to nested
};
```

### Recipe 4 — `computeFrom` callback: annotate the destructured arg

`computeFn: (values: TForm) => TTarget` exposes the full form, not a
narrowed Pick. Without annotation TS infers fields as `unknown`. With
annotation, fields are typed exactly as declared on `T`.

```typescript
computeFrom(
  [path.loanAmount, path.loanTerm, path.interestRate],
  path.monthlyPayment,
  ({ loanAmount, loanTerm, interestRate }: MyForm) =>
    annuityMonthly(loanAmount ?? 0, loanTerm ?? 0, interestRate ?? 0)
);

// Group-node subscription for nested reads — no leaf-by-leaf:
computeFrom([path.personalData], path.fullName, ({ personalData }: MyForm) =>
  [personalData.firstName, personalData.lastName].filter(Boolean).join(' ')
);
```

### Recipe 5 — `null` vs `undefined` for optional numbers/strings

Both work. `null` is conventional for "user cleared the field" in form
libraries; built-in validators (`min`, `max`, `minLength`, `maxLength`,
`minDate`, `maxDate`, `minAge`, `maxAge`) accept `T | null | undefined`
and skip empty values internally — you don't need to wrap them in
`if (value != null)` guards.

```typescript
export type CreditForm = {
  loanAmount: number | null; // OK — min(path.loanAmount, 50000) accepts null
  loanPurpose: string | null; // OK — minLength accepts null
  birthDate: string | null; // OK — minDate/maxAge accept null
};
```

### Recipe 6 — `FormArraySection` with array-element generics

Pass the element type explicitly when TS cannot infer it from the
`control` union (FieldPathNode in the union widens T to FormFields).

```typescript
<FormArraySection<PropertyItem>
  control={control.properties}
  itemComponent={PropertyItemForm}
  initialValue={createPropertyItem()}  // Partial<PropertyItem> — checked
/>
```

If the element type is declared as `type` (Recipe 2), `<PropertyItem>`
satisfies the `extends FormFields` constraint structurally.

### Recipe 7 — `FormWizard` with form-typed ref

`FormWizard` infers `T` from the `form` prop, but JSX cannot accept a
generic at the call site. Declare the ref with the explicit form type;
the constraint `T extends Record<string, any>` allows nullable fields
(`number | null`).

```typescript
const navRef = useRef<FormWizardHandle<MyForm>>(null);

<FormWizard
  ref={navRef}
  form={form}
  config={{ stepValidations, fullValidation }}
  steps={STEPS}
  onSubmit={onSubmit}
/>
```

### Anti-patterns to avoid

- `import { type ValidationSchemaFn } from '@reformer/core/validators'` →
  TS2614, cascades to 30+ implicit-any errors.
- `(values as PersonalData | undefined)` / `(loanAmount as number | null)`
  inside `computeFrom` → use Recipe 4 instead.
- `(path: any)` annotation on validation/behavior callbacks → only valid as
  TS2589 workaround for 6+ levels of nesting; not the default.
- `interface MyForm { ... }` for form-shape types → see Recipe 2.
- `as never` cast on `computeFrom` target — never necessary; if you reach
  for it, you have one of the issues above.

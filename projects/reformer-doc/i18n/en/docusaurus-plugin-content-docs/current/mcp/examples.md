---
sidebar_position: 5
---

# Usage Examples

Scenarios of working with the AI when @reformer/mcp is connected.

## Scenario 1: Creating a form

**Request to the AI:**

```
Create a registration form with fields:
- Email
- Password (minimum 8 characters)
- Password confirmation
- Terms agreement checkbox
```

**What you get:**

The AI uses the ReFormer documentation and creates:

1. A TypeScript interface:

```typescript
interface RegistrationForm {
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}
```

2. The form schema — a tree of `{ model: model.$.email, component, componentProps }` nodes

3. Validation rules — a separate layer (`@reformer/core/validation`), not part of the layout schema:

```typescript
import { validate, defineValidation } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';
import type { ValidationIssue } from '@reformer/core';

// Password matching reads the second field → it is a rule over several fields (a model snapshot).
const passwordsMatch = (f: RegistrationForm): ValidationIssue | null =>
  f.confirmPassword && f.password && f.confirmPassword !== f.password
    ? { code: 'passwords-mismatch' }
    : null;

export const registrationRules = defineValidation<RegistrationForm>(({ model, cross }) => {
  validate(model.$.email, [required(), email()]);
  validate(model.$.password, [required(), minLength(8)]);
  validate(model.$.confirmPassword, [required()]);
  cross(model.$.confirmPassword, passwordsMatch);
  // An inline rule is a plain (value) => ValidationIssue | null function.
  validate(model.$.agreeToTerms, [(value) => (value ? null : { code: 'terms-required' })]);
});
```

Rules carry only issue codes; the texts for the codes live in the form's dictionary:

```typescript
import { defineIssueMessages } from '@reformer/core/i18n';

export const registrationMessages = defineIssueMessages({
  'passwords-mismatch': 'Passwords do not match',
  'terms-required': 'You must accept the terms',
});
```

4. A React component: one `createForm({ initial, schema, validation: registrationRules })` bundle in
   `useFormBundle`, fields — `<FormField control={form.email} />` under
   `<ValidationMessagesProvider messages={registrationMessages}>`, submission —
   `bundle.submit(handler)`: if there are issues, the handler is not called and the fields are
   highlighted.

---

## Scenario 2: Adding validation

**Request to the AI:**

```
Add validation to the order form:
- phone field: required, format +7 (XXX) XXX-XX-XX
- deliveryDate field: not earlier than tomorrow
- If deliveryType === "express", the deliveryTime field is required
```

**What you get:**

```typescript
import { validate, validateWhen, defineValidation } from '@reformer/core/validation';
import { required, pattern } from '@reformer/core/validators';
import type { ValidationIssue } from '@reformer/core';

// Inline rule: delivery date not earlier than tomorrow. Returns ValidationIssue | null.
const notBeforeTomorrow = (value: string): ValidationIssue | null => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return new Date(value) >= tomorrow ? null : { code: 'deliveryTooSoon' };
};

const orderRules = defineValidation<OrderForm>(({ model }) => {
  validate(model.$.phone, [
    required(),
    pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { code: 'phone.pattern' }),
  ]);
  validate(model.$.deliveryDate, [required(), notBeforeTomorrow]);
  // Conditional branch: the deliveryTime rule is active only for express delivery,
  // otherwise it is silenced (the error is cleared automatically).
  validateWhen(
    () => model.deliveryType === 'express',
    () => validate(model.$.deliveryTime, [required({ code: 'deliveryTime.required' })])
  );
});
```

---

## Scenario 3: Computed fields

**Request to the AI:**

```
In the order form add:
- Automatic subtotal calculation (quantity * price) for each item
- A grand total across all items
- A 10% discount if the grand total is over 10000
```

**What you get:**

```typescript
import { applyEach, compute, defineFormBehavior } from '@reformer/core/behaviors';

type OrderItem = { quantity: number | null; price: number | null; subtotal: number };
type OrderForm = { items: OrderItem[]; total: number; discount: number; finalTotal: number };

// Row behavior: the subtotal for an item
const itemBehavior = defineFormBehavior<OrderItem>(({ model: row }) => {
  compute(row.$.subtotal, () => (row.quantity ?? 0) * (row.price ?? 0));
});

export const orderBehavior = defineFormBehavior<OrderForm>(({ model }) => {
  applyEach(model.$.items, itemBehavior); // to every row, including ones added later
  compute(model.$.total, () => model.items.map((item) => item.subtotal).reduce((a, b) => a + b, 0));
  compute(model.$.discount, () => (model.total > 10000 ? model.total * 0.1 : 0));
  compute(model.$.finalTotal, () => model.total - model.discount);
});
```

---

## Scenario 4: Debugging a problem

**Request to the AI:**

```
My form doesn't show validation errors. What's wrong?

const MyForm = () => {
  const { form } = createForm<UserForm>({ initial: { email: '', password: '' }, schema: buildSchema });

  const email = useFormControl(form.email);

  // userRules are declared, but never passed to the bundle and never checked anywhere
  return (
    <input
      value={email.value}
      onChange={(e) => form.email.setValue(e.target.value)}
    />
  );
};
```

**What you get:**

The AI will find the problems:

- The bundle is recreated on every render — there is no `useFormBundle` (the nodes and their state
  are lost)
- The rules are not passed to the bundle (`validation`), and there is no submission via
  `bundle.submit` — there is nothing to check and nothing to check it
- There is no `markAsTouched` call on blur — the field stays "untouched", so the error is hidden
  (`shouldShowIssues` = false)
- Issues are not displayed anywhere: `issues` is an array of `{ code, params? }`, and the text for a
  code comes from `useIssueMessage()` (or `FormField` with `ValidationMessagesProvider`)

And it will suggest a fix:

```typescript
import { createForm } from '@reformer/core';
import { useFormBundle, useFormControl, useIssueMessage } from '@reformer/core/react';

const MyForm = () => {
  // ✅ the bundle is created once, and the rules are passed to it
  const bundle = useFormBundle(() =>
    createForm<UserForm>({
      initial: { email: '', password: '' },
      schema: buildSchema,
      validation: userRules,
    })
  );
  const { form } = bundle;

  const email = useFormControl(form.email);
  const message = useIssueMessage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // ✅ a single run of the rules; if there are issues, the handler is not called and the fields are marked touched
    await bundle.submit((values) => api.save(values));
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={email.value}
        onChange={(e) => form.email.setValue(e.target.value)}
        onBlur={() => form.email.markAsTouched()}
        aria-invalid={email.shouldShowError}
      />
      {email.shouldShowIssues && email.issues[0] && (
        <span className="error">{message(email.issues[0])}</span>
      )}
      <button type="submit">Submit</button>
    </form>
  );
};
```

---

## Scenario 5: API questions

**Requests to the AI:**

```
Which validators does ReFormer provide out of the box?
```

```
How does the watchField behavior work?
```

```
How do I do async validation?
```

The AI will answer based on up-to-date ReFormer documentation.

---

## Tips for working with the AI

### Be specific

❌ Bad:

```
Make a form
```

✅ Good:

```
Create an order form with fields: full name, phone, email, delivery address.
Phone in +7 format. Email is required. Address at least 10 characters.
```

### Provide context

When debugging, always include the code:

```
Error "Cannot read property 'value' of undefined" on line 15.

[your code]
```

### Use iterations

Start with a basic form, then add functionality:

1. "Create a basic registration form"
2. "Add email validation"
3. "Add a password match check"
4. "Add a conditional field for the company"

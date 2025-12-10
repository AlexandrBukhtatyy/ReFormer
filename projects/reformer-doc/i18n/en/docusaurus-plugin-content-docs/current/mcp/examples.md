---
sidebar_position: 5
---

# Usage Examples

Step-by-step scenarios for working with @reformer/mcp.

## Scenario 1: Create a Form from Scratch

**Task:** Create a user registration form.

**Request to AI:**

```
Create a registration form with fields:
- Email
- Password (minimum 8 characters)
- Confirm password
- Terms agreement checkbox
```

**What happens:**

1. AI calls `get_recommended_structure` to determine the structure
2. Generates TypeScript interface:

```typescript
interface RegistrationForm {
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}
```

3. Creates form schema with components
4. Adds validation:

```typescript
import { required, email, minLength, validate } from '@reformer/core/validators';

const validation: ValidationSchemaFn<RegistrationForm> = (v) => ({
  email: v.field(required(), email()),
  password: v.field(required(), minLength(8)),
  confirmPassword: v.field(
    required(),
    validate((value, form) => value === form.password.value || 'Passwords do not match')
  ),
  agreeToTerms: v.field(validate((value) => value === true || 'Agreement is required')),
});
```

5. Checks code via `check_code`

---

## Scenario 2: Add Validation

**Task:** Add validation to an existing form.

**Request to AI:**

```
Add validation to the order form:
- Phone field: required, format +7 (XXX) XXX-XX-XX
- Delivery date: not earlier than tomorrow
- If deliveryType === "express", then deliveryTime is required
```

**What happens:**

1. AI analyzes current code
2. Uses `generate_validation` to get rules
3. Generates validation:

```typescript
import { required, pattern, validate, when } from '@reformer/core/validators';

const validation: ValidationSchemaFn<OrderForm> = (v) => ({
  phone: v.field(
    required(),
    pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
      message: 'Format: +7 (XXX) XXX-XX-XX',
    })
  ),
  deliveryDate: v.field(
    required(),
    validate((value) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return new Date(value) >= tomorrow || 'Select a date no earlier than tomorrow';
    })
  ),
  deliveryTime: v.field(
    when(
      (form) => form.deliveryType.value === 'express',
      required({ message: 'Specify time for express delivery' })
    )
  ),
});
```

---

## Scenario 3: Set Up Computed Fields

**Task:** Add automatic calculation to an order form.

**Request to AI:**

```
In the order form add:
- Automatic subtotal calculation (quantity * price) for each item
- Total sum across all items
- 10% discount if total is over 10000
```

**What happens:**

1. AI uses `generate_behavior` to get patterns
2. Generates behaviors:

```typescript
import { computeFrom } from '@reformer/core/behaviors';

const behavior: BehaviorSchemaFn<OrderForm> = (b) => ({
  items: b.array({
    // Subtotal for each item
    subtotal: b.field(
      computeFrom(['quantity', 'price'], (quantity, price) => (quantity ?? 0) * (price ?? 0))
    ),
  }),
  // Total sum
  total: b.field(
    computeFrom(
      ['items'],
      (items) => items?.reduce((sum, item) => sum + (item.subtotal ?? 0), 0) ?? 0
    )
  ),
  // Discount
  discount: b.field(computeFrom(['total'], (total) => (total > 10000 ? total * 0.1 : 0))),
  // Final total with discount
  finalTotal: b.field(computeFrom(['total', 'discount'], (total, discount) => total - discount)),
});
```

---

## Scenario 4: Debug an Issue

**Task:** Understand why validation isn't working.

**Request to AI:**

```
My form doesn't show validation errors. What's wrong?

const MyForm = () => {
  const form = createForm<UserForm>({
    form: formSchema,
    validation: validationSchema,
  });

  const email = useFormControl(form.email);

  return (
    <input
      value={email.value}
      onChange={(e) => email.setValue(e.target.value)}
    />
  );
};
```

**What happens:**

1. AI uses `check_code` for analysis
2. Finds issues:
   - No `useMemo` for `createForm`
   - No call to `markAsTouched` on blur
   - No error display

3. Suggests fix:

```typescript
const MyForm = () => {
  const form = useMemo(() => createForm<UserForm>({
    form: formSchema,
    validation: validationSchema,
  }), []);

  const email = useFormControl(form.email);

  return (
    <div>
      <input
        value={email.value}
        onChange={(e) => email.setValue(e.target.value)}
        onBlur={() => email.markAsTouched()}
      />
      {email.touched && email.errors.length > 0 && (
        <span className="error">{email.errors[0]}</span>
      )}
    </div>
  );
};
```

---

## Scenario 5: Create Form from Specification

**Task:** Create a complex multi-step form based on a requirements document.

**Request to AI:**

```
Create a form based on the specification spec/insurance-application-form.md

Use the reformer MCP server for:
1. Getting project structure (get_recommended_structure)
2. Generating types (generate_types)
3. Generating schema (generate_schema)
4. Generating validation (generate_validation)
5. Generating behaviors (generate_behavior)
6. Checking code (check_code)
7. Verifying code compilation (npm run build)

The form should:
- Be multi-step (6 steps)
- Have separate validation files for each step
- Use useStepForm for navigation
- Support computed fields (endDate, age, experience)
- Have conditional field visibility
- Compile without errors
```

**What happens:**

1. AI reads the specification and analyzes requirements
2. Calls `get_recommended_structure` to determine file structure (MCP provides several schemes, selection depends on form complexity):

```
forms/
└── insurance-application/
    ├── types.ts
    ├── schema.ts
    ├── validation/
    │   ├── index.ts
    │   ├── step1-personal.ts
    │   ├── step2-contact.ts
    │   ├── step3-vehicle.ts
    │   ├── step4-insurance.ts
    │   ├── step5-payment.ts
    │   └── step6-documents.ts
    ├── behaviors.ts
    └── InsuranceApplicationForm.tsx
```

3. Generates types via `generate_types`:

4. Creates form schema via `generate_schema`:

5. Generates validation schema for each step via `generate_validation`:

6. Generates behavior schema (computed fields, conditions) via `generate_behavior`:

7. Checks code via `check_code` and fixes errors

8. Runs `npm run build` to verify compilation

**Result:**

- Fully typed multi-step form
- Separate validation per step
- Automatic calculations (age, end date)
- Conditional field visibility
- Step navigation with validation

---

## Tips for Working with AI

### Be Specific

❌ Bad:

```
Make a form
```

✅ Good:

```
Create an order form with fields: Full name, phone, email, delivery address.
Phone in +7 format. Email required. Address minimum 10 characters.
```

### Provide Context

When debugging, always include the code:

```
Error "Cannot read property 'value' of undefined" on line 15.

[your code]
```

### Use Iterations

Start with a basic form, then add functionality:

1. "Create a basic registration form"
2. "Add email validation"
3. "Add password matching check"
4. "Add conditional company field"

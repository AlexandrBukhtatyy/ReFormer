# ReFormer Quick Start Guide

A practical guide to get started with ReFormer in 10 minutes.

---

## 1. Installation

```bash
npm install @reformer/core

# Optional: UI components
npm install @reformer/cdk
```

---

## 2. Basic Form

```typescript
import { createForm } from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';

// Define your form type
interface LoginForm {
  email: string;
  password: string;
  rememberMe: boolean;
}

// Create the form
const form = createForm<LoginForm>({
  form: {
    email: { value: '' },
    password: { value: '' },
    rememberMe: { value: false },
  },
  validation: (path) => {
    required(path.email);
    email(path.email);
    required(path.password);
    minLength(path.password, 8);
  },
});
```

---

## 3. Using Form Controls

```typescript
import { useFormControl } from '@reformer/core';

function EmailInput() {
  const { value, setValue, errors, shouldShowError, touched } =
    useFormControl(form.email);

  return (
    <div>
      <input
        type="email"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => form.email.markAsTouched()}
      />
      {shouldShowError && <span className="error">{errors[0]?.message}</span>}
    </div>
  );
}
```

**Key properties:**

- `value` - current field value
- `setValue(value)` - update the value
- `errors` - array of validation errors
- `shouldShowError` - true when touched AND has errors
- `touched` / `dirty` - field interaction state

---

## 4. Validation

### Built-in Validators

```typescript
import {
  required,
  email,
  url,
  phone,
  pattern,
  min,
  max,
  minLength,
  maxLength,
  number,
  isDate,
  minDate,
  maxDate,
  pastDate,
  futureDate,
} from '@reformer/core/validators';

validation: (path) => {
  required(path.name);
  email(path.email);
  minLength(path.password, 8);
  pattern(path.phone, /^\+7\d{10}$/);
  min(path.age, 18);
  maxDate(path.birthDate, new Date());
};
```

### Custom Validation

```typescript
import { validate, validateAsync } from '@reformer/core/validators';

validation: (path) => {
  // Sync validation
  validate(path.username, (ctx) => {
    if (ctx.value().includes(' ')) {
      return { code: 'noSpaces', message: 'No spaces allowed' };
    }
    return null;
  });

  // Async validation
  validateAsync(
    path.email,
    async (ctx) => {
      const exists = await checkEmailExists(ctx.value());
      if (exists) {
        return { code: 'taken', message: 'Email already registered' };
      }
      return null;
    },
    { debounce: 500 }
  );
};
```

### Cross-field Validation

```typescript
import { validateTree } from '@reformer/core/validators';

validation: (path) => {
  validateTree(
    (ctx) => {
      if (ctx.form.password.value !== ctx.form.confirmPassword.value) {
        return { code: 'mismatch', message: 'Passwords must match' };
      }
      return null;
    },
    { targetField: 'confirmPassword' }
  );
};
```

---

## 5. Behaviors

### Computed Fields

```typescript
import { computeFrom } from '@reformer/core/behaviors';

behavior: (path) => {
  // total = price * quantity
  computeFrom([path.price, path.quantity], path.total, (values) => values.price * values.quantity);

  // fullName = firstName + lastName
  computeFrom([path.firstName, path.lastName], path.fullName, (v) =>
    `${v.firstName} ${v.lastName}`.trim()
  );
};
```

### Conditional Fields

```typescript
import { enableWhen, disableWhen } from '@reformer/core/behaviors';

behavior: (path) => {
  // Show spouse info only if married
  enableWhen(path.spouseInfo, (form) => form.maritalStatus === 'married', {
    resetOnDisable: true, // Clear values when disabled
  });

  // Disable field under condition
  disableWhen(path.manualAddress, (form) => form.useAutoAddress === true);
};
```

### Watch Field Changes

```typescript
import { watchField } from '@reformer/core/behaviors';

behavior: (path) => {
  // Load cities when country changes
  watchField(
    path.country,
    async (country, ctx) => {
      if (!country) return;

      const cities = await fetchCities(country);
      ctx.form.city.updateComponentProps({ options: cities });
      ctx.setFieldValue('city', ''); // Reset city
    },
    { debounce: 300 }
  );
};
```

### Copy Values

```typescript
import { copyFrom } from '@reformer/core/behaviors';

behavior: (path) => {
  // Copy billing address to shipping when checkbox is checked
  copyFrom(path.billingAddress, path.shippingAddress, {
    when: (form) => form.sameAsBilling === true,
  });
};
```

---

## 6. Dynamic Arrays

```typescript
import { FormArray } from '@reformer/cdk';

interface OrderForm {
  items: Array<{ name: string; price: number; qty: number }>;
}

const form = createForm<OrderForm>({
  form: {
    items: [
      { name: { value: '' }, price: { value: 0 }, qty: { value: 1 } }
    ]
  }
});

function OrderItems() {
  return (
    <FormArray.Root control={form.items}>
      <FormArray.List>
        {(item, index) => (
          <div key={index}>
            <ItemFields item={item} />
            <FormArray.RemoveButton index={index}>
              Remove
            </FormArray.RemoveButton>
          </div>
        )}
      </FormArray.List>

      <FormArray.AddButton>Add Item</FormArray.AddButton>

      <FormArray.Empty>
        <p>No items added yet</p>
      </FormArray.Empty>
    </FormArray.Root>
  );
}
```

**Programmatic control:**

```typescript
form.items.push({ name: '', price: 0, qty: 1 });
form.items.removeAt(0);
form.items.at(0); // Access item by index
form.items.clear();
```

---

## 7. Multi-step Forms

```typescript
import { FormWizard } from '@reformer/cdk';

function WizardForm() {
  return (
    <FormWizard.Root
      steps={['Personal Info', 'Address', 'Review']}
      validateOnNext={true}
    >
      <FormWizard.Indicator />

      <FormWizard.Step index={0}>
        <PersonalInfoStep />
      </FormWizard.Step>

      <FormWizard.Step index={1}>
        <AddressStep />
      </FormWizard.Step>

      <FormWizard.Step index={2}>
        <ReviewStep />
      </FormWizard.Step>

      <FormWizard.Actions>
        {({ prev, next, isFirst, isLast, submit }) => (
          <>
            {!isFirst && <button onClick={prev}>Back</button>}
            {!isLast && <button onClick={next}>Next</button>}
            {isLast && <button onClick={submit}>Submit</button>}
          </>
        )}
      </FormWizard.Actions>
    </FormWizard.Root>
  );
}
```

---

## 8. Form Submission

```typescript
async function handleSubmit() {
  // Validate entire form
  const isValid = await form.validate();

  if (!isValid) {
    console.log('Form has errors:', form.errors.value);
    return;
  }

  // Get all values
  const data = form.getValue();

  // Submit to API
  await submitToServer(data);

  // Reset form
  form.reset();
}
```

---

## 9. Best Practices

### Use useMemo for Form Creation

```typescript
function MyComponent() {
  // Create form once, not on every render
  const form = useMemo(() => createForm<MyForm>({
    form: { /* ... */ },
    validation: (path) => { /* ... */ }
  }), []);

  // Cleanup on unmount
  useEffect(() => {
    return () => form.dispose();
  }, [form]);

  return <FormUI form={form} />;
}
```

### Use shouldShowError for UX

```typescript
// Good - shows error only after user interaction
{shouldShowError && <Error>{errors[0]?.message}</Error>}

// Bad - shows error immediately
{errors.length > 0 && <Error>{errors[0]?.message}</Error>}
```

### Modular Validation Schemas

```typescript
// address-validation.ts
export const addressValidation = (path: FieldPath<Address>) => {
  required(path.street);
  required(path.city);
  required(path.postalCode);
  pattern(path.postalCode, /^\d{6}$/);
};

// main-form.ts
import { apply } from '@reformer/core/validators';

validation: (path) => {
  apply(path.homeAddress, addressValidation);
  apply(path.workAddress, addressValidation);
};
```

---

## 10. TypeScript Tips

```typescript
// Form type inference
type MyFormType = {
  email: string;
  address: {
    city: string;
    street: string;
  };
  items: Array<{ name: string; price: number }>;
};

// Paths are fully typed
form.email; // FieldNode<string>
form.address; // GroupNode<Address>
form.address.city; // FieldNode<string>
form.items; // ArrayNode<Item[]>
form.items.at(0); // GroupNode<Item>
form.items.at(0).name; // FieldNode<string>
```

---

## Next Steps

- **Full Documentation:** [reformer.dev](https://reformer.dev)
- **Examples:** [/examples](./examples) directory
- **API Reference:** [/docs](./docs)
- **Playground:** StackBlitz templates

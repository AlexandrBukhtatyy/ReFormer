---
sidebar_position: 5
---

# Validation Strategies

Advanced validation patterns and strategies for complex forms.

## Validation Timing

Per-field timing is controlled by the `updateOn` option on the schema field
(`'change' | 'blur' | 'submit'`, default `'blur'`). A full data check runs on demand via
`validateFormModel(model, schema)`.

### Validate on Change

Immediate feedback as user types:

```typescript
import { createModel, createForm } from '@reformer/core';
import { required, minLength } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

const model = createModel<{ username: string }>({ username: '' });

const schema = {
  username: {
    value: model.$.username,
    component: Input,
    validators: [required(), minLength(3)],
    updateOn: 'change', // validate on every keystroke
  },
};

const form = createForm({ model, schema });
```

**Best for:**

- Simple fields (text, numbers)
- Real-time feedback
- Client-side validation

**Avoid for:**

- Expensive validations
- API calls

### Validate on Blur

Validate when field loses focus:

```typescript
import { createModel, createForm } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

const model = createModel<{ email: string }>({ email: '' });

const schema = {
  email: {
    value: model.$.email,
    component: Input,
    validators: [required(), email()],
    updateOn: 'blur', // validate when the field loses focus (default)
  },
};

const form = createForm({ model, schema });
```

**Best for:**

- Most form fields
- Better UX (less intrusive)
- Async validation with debounce

### Validate on Submit

Only validate when form is submitted:

```typescript
import { createModel, createForm, validateFormModel } from '@reformer/core';
import { required, minLength } from '@reformer/core/validators';
import { Textarea } from '@reformer/ui-kit';

const model = createModel<{ feedback: string }>({ feedback: '' });

const schema = {
  feedback: {
    value: model.$.feedback,
    component: Textarea,
    validators: [required(), minLength(10)],
    updateOn: 'submit', // validate only on submit
  },
};

const form = createForm({ model, schema });

// Trigger validation manually
const handleSubmit = async () => {
  form.markAsTouched(); // reveal errors in the UI
  const { valid } = await validateFormModel(model, schema);
  if (valid) {
    console.log('Valid:', model.get());
  }
};
```

**Best for:**

- Optional fields
- Large text areas
- Complex forms where real-time validation is distracting

## Sync vs Async Validation

### Sync-First Strategy

Sync factories run first (in array order); the async check is declared separately and
self-guards, so it does no work until the basic conditions hold:

```typescript
import { createModel, createForm, type ModelValidator } from '@reformer/core';
import { required, minLength, maxLength, pattern } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

const model = createModel<{ username: string }>({ username: '' });

// Async check — runs after the sync factories; the early return is the "only if sync passes" guard
const usernameAvailable: ModelValidator<string> = async (value) => {
  if (!value || value.length < 3) return null;

  const response = await fetch(`/api/check-username?username=${value}`);
  const { available } = await response.json();

  return available ? null : { code: 'usernameTaken', message: 'Username is already taken' };
};

const schema = {
  username: {
    value: model.$.username,
    component: Input,
    // Sync validators first
    validators: [
      required(),
      minLength(3),
      maxLength(20),
      pattern(/^[a-zA-Z0-9_]+$/, { message: 'Invalid characters' }),
    ],
    // Async validator declared separately, with debounce
    asyncValidators: [usernameAvailable],
    debounce: 500,
  },
};

const form = createForm({ model, schema });
```

**Benefits:**

- Faster feedback for basic errors
- Reduces unnecessary API calls
- Better performance

### Parallel Async Validation

`validateFormModel` runs field async validators in parallel (`Promise.all`):

```typescript
import { createModel, createForm, type ModelValidator } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

const model = createModel<{ username: string; email: string }>({ username: '', email: '' });

// Check username availability
const usernameAvailable: ModelValidator<string> = async (value) => {
  const response = await fetch(`/api/check-username?username=${value}`);
  const { available } = await response.json();
  return available ? null : { code: 'usernameTaken', message: 'Username is taken' };
};

// Check email availability
const emailAvailable: ModelValidator<string> = async (value) => {
  const response = await fetch(`/api/check-email?email=${value}`);
  const { available } = await response.json();
  return available ? null : { code: 'emailTaken', message: 'Email is taken' };
};

const schema = {
  username: {
    value: model.$.username,
    component: Input,
    asyncValidators: [usernameAvailable],
    debounce: 500,
  },
  email: {
    value: model.$.email,
    component: Input,
    asyncValidators: [emailAvailable],
    debounce: 500,
  },
};

const form = createForm({ model, schema });
```

## Conditional Validation

Rules that apply only in a branch are expressed with a native branch node
`{ when: (scope, root) => boolean, children: [...] }` in the schema tree.
`validateFormModel` validates `children` when `when` is true; when false, the sub-tree is
skipped and its fields' errors are cleared.

### Simple Conditional

Validate based on another field:

```typescript
import { createModel, validateFormModel } from '@reformer/core';
import { required, pattern } from '@reformer/core/validators';

const model = createModel<{
  hasCompany: boolean;
  companyName: string;
  companyTaxId: string;
}>({ hasCompany: false, companyName: '', companyTaxId: '' });

const schema = {
  children: [
    { value: model.$.hasCompany },
    {
      // Only validate company fields when hasCompany is true
      when: (_scope, root) => root.hasCompany === true,
      children: [
        { value: model.$.companyName, validators: [required()] },
        {
          value: model.$.companyTaxId,
          validators: [required(), pattern(/^\d{9}$/, { message: 'Invalid Tax ID' })],
        },
      ],
    },
  ],
};

const { valid, errors } = await validateFormModel(model, schema);
```

### Complex Conditional

Multiple conditions:

```typescript
import { createModel, validateFormModel } from '@reformer/core';
import { required, pattern } from '@reformer/core/validators';

const model = createModel<{
  accountType: 'personal' | 'business';
  businessName: string;
  ein: string;
  ssn: string;
}>({ accountType: 'personal', businessName: '', ein: '', ssn: '' });

const schema = {
  children: [
    { value: model.$.accountType, validators: [required()] },

    // Business account validation
    {
      when: (_scope, root) => root.accountType === 'business',
      children: [
        { value: model.$.businessName, validators: [required()] },
        {
          value: model.$.ein,
          validators: [required(), pattern(/^\d{2}-\d{7}$/, { message: 'Invalid EIN' })],
        },
      ],
    },

    // Personal account validation
    {
      when: (_scope, root) => root.accountType === 'personal',
      children: [
        {
          value: model.$.ssn,
          validators: [required(), pattern(/^\d{3}-\d{2}-\d{4}$/, { message: 'Invalid SSN' })],
        },
      ],
    },
  ],
};

const { valid, errors } = await validateFormModel(model, schema);
```

## Dependent Field Validation

Cross-field rules are plain `ModelValidator`s that read sibling fields through `root` and are
attached to the field that carries the error. To re-check them when a dependency changes, wire
`revalidateWhen` in a behavior.

### Sequential Validation

Validate based on previous field:

```typescript
import { createModel, createForm, validateFormModel, type ModelValidator } from '@reformer/core';
import { required, minLength } from '@reformer/core/validators';
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { Input } from '@reformer/ui-kit';

type PasswordForm = { password: string; confirmPassword: string };

const model = createModel<PasswordForm>({ password: '', confirmPassword: '' });

// confirmPassword must match password — read the sibling via `root`
const passwordsMatch: ModelValidator<string, unknown, PasswordForm> = (value, _scope, root) =>
  value && root.password && value !== root.password
    ? { code: 'passwordMismatch', message: 'Passwords do not match' }
    : null;

const schema = {
  password: {
    value: model.$.password,
    component: Input,
    validators: [required(), minLength(8)],
  },
  confirmPassword: {
    value: model.$.confirmPassword,
    component: Input,
    validators: [required(), passwordsMatch],
  },
};

// Re-validate so confirmPassword re-checks whenever password changes
const behavior = defineFormBehavior<PasswordForm>(({ model }) => {
  revalidateWhen([model.$.password], () => {
    void validateFormModel(model, schema);
  });
});

const form = createForm({ model, schema, behavior });
```

### Date Range Validation

Validate date ranges:

```typescript
import { createModel, createForm, validateFormModel, type ModelValidator } from '@reformer/core';
import { required } from '@reformer/core/validators';
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';

type DateRangeForm = { startDate: Date | null; endDate: Date | null };

const model = createModel<DateRangeForm>({ startDate: null, endDate: null });

// End date must be after start date
const endAfterStart: ModelValidator<Date | null, unknown, DateRangeForm> = (
  value,
  _scope,
  root
) => {
  const startDate = root.startDate;
  if (!value || !startDate) return null;

  return new Date(value) < new Date(startDate)
    ? { code: 'endBeforeStart', message: 'End date must be after start date' }
    : null;
};

// Date range is not more than 1 year
const rangeUnderOneYear: ModelValidator<Date | null, unknown, DateRangeForm> = (
  value,
  _scope,
  root
) => {
  const startDate = root.startDate;
  if (!value || !startDate) return null;

  const diffDays =
    (new Date(value).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);

  return diffDays > 365 ? { code: 'rangeTooLong', message: 'Range must not exceed 1 year' } : null;
};

const schema = {
  startDate: { value: model.$.startDate, validators: [required()] },
  endDate: { value: model.$.endDate, validators: [required(), endAfterStart, rangeUnderOneYear] },
};

// Re-check endDate rules when startDate changes
const behavior = defineFormBehavior<DateRangeForm>(({ model }) => {
  revalidateWhen([model.$.startDate], () => {
    void validateFormModel(model, schema);
  });
});

const form = createForm({ model, schema, behavior });
```

## Multi-Field Validation

### Cross-Field Validation

Validate multiple fields together:

```typescript
import { createModel, createForm, validateFormModel, type ModelValidator } from '@reformer/core';
import { required, min } from '@reformer/core/validators';
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';

type PriceForm = { minPrice: number; maxPrice: number };

const model = createModel<PriceForm>({ minPrice: 0, maxPrice: 0 });

// Price range rule — reads minPrice through `root`
const maxAboveMin: ModelValidator<number, unknown, PriceForm> = (value, _scope, root) =>
  value && root.minPrice && value < root.minPrice
    ? { code: 'invalidRange', message: 'Max price must be greater than min price' }
    : null;

const schema = {
  minPrice: { value: model.$.minPrice, validators: [required(), min(0)] },
  maxPrice: { value: model.$.maxPrice, validators: [required(), min(0), maxAboveMin] },
};

const behavior = defineFormBehavior<PriceForm>(({ model }) => {
  revalidateWhen([model.$.minPrice], () => void validateFormModel(model, schema));
});

const form = createForm({ model, schema, behavior });
```

### Form-Level Validation

Validate entire form:

```typescript
import { createModel, createForm, type ModelValidator } from '@reformer/core';
import { required } from '@reformer/core/validators';

type PaymentForm = { paymentMethod: 'card' | 'bank'; cardNumber: string; bankAccount: string };

const model = createModel<PaymentForm>({ paymentMethod: 'card', cardNumber: '', bankAccount: '' });

// Cross-field rule: attach to the most relevant target field, read others via `root`
const cardRequiredWhenCard: ModelValidator<string, unknown, PaymentForm> = (value, _scope, root) =>
  root.paymentMethod === 'card' && !value
    ? { code: 'required', message: 'Card number is required' }
    : null;

const bankRequiredWhenBank: ModelValidator<string, unknown, PaymentForm> = (value, _scope, root) =>
  root.paymentMethod === 'bank' && !value
    ? { code: 'required', message: 'Bank account is required' }
    : null;

const schema = {
  paymentMethod: { value: model.$.paymentMethod, validators: [required()] },
  cardNumber: { value: model.$.cardNumber, validators: [cardRequiredWhenCard] },
  bankAccount: { value: model.$.bankAccount, validators: [bankRequiredWhenBank] },
};

const form = createForm({ model, schema });
```

## Array Validation Strategies

Array sections in a validation schema are declared with
`{ componentProps: { control: model.<array>, itemComponent: (item) => subSchema } }`;
`validateFormModel` walks them per item. Array-wide rules are `ModelValidator`s that read the
whole array through `root`.

### Validate All Items

```typescript
import { createModel, validateFormModel, type FormModel } from '@reformer/core';
import { required, email } from '@reformer/core/validators';

type EmailItem = { address: string };
type MyForm = { emails: EmailItem[] };

const model = createModel<MyForm>({ emails: [{ address: '' }] });

// Per-item sub-schema — validated for every element
const emailItem = (item: FormModel<EmailItem>) => ({
  address: { value: item.$.address, validators: [required(), email()] },
});

const schema = {
  emails: { componentProps: { control: model.emails, itemComponent: emailItem } },
};

const { valid, errors } = await validateFormModel(model, schema);
```

### Validate Array Length

```typescript
import {
  createModel,
  validateFormModel,
  type ModelValidator,
  type FormModel,
} from '@reformer/core';
import { required, pattern } from '@reformer/core/validators';

type PhoneItem = { number: string };
type MyForm = { phoneNumbers: PhoneItem[] };

const model = createModel<MyForm>({ phoneNumbers: [{ number: '' }] });

const phoneItem = (item: FormModel<PhoneItem>) => ({
  number: {
    value: item.$.number,
    validators: [required(), pattern(/^\d{10}$/, { message: 'Invalid phone' })],
  },
});

// Array-length rule — reads the whole array through `root`
const phoneCountInRange: ModelValidator<PhoneItem[], unknown, MyForm> = (_value, _scope, root) => {
  const count = root.phoneNumbers.length;

  if (count < 1) {
    return { code: 'minItems', message: 'At least one phone number is required' };
  }
  if (count > 5) {
    return { code: 'maxItems', message: 'No more than 5 phone numbers allowed' };
  }
  return null;
};

const schema = {
  phoneNumbers: { componentProps: { control: model.phoneNumbers, itemComponent: phoneItem } },
  // Whole-array rule bound to the array signal
  phoneNumbersRule: { value: model.$.phoneNumbers, validators: [phoneCountInRange] },
};

const { valid, errors } = await validateFormModel(model, schema);
```

### Validate Unique Items

```typescript
import {
  createModel,
  validateFormModel,
  type ModelValidator,
  type FormModel,
} from '@reformer/core';
import { required } from '@reformer/core/validators';

type TagItem = { label: string };
type MyForm = { tags: TagItem[] };

const model = createModel<MyForm>({ tags: [{ label: '' }] });

const tagItem = (item: FormModel<TagItem>) => ({
  label: { value: item.$.label, validators: [required()] },
});

// Tags must be unique — read items through `root`
const uniqueTags: ModelValidator<TagItem[], unknown, MyForm> = (_value, _scope, root) => {
  const labels = root.tags.map((t) => t.label);

  return labels.length !== new Set(labels).size
    ? { code: 'notUnique', message: 'Tags must be unique' }
    : null;
};

const schema = {
  tags: { componentProps: { control: model.tags, itemComponent: tagItem } },
  tagsRule: { value: model.$.tags, validators: [uniqueTags] },
};

const { valid, errors } = await validateFormModel(model, schema);
```

## Performance Optimization

### Debounce Async Validation

```typescript
import { createModel, createForm, type ModelValidator } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

const model = createModel<{ username: string }>({ username: '' });

const usernameAvailable: ModelValidator<string> = async (value) => {
  const response = await fetch(`/api/check-username?username=${value}`);
  const { available } = await response.json();
  return available ? null : { code: 'usernameTaken', message: 'Username is taken' };
};

const schema = {
  username: {
    value: model.$.username,
    component: Input,
    // Debounce expensive API calls
    asyncValidators: [usernameAvailable],
    debounce: 500, // Wait 500ms after user stops typing
  },
};

const form = createForm({ model, schema });
```

### Cancel Previous Async Validations

ReFormer automatically cancels previous async validations when new ones start — when a run
begins before the previous one finishes, the superseded run is aborted (`AbortController`), so
only the latest result is applied:

```typescript
import { createModel, createForm, type ModelValidator } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

const model = createModel<{ search: string }>({ search: '' });

const hasResults: ModelValidator<string> = async (value) => {
  // This validation is automatically cancelled
  // if the value changes again before it completes
  const results = await searchAPI(value);
  return results.length > 0 ? null : { code: 'noResults', message: 'No results found' };
};

const schema = {
  search: {
    value: model.$.search,
    component: Input,
    asyncValidators: [hasResults],
    debounce: 300,
  },
};

const form = createForm({ model, schema });
```

### Lazy Validation

Only validate when needed — gate the section behind a branch node:

```typescript
import { createModel, validateFormModel } from '@reformer/core';
import { required } from '@reformer/core/validators';

type MyForm = { enabled: boolean; field1: string; field2: string };

const model = createModel<MyForm>({ enabled: false, field1: '', field2: '' });

const schema = {
  children: [
    { value: model.$.enabled },
    {
      // Only validate when a guard field is set (e.g. `enabled: boolean` in the form)
      when: (_scope, root) => root.enabled === true,
      children: [
        { value: model.$.field1, validators: [required()] },
        { value: model.$.field2, validators: [required()] },
      ],
    },
  ],
};

const { valid, errors } = await validateFormModel(model, schema);
```

## Validation Strategies by Use Case

### Registration Form

```typescript
import { createModel, createForm, validateFormModel, type ModelValidator } from '@reformer/core';
import { required, minLength, email } from '@reformer/core/validators';
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { Input } from '@reformer/ui-kit';

type RegistrationForm = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const model = createModel<RegistrationForm>({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
});

const checkUsernameAvailability: ModelValidator<string> = async (value) => {
  if (!value) return null;
  const { available } = await (await fetch(`/api/check-username?username=${value}`)).json();
  return available ? null : { code: 'usernameTaken', message: 'Username is taken' };
};

const checkEmailAvailability: ModelValidator<string> = async (value) => {
  if (!value) return null;
  const { available } = await (await fetch(`/api/check-email?email=${value}`)).json();
  return available ? null : { code: 'emailTaken', message: 'Email is taken' };
};

const strongPassword: ModelValidator<string> = (value) =>
  value && !/(?=.*[A-Z])(?=.*\d)/.test(value)
    ? { code: 'weakPassword', message: 'Add an uppercase letter and a digit' }
    : null;

const matchesPassword: ModelValidator<string, unknown, RegistrationForm> = (value, _scope, root) =>
  value && root.password && value !== root.password
    ? { code: 'passwordMismatch', message: 'Passwords do not match' }
    : null;

const schema = {
  // Username: sync + async, on blur
  username: {
    value: model.$.username,
    component: Input,
    validators: [required(), minLength(3)],
    asyncValidators: [checkUsernameAvailability],
    updateOn: 'blur',
    debounce: 500,
  },
  // Email: sync + async, on blur
  email: {
    value: model.$.email,
    component: Input,
    validators: [required(), email()],
    asyncValidators: [checkEmailAvailability],
    updateOn: 'blur',
    debounce: 500,
  },
  // Password: sync only, on change
  password: {
    value: model.$.password,
    component: Input,
    validators: [required(), minLength(8), strongPassword],
    updateOn: 'change',
  },
  // Confirm password: sync dependent, on change
  confirmPassword: {
    value: model.$.confirmPassword,
    component: Input,
    validators: [required(), matchesPassword],
    updateOn: 'change',
  },
};

const behavior = defineFormBehavior<RegistrationForm>(({ model }) => {
  // Re-check confirmPassword whenever password changes
  revalidateWhen([model.$.password], () => void validateFormModel(model, schema));
});

const form = createForm({ model, schema, behavior });
```

### Search Form

```typescript
import { createModel, createForm, validateFormModel, type ModelValidator } from '@reformer/core';
import { minLength, min } from '@reformer/core/validators';
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { Input } from '@reformer/ui-kit';

type SearchForm = {
  query: string;
  filters: { category: string; minPrice: number; maxPrice: number };
};

const model = createModel<SearchForm>({
  query: '',
  filters: { category: '', minPrice: 0, maxPrice: 0 },
});

const maxAboveMin: ModelValidator<number, unknown, SearchForm> = (value, _scope, root) =>
  value && root.filters.minPrice && value < root.filters.minPrice
    ? { code: 'invalidRange', message: 'Max price must be greater than min price' }
    : null;

const schema = {
  // Query: minimal validation, immediate
  query: {
    value: model.$.query,
    component: Input,
    validators: [minLength(2)],
    updateOn: 'change',
  },
  // Filters: validate on submit
  filters: {
    category: { value: model.$.filters.category, component: Input },
    minPrice: {
      value: model.$.filters.minPrice,
      component: Input,
      validators: [min(0)],
      updateOn: 'submit',
    },
    maxPrice: {
      value: model.$.filters.maxPrice,
      component: Input,
      validators: [min(0), maxAboveMin],
      updateOn: 'submit',
    },
  },
};

const behavior = defineFormBehavior<SearchForm>(({ model }) => {
  revalidateWhen([model.$.filters.minPrice], () => void validateFormModel(model, schema));
});

const form = createForm({ model, schema, behavior });
```

### Payment Form

```typescript
import { createModel, createForm, type ModelValidator } from '@reformer/core';
import { required, pattern } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

type PaymentForm = { cardNumber: string; expiryDate: string; cvv: string; billingZip: string };

const model = createModel<PaymentForm>({ cardNumber: '', expiryDate: '', cvv: '', billingZip: '' });

const creditCard: ModelValidator<string> = (value) =>
  value && !/^\d{13,19}$/.test(value.replace(/\s/g, ''))
    ? { code: 'invalidCard', message: 'Invalid card number' }
    : null;

const validateCardWithBank: ModelValidator<string> = async (value) => {
  if (!value) return null;
  const { accepted } = await (await fetch(`/api/validate-card?number=${value}`)).json();
  return accepted ? null : { code: 'cardRejected', message: 'Card was rejected' };
};

const notExpired: ModelValidator<string> = (value) => {
  // ... check that MM/YY is in the future
  return value ? null : null;
};

const schema = {
  // Card number: sync + async
  cardNumber: {
    value: model.$.cardNumber,
    component: Input,
    validators: [required(), creditCard],
    asyncValidators: [validateCardWithBank],
    updateOn: 'blur',
    debounce: 1000,
  },
  // Expiry: sync only
  expiryDate: {
    value: model.$.expiryDate,
    component: Input,
    validators: [required(), notExpired],
    updateOn: 'blur',
  },
  // CVV: sync only
  cvv: {
    value: model.$.cvv,
    component: Input,
    validators: [required(), pattern(/^\d{3,4}$/, { message: 'Invalid CVV' })],
    updateOn: 'blur',
  },
  // ZIP: sync only
  billingZip: {
    value: model.$.billingZip,
    component: Input,
    validators: [required(), pattern(/^\d{5}$/, { message: 'Invalid ZIP' })],
    updateOn: 'blur',
  },
};

const form = createForm({ model, schema });
```

## Best Practices

### 1. Validate Early, Validate Often

```typescript
// ✅ Good - multiple focused validators
password: {
  value: model.$.password,
  validators: [required(), minLength(8), strongPassword],
},

// ❌ Bad - single generic validation
const generic: ModelValidator<string> = (value) =>
  !value || value.length < 8 || !isStrong(value) ? { code: 'invalid', message: 'Invalid' } : null;
password: { value: model.$.password, validators: [generic] },
```

### 2. Provide Specific Error Messages

```typescript
// Inside a ModelValidator body:

// ✅ Good - specific errors
if (value.length < 8) return { code: 'tooShort', message: 'Minimum 8 characters' };
if (!/[A-Z]/.test(value)) return { code: 'noUppercase', message: 'Add an uppercase letter' };
if (!/[0-9]/.test(value)) return { code: 'noNumber', message: 'Add a number' };

// ❌ Bad - generic error
if (!isValid(value)) return { code: 'invalid', message: 'Invalid' };
```

### 3. Debounce Expensive Operations

```typescript
// ✅ Good - debounced async validation
username: { value: model.$.username, asyncValidators: [checkAvailability], debounce: 500 },

// ❌ Bad - validates on every keystroke
username: { value: model.$.username, asyncValidators: [checkAvailability], updateOn: 'change' },
```

### 4. Use Conditional Validation

```typescript
// ✅ Good - only validate when needed (branch node)
{
  when: (_scope, root) => root.hasCompany === true,
  children: [{ value: model.$.companyName, validators: [required()] }],
}

// ❌ Bad - always validate, hide errors
companyName: { value: model.$.companyName, validators: [required()] },
// Then hide errors in UI - wasteful
```

### 5. Separate Sync and Async

```typescript
// ✅ Good - sync validators + async validator
email: {
  value: model.$.email,
  validators: [required(), email()],
  asyncValidators: [checkEmailAvailability],
},

// ❌ Bad - only async (slower feedback)
const emailAllInOne: ModelValidator<string> = async (value) => {
  if (!value) return { code: 'required', message: 'Required' };
  if (!isEmail(value)) return { code: 'email', message: 'Invalid email' };
  const available = await checkAvailability(value);
  return available ? null : { code: 'taken', message: 'Taken' };
};
```

## Extracting Nested Rules

When a cross-field validator body or a conditional branch grows beyond a few lines,
extract it to a **named top-level function or schema constant** typed with one of the public
types from `@reformer/core`. This keeps the schema body flat (reads like a table of contents)
and surfaces the **intent** of each rule via a meaningful name.

Use the existing public types:

- `FormSchemaNode` — a schema fragment: a branch node `{ when, children }` or a group.
- `ModelValidator<TValue, TModel, TRoot>` — a field-level or cross-field validator for a
  field's `validators` / `asyncValidators`. Cross-field rules use the same signature —
  read sibling fields through the `root` argument.

### Before — inline callbacks

```typescript
const schema = {
  children: [
    { value: model.$.loanType, validators: [required()] },
    {
      when: (_scope, root) => root.loanType === 'mortgage',
      children: [
        { value: model.$.propertyValue, validators: [required(), min(1_000_000)] },
        {
          value: model.$.initialPayment,
          validators: [
            required(),
            (_value, _scope, root) => {
              if (
                root.initialPayment &&
                root.propertyValue &&
                root.initialPayment > root.propertyValue
              ) {
                return { code: 'initialPaymentTooHigh', message: '...' };
              }
              return null;
            },
          ],
        },
      ],
    },
  ],
};
```

### After — extracted named functions

```typescript
import { type ModelValidator, type FormSchemaNode } from '@reformer/core';
import { required, min } from '@reformer/core/validators';

const initialPaymentVsPropertyValue: ModelValidator<number, unknown, CreditApplicationForm> = (
  _value,
  _scope,
  root
) => {
  if (root.initialPayment && root.propertyValue && root.initialPayment > root.propertyValue) {
    return { code: 'initialPaymentTooHigh', message: '...' };
  }
  return null;
};

const mortgageFieldsBranch: FormSchemaNode = {
  when: (_scope, root) => (root as CreditApplicationForm).loanType === 'mortgage',
  children: [
    { value: model.$.propertyValue, validators: [required(), min(1_000_000)] },
    { value: model.$.initialPayment, validators: [required(), initialPaymentVsPropertyValue] },
  ],
};

const schema: FormSchemaNode = {
  children: [{ value: model.$.loanType, validators: [required()] }, mortgageFieldsBranch],
};
```

### Naming convention

Use **semantic** names (not just echoing the operator):

- Branch node (`FormSchemaNode`) → describes the conditional branch:
  `mortgageFieldsBranch`, `employedFieldsBranch`, `residenceAddressBranch`.
- Cross-field `ModelValidator` → describes the invariant being checked:
  `initialPaymentVsPropertyValue`, `paymentToIncomeUnderHalf`, `currentExperienceVsTotal`.
- Field-level `ModelValidator` → describes the field-level check:
  `validateAdultAge`, `validatePasswordsMatch`, `validatePassportIssueDateNotFuture`.

### When to extract

- **Extract** any validator body that spans more than ~3 lines or a branch that contains a
  nested branch.
- **Keep inline** short one-line branch conditions —
  `(_scope, root) => root.loanType === 'mortgage'` doesn't benefit from being named.

## Next Steps

- [Error Handling](/docs/validation/error-handling) — Handle and display validation errors
- [Custom Validators](/docs/validation/custom) — Create custom validation logic
- [Async Validation](/docs/validation/async) — Server-side validation patterns

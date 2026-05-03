---
marp: true
theme: default
paginate: true
title: ReFormer - Overview for Tech Leads
---

# ReFormer

## Modern Form State Management

Signals-based | TypeScript-first | React 16.8-19

---

# The Problem

**Managing complex forms is hard:**

- Deeply nested state structures
- Cross-field dependencies
- Async validation with race conditions
- Performance issues with large forms
- Boilerplate code everywhere
- Poor TypeScript inference

---

# The Solution: ReFormer

**Declarative API with three concerns:**

```typescript
const form = createForm<MyForm>({
  form: {
    /* field configuration */
  },
  validation: (path) => {
    /* validation rules */
  },
  behavior: (path) => {
    /* reactive behaviors */
  },
});
```

Clean separation of concerns, full type safety.

---

# Key Features

| Feature             | Description                                 |
| ------------------- | ------------------------------------------- |
| **Signals**         | Fine-grained reactivity, minimal re-renders |
| **TypeScript**      | Full inference, type-safe paths             |
| **Validation**      | 15+ built-in validators, async support      |
| **Behaviors**       | Computed fields, conditional logic          |
| **Multi-step**      | Built-in wizard navigation                  |
| **Schema adapters** | Zod, Yup, Valibot integration               |

---

# Validation System

**Built-in validators:**

```typescript
(required, email, url, phone, pattern);
(min, max, minLength, maxLength, number);
(isDate, minDate, maxDate, pastDate, futureDate, minAge, maxAge);
```

---

# Dynamic Behaviors

```typescript
behavior: (path) => {
  // Computed fields
  computeFrom([path.price, path.qty], path.total, (v) => v.price * v.qty);

  // Conditional fields
  enableWhen(path.spouseInfo, (form) => form.married === true);

  // Side effects
  watchField(path.country, async (country, ctx) => {
    const cities = await fetchCities(country);
    ctx.form.city.updateComponentProps({ options: cities });
  });
};
```

---

# Headless UI Components

**FormArray** - Dynamic lists:

```typescript
<FormArray.Root control={form.items}>
  <FormArray.List>{(item) => <ItemRow item={item} />}</FormArray.List>
  <FormArray.AddButton>Add</FormArray.AddButton>
</FormArray.Root>
```

**FormWizard** - Multi-step wizards:

```typescript
<FormWizard.Root steps={['Personal', 'Address', 'Review']}>
  <FormWizard.Indicator />
  <FormWizard.Step>{/* content */}</FormWizard.Step>
  <FormWizard.Actions />
</FormWizard.Root>
```

---

# Performance

**Fine-grained reactivity:**

- Only changed fields re-render
- No full form re-renders on each keystroke
- Debounced async validation
- Lazy proxy initialization

**Tree-shakeable:**

- Import only what you need
- Modular validator imports
- Separate UI package

---

# Comparison

| Feature                  |    ReFormer     | React Hook Form | Formik |
| ------------------------ | :-------------: | :-------------: | :----: |
| Signals-based reactivity |       Yes       |       No        |   No   |
| Built-in behaviors       |       Yes       |       No        |   No   |
| Built-in multi-step      |       Yes       |       No        |   No   |
| Schema adapters          | Zod/Yup/Valibot |     Zod/Yup     |  Yup   |
| TypeScript inference     |    Excellent    |      Good       | Basic  |
| Headless UI              |       Yes       |       No        |   No   |

---

# Package Ecosystem

```
@reformer/core      Core library (required)
@reformer/cdk        Headless UI components
@reformer/mcp       AI assistant integration
```

**Dependencies:**

- `@preact/signals-core` - reactivity
- `use-sync-external-store` - React integration

---

# Getting Started

```bash
npm install @reformer/core
```

```typescript
import { createForm } from '@reformer/core';
import { required, email } from '@reformer/core/validators';

const form = createForm<LoginForm>({
  form: {
    email: { value: '' },
    password: { value: '' },
  },
  validation: (path) => {
    required(path.email);
    email(path.email);
    required(path.password);
  },
});
```

---

# Summary

**ReFormer delivers:**

- Clean, declarative API
- Superior TypeScript support
- Fine-grained performance
- Built-in complex form patterns
- Flexible validation options
- Framework-agnostic UI

**Perfect for:**

- Large enterprise forms
- Multi-step wizards
- Dynamic form builders
- High-performance applications

---

# Next Steps

- Documentation: reformer.dev
- GitHub: github.com/anthropics/reformer
- Examples: /examples directory
- Playground: StackBlitz templates

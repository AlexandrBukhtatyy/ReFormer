---
sidebar_position: 1
---

# Simple Form

In this lesson, you'll create your first form with ReFormer. We'll build a simple registration form with two fields: name and email.

## What You'll Learn

- How to create form structure with `GroupNode` and `FieldNode`
- How to access and update form values
- How to connect the form to React components with `useFormControl`

## Creating the Form

Let's start by defining the form structure. We'll use `GroupNode` to create a container for our fields:

```typescript title="src/components/RegistrationForm/form.ts"
import { GroupNode } from 'reformer';

// Define the form data interface
interface RegistrationFormData {
  name: string;
  email: string;
}

// Create the form structure
export const registrationForm = new GroupNode<RegistrationFormData>({
  form: {
    name: { value: '' },
    email: { value: '' },
  },
});
```

### Understanding the Code

- **`GroupNode`** — a container that holds form fields and manages their state
- **Field configuration** — simple objects with `{ value: ... }` that ReFormer automatically converts to field nodes
- **`form`** — defines the structure of your form data
- **Generic type** `<RegistrationFormData>` — ensures type safety across your form

## Accessing Form Values

ReFormer provides reactive access to form values through the `value` property:

```typescript
// Get the entire form value
console.log(registrationForm.value);
// Output: { name: '', email: '' }

// Access individual field values
console.log(registrationForm.controls.name.value);
// Output: ''

// Update a field value
registrationForm.controls.name.setValue('John');

console.log(registrationForm.value);
// Output: { name: 'John', email: '' }
```

The `value` property is a **reactive signal** — it automatically updates when any field changes.

## React Integration

Now let's connect our form to a React component using the `useFormControl` hook:

```tsx title="src/components/RegistrationForm/index.tsx"
import { useFormControl } from 'reformer';
import { registrationForm } from './form';

export function RegistrationForm() {
  // Connect fields to React
  const name = useFormControl(registrationForm.controls.name);
  const email = useFormControl(registrationForm.controls.email);

  return (
    <form>
      <div>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          type="text"
          value={name.value}
          onChange={(e) => name.setValue(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email.value}
          onChange={(e) => email.setValue(e.target.value)}
        />
      </div>

      <button type="submit">Register</button>
    </form>
  );
}
```

### How It Works

1. **`useFormControl(node)`** — subscribes the component to field changes
2. When you call `setValue()`, the form state updates
3. React automatically re-renders the component with new values

## Try It Out

Type something in the name field. The value updates immediately and reactively propagates through the form.

```typescript
// The form value is always synchronized
console.log(registrationForm.value);
// Output: { name: 'John', email: '' }
```

## Key Concepts

- **`GroupNode`** — container for form fields
- **Field configuration** — simple `{ value: ... }` objects that become reactive fields
- **`value`** — reactive property containing field/form data
- **`setValue()`** — method to update field value
- **`controls`** — typed access to child fields
- **`useFormControl()`** — React hook for field binding

## What's Next?

In the next lesson, we'll add **validation** to ensure the data is correct before submission.

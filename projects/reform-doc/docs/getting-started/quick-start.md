---
sidebar_position: 2
---

# Quick Start

Build a simple contact form in 5 minutes.

## 1. Define the Form

```typescript title="src/forms/contact-form.ts"
import { GroupNode, FieldNode } from 'reformer';
import { required, email, minLength } from 'reformer/validators';

export const createContactForm = () =>
  new GroupNode({
    schema: {
      name: new FieldNode({ value: '' }),
      email: new FieldNode({ value: '' }),
      message: new FieldNode({ value: '' }),
    },
    validationSchema: (path, { validate }) => [
      validate(path.name, required(), minLength(2)),
      validate(path.email, required(), email()),
      validate(path.message, required(), minLength(10)),
    ],
  });

export type ContactForm = ReturnType<typeof createContactForm>;
```

## 2. Create React Component

```tsx title="src/components/ContactForm.tsx"
import { useFormControl } from 'reformer';
import { createContactForm, ContactForm } from '../forms/contact-form';

const form = createContactForm();

export function ContactForm() {
  const name = useFormControl(form.controls.name);
  const email = useFormControl(form.controls.email);
  const message = useFormControl(form.controls.message);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.markAllAsTouched();

    if (form.valid) {
      console.log('Submit:', form.value);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <input
          value={name.value}
          onChange={(e) => name.setValue(e.target.value)}
          placeholder="Name"
        />
        {name.touched && name.errors?.required && (
          <span>Name is required</span>
        )}
      </div>

      <div>
        <input
          value={email.value}
          onChange={(e) => email.setValue(e.target.value)}
          placeholder="Email"
        />
        {email.touched && email.errors?.email && (
          <span>Invalid email</span>
        )}
      </div>

      <div>
        <textarea
          value={message.value}
          onChange={(e) => message.setValue(e.target.value)}
          placeholder="Message"
        />
        {message.touched && message.errors?.minLength && (
          <span>Message must be at least 10 characters</span>
        )}
      </div>

      <button type="submit" disabled={!form.valid}>
        Send
      </button>
    </form>
  );
}
```

## 3. Key Concepts Used

| Concept | Description |
|---------|-------------|
| `GroupNode` | Container for form fields |
| `FieldNode` | Single form field with value |
| `validationSchema` | Declarative validation rules |
| `useFormControl` | React hook for field binding |
| `markAllAsTouched()` | Show all validation errors |

## Next Steps

- [Core Concepts](/docs/core-concepts/nodes) — Learn about Nodes in depth
- [Validation](/docs/validation/overview) — All built-in validators
- [Behaviors](/docs/behaviors/overview) — Computed fields and conditional logic

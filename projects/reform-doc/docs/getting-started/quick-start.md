---
sidebar_position: 2
---

# Quick Start

Build a simple contact form in 5 minutes.

## 1. Define the Form

```typescript title="src/forms/contact-form.ts"
import { GroupNode } from 'reformer';
import { required, email, minLength } from 'reformer/validators';

export const createContactForm = () =>
  new GroupNode({
    form: {
      name: { value: '' },
      email: { value: '' },
      message: { value: '' },
    },
    validation: (path) => {
      required(path.name);
      minLength(path.name, 2);
      required(path.email);
      email(path.email);
      required(path.message);
      minLength(path.message, 10);
    },
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
        {name.touched && name.errors?.required && <span>Name is required</span>}
      </div>

      <div>
        <input
          value={email.value}
          onChange={(e) => email.setValue(e.target.value)}
          placeholder="Email"
        />
        {email.touched && email.errors?.email && <span>Invalid email</span>}
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

## Next Steps

- [Core Concepts](/docs/core-concepts/nodes) — Learn about Nodes in depth
- [Validation](/docs/validation/overview) — All built-in validators
- [Behaviors](/docs/behaviors/overview) — Computed fields and conditional logic

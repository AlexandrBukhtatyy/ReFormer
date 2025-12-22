## 1.5 QUICK START - Minimal Working Form

```typescript
import { createForm, useFormControl } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import type { FormProxy } from '@reformer/core';

// 1. Define form type
interface ContactForm {
  name: string;
  email: string;
}

// 2. Create form schema with validation
const form = createForm<ContactForm>({
  form: {
    name: { value: '', component: Input },
    email: { value: '', component: Input },
  },
  validation: (path) => {
    required(path.name, { message: 'Name is required' });
    required(path.email, { message: 'Email is required' });
    email(path.email, { message: 'Invalid email format' });
  },
});

// 3. Use in React component
function ContactFormComponent() {
  const nameCtrl = useFormControl(form.name);
  const emailCtrl = useFormControl(form.email);

  const handleSubmit = async () => {
    await form.submit((values) => {
      console.log('Form submitted:', values);
    });
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <div>
        <input
          value={nameCtrl.value}
          onChange={(e) => form.name.setValue(e.target.value)}
          disabled={nameCtrl.disabled}
        />
        {nameCtrl.errors.map((err) => <span key={err.code}>{err.message}</span>)}
      </div>
      <div>
        <input
          value={emailCtrl.value}
          onChange={(e) => form.email.setValue(e.target.value)}
          disabled={emailCtrl.disabled}
        />
        {emailCtrl.errors.map((err) => <span key={err.code}>{err.message}</span>)}
      </div>
      <button type="submit">Send</button>
    </form>
  );
}

// 4. Pass form to child components via props (NOT context!)
interface FormStepProps {
  form: FormProxy<ContactForm>;
}

function FormStep({ form }: FormStepProps) {
  // Access form fields directly
  const { value } = useFormControl(form.name);
  return <div>Name: {value}</div>;
}
```

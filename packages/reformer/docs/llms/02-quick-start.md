## 1.5 QUICK START - Minimal Working Form

> **Schema-driven UI rule (read first)**: компонент И его пропсы (label, placeholder,
> options, type) объявляются в **схеме поля** (`component` + `componentProps`).
> В JSX рендерится один универсальный `<FormField control={form.x} />` из
> `@reformer/ui-kit` БЕЗ дополнительных props. Не пиши свои `Input`/`Select`/
> `Checkbox`-обёртки с `label`-prop'ами — это anti-pattern. См.
> `find_recipe(package="@reformer/ui-kit", topic="form-field-integration")`.

```typescript
import { createForm, type FormProxy, type FormSchema } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import { FormField, Input, Button } from '@reformer/ui-kit';

// 1. Define form type as `type` alias (not `interface` — see Recipe 2)
type ContactForm = {
  name: string;
  email: string;
};

// 2. Schema: component + componentProps decl in fields, no JSX label props
const form = createForm<ContactForm>({
  form: {
    name: {
      value: '',
      component: Input,
      componentProps: { label: 'Name', placeholder: 'Your name' },
    },
    email: {
      value: '',
      component: Input,
      componentProps: { label: 'Email', type: 'email' },
    },
  } satisfies FormSchema<ContactForm>,
  validation: (path) => {
    required(path.name, { message: 'Name is required' });
    required(path.email, { message: 'Email is required' });
    email(path.email, { message: 'Invalid email format' });
  },
});

// 3. Use in React component — thin JSX, FormField does ALL heavy lifting
function ContactFormComponent() {
  const handleSubmit = async () => {
    await form.submit((values: ContactForm) => {
      console.log('Form submitted:', values);
    });
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <FormField control={form.name} testId="name" />
      <FormField control={form.email} testId="email" />
      <Button type="submit">Send</Button>
    </form>
  );
}

// 4. Pass form to child components via props (NOT context!)
type FormStepProps = {
  form: FormProxy<ContactForm>;
};

function FormStep({ form }: FormStepProps) {
  return <FormField control={form.name} testId="name" />;
}
```

### When to write your own field components (advanced — rare)

Свои компоненты нужны ТОЛЬКО если:

- ты намеренно избегаешь `@reformer/ui-kit` (например, проект уже имеет свою design system)
- нужен особый низкоуровневый input, который не покрывается `FormField` + `componentProps`

В этом случае см. секцию `## 14.5 UI COMPONENT PATTERNS` ниже — но даже там
паттерн **schema-driven** (label/options не из JSX-props, а из `componentProps` через
`useFormControl(...).componentProps`).

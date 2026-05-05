## 14.5 UI COMPONENT PATTERNS

> **Default rule (read first)**: для UI используй `FormField` из
> [`@reformer/ui-kit`](../../reformer-ui-kit/) — он покрывает 95% случаев одной
> строкой `<FormField control={form.x} />`. Свои field-обёртки пиши ТОЛЬКО если
> ui-kit не подходит (другая design system, особый low-level input).
>
> Канонический schema-driven подход:
> - **компонент** объявляется в схеме как `component: Input` (или `Select`, `Checkbox`, etc.)
> - **пропсы** компонента — в `componentProps: { label, placeholder, options, type, ... }`
> - **JSX рендерит**: `<FormField control={form.x} />` БЕЗ дополнительных props
>
> См. `find_recipe(package="@reformer/ui-kit", topic="form-field-integration")`
> для полного руководства.

### Default — FormField из ui-kit (canonical)

```tsx
import { useMemo } from 'react';
import { createForm, type FormSchema } from '@reformer/core';
import { FormField, Input, Select, Checkbox, Button } from '@reformer/ui-kit';

type RegistrationForm = {
  email: string;
  country: string;
  agree: boolean;
};

function RegistrationPage() {
  const form = useMemo(() =>
    createForm<RegistrationForm>({
      form: {
        email: {
          value: '',
          component: Input,
          componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
        },
        country: {
          value: 'ru',
          component: Select,
          componentProps: {
            label: 'Country',
            options: [
              { value: 'ru', label: 'Россия' },
              { value: 'by', label: 'Беларусь' },
            ],
          },
        },
        agree: {
          value: false,
          component: Checkbox,
          componentProps: { label: 'I agree to terms' },
        },
      } satisfies FormSchema<RegistrationForm>,
    }),
    []
  );

  return (
    <form>
      <FormField control={form.email} testId="email" />
      <FormField control={form.country} testId="country" />
      <FormField control={form.agree} testId="agree" />
      <Button type="submit">Register</Button>
    </form>
  );
}
```

`FormField` сам читает `componentProps.label`, `componentProps.placeholder`,
`componentProps.options` через `useFormControl(...).componentProps` и применяет
их к нужному `<input>`/`<select>`/etc. Error rendering, `pending` для async-валидаций,
`data-testid` для e2e — всё из коробки.

### Anti-patterns (не делай так)

❌ **Свои field-компоненты с label-prop'ами в JSX**:
```tsx
// WRONG — дублирует логику FormField, ломает schema-driven архитектуру
<Input control={form.email} label="Email" placeholder="..." />
<Select control={form.country} options={[...]} />
```

❌ **Передача компонент-пропсов через JSX вместо схемы**:
```tsx
// WRONG — нарушает single source of truth (схема)
<FormField control={form.email} label="Email" />
```

✅ Всё это в схеме:
```ts
{ email: { component: Input, componentProps: { label: 'Email' } } }
```

```tsx
<FormField control={form.email} />
```

### Advanced — кастомный input через `children` slot

Когда нужен низкоуровневый input, которого нет в ui-kit (маска, особый combobox):

```tsx
import { FormField } from '@reformer/ui-kit';
import { InputMask } from 'react-input-mask';

<FormField control={form.phone} testId="phone">
  <InputMask mask="+7 (999) 999-99-99" />
</FormField>
```

`children` оборачивается в `CdkFormField.Control asChild` и получает все нужные
props (`value`, `onChange`, `onBlur`, `aria-invalid`).

### Advanced — write your own from scratch (rare)

Если ты не хочешь подключать `@reformer/ui-kit`, пиши свои компоненты на основе
`useFormControl` — но **сохраняй schema-driven подход**: читай label/placeholder
из `componentProps`, не из JSX-props.

```tsx
import type { FieldNode } from '@reformer/core';
import { useFormControl } from '@reformer/core';

type MyFormFieldProps<T> = { control: FieldNode<T> };  // ← ОДИН prop

function MyFormField<T>({ control }: MyFormFieldProps<T>) {
  const { value, errors, disabled, shouldShowError, componentProps } = useFormControl(control);
  // componentProps = { label, placeholder, type, options, ... } — из СХЕМЫ
  const cp = (componentProps ?? {}) as Record<string, unknown>;

  return (
    <label>
      {cp.label && <span>{cp.label as string}</span>}
      <input
        type={(cp.type as string) ?? 'text'}
        value={(value ?? '') as string}
        placeholder={cp.placeholder as string | undefined}
        disabled={disabled}
        onChange={(e) => (control.setValue as (v: unknown) => void)(e.target.value)}
        onBlur={() => control.markAsTouched()}
      />
      {shouldShowError && errors[0] && <span>{errors[0].message}</span>}
    </label>
  );
}
```

Использование — как у `FormField`:

```tsx
<MyFormField control={form.email} />  // ← без label-prop
```

### Integration with UI libraries (shadcn etc.)

Если есть существующая design system — оборачивай её компоненты в один
`MyFormField` (как выше) и используй один прop `control`. Не множь обёртки на
тип input'а — пусть `componentProps.type` диспатчит внутри.

```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function ShadcnFormField({ control }: { control: FieldNode<string> }) {
  const { value, errors, disabled, componentProps } = useFormControl(control);
  const cp = (componentProps ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-2">
      {cp.label && <Label>{cp.label as string}</Label>}
      <Input
        value={(value ?? '') as string}
        onChange={(e) => control.setValue(e.target.value)}
        disabled={disabled}
      />
      {errors[0] && <p className="text-red-500">{errors[0].message}</p>}
    </div>
  );
}
```

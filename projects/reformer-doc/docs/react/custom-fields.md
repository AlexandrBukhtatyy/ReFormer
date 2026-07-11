---
sidebar_position: 3
---

# Свои компоненты полей

Готовые поля живут в [`@reformer/ui-kit`](../packages/ui-kit): `<FormField control={form.x} />`
закрывает почти все случаи одной строкой. Свои field-компоненты пишут, **только когда ui-kit не
подходит** — другая design-система, особый low-level input (маска, комбобокс). При этом остаётся в
силе главный принцип M1: поле **schema-driven**.

:::tip Сначала попробуйте ui-kit
Если не нужен собственный набор компонентов — используйте `FormField` из `@reformer/ui-kit`. Он сам
читает `componentProps`, показывает ошибки и `pending`, проставляет `data-testid`. Свои обёртки
нужны редко.
:::

## Ключевой принцип: пропсы — из схемы

`label`, `placeholder`, `type`, `options` объявляются в **схеме поля** (`componentProps`) и
читаются в компоненте через `useFormControl(control).componentProps`. В JSX компонент получает
**один** prop — `control`.

```ts
// В схеме — источник истины для пропсов компонента
{
  email: {
    value: model.$.email,
    component: MyInput,
    componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
  },
}
```

```tsx
// В разметке — только control, без label/placeholder-пропсов
<MyFormField control={form.email} />
```

## Универсальная обёртка

Одна обёртка на `useFormControl` читает значение, состояние ошибок и `componentProps`, а тип поля
берёт из `componentProps.type`. Не плодите обёртки под каждый тип input — пусть одна диспатчит
внутри.

```tsx
import { useFormControl } from '@reformer/core';
import type { FieldNode } from '@reformer/core';

type MyFormFieldProps<T> = { control: FieldNode<T> }; // ← один prop

export function MyFormField<T>({ control }: MyFormFieldProps<T>) {
  const { value, errors, disabled, shouldShowError, componentProps } = useFormControl(control);
  const cp = componentProps as {
    label?: string;
    placeholder?: string;
    type?: string;
  };

  return (
    <label className="field">
      {cp.label && <span>{cp.label}</span>}
      <input
        type={cp.type ?? 'text'}
        value={(value ?? '') as string}
        placeholder={cp.placeholder}
        disabled={disabled}
        onChange={(e) => (control.setValue as (v: unknown) => void)(e.target.value)}
        onBlur={() => control.markAsTouched()}
      />
      {shouldShowError && errors[0] && <span className="error">{errors[0].message}</span>}
    </label>
  );
}
```

Три обязательных детали:

- **значение** читается из `value`, а не из внешнего state;
- **запись** — через `control.setValue(...)`, отметка взаимодействия — `control.markAsTouched()`
  на `onBlur` (после этого `shouldShowError` станет `true`, если поле невалидно —
  `shouldShowError = touched && invalid`);
- **null-safe** рендер: `value ?? ''`, чтобы input не стал неуправляемым.

## Конкретный компонент: Select

Компонент под конкретный тип строится так же — данные-опции берутся из
`componentProps.options`, а не из JSX-пропса.

```tsx
import { useFormControl } from '@reformer/core';
import type { FieldNode } from '@reformer/core';

type Option = { value: string; label: string };

export function MySelect({ control }: { control: FieldNode<string> }) {
  const { value, disabled, errors, shouldShowError, componentProps } = useFormControl(control);
  const cp = componentProps as { label?: string; options?: Option[] };
  const options = cp.options ?? [];

  return (
    <label className="field">
      {cp.label && <span>{cp.label}</span>}
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
      >
        <option value="">Выберите…</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {shouldShowError && errors[0] && <span className="error">{errors[0].message}</span>}
    </label>
  );
}
```

Привязка — в схеме; опции обновляются реактивно через `control.updateComponentProps({ options })`
(например, после асинхронной загрузки из behavior):

```ts
{
  country: {
    value: model.$.country,
    component: MySelect,
    componentProps: {
      label: 'Страна',
      options: [
        { value: 'ru', label: 'Россия' },
        { value: 'by', label: 'Беларусь' },
      ],
    },
  },
}
```

## Анти-паттерны

:::warning Не передавайте пропсы поля через JSX
Пропсы компонента задаёт **схема**, а не разметка. JSX-пропсы дублируют логику и ломают
single-source-of-truth.

```tsx
// ❌ пропсы в JSX — мимо схемы
<MyFormField control={form.email} label="Email" placeholder="…" />
<MySelect control={form.country} options={[...]} />

// ✅ всё в схеме, в JSX — только control
<MyFormField control={form.email} />
<MySelect control={form.country} />
```

:::

## Интеграция с готовой design-системой

Если уже есть свой набор компонентов (shadcn, MUI и т.п.) — оберните его в **один**
`MyFormField` с одним пропом `control`, а тип input'а диспатчьте по `componentProps.type` внутри.
Так вся форма остаётся schema-driven, а разметка — единообразной.

## Дальше

- [React-хуки](./hooks) — полный разбор `useFormControl` и `useFormControlValue`.
- [Схема формы](../core-concepts/schemas/form-schema) — где объявляются `component` и `componentProps`.
- [Ноды и proxy](../core-concepts/nodes) — методы ноды: `setValue`, `markAsTouched`, `updateComponentProps`.

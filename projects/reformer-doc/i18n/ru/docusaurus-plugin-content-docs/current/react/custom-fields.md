---
sidebar_position: 3
---

# Свои компоненты полей

Готовые поля живут в [`@reformer/ui-kit`](../ui-kit/overview): `<FormField control={form.x} />`
закрывает почти все случаи одной строкой. Свои компоненты полей пишут, **только когда ui-kit не
подходит** — другая design-система, особый low-level input (маска, комбобокс). При этом остаётся в
силе главный принцип: поле **описывается схемой**.

:::tip Сначала попробуйте ui-kit
Если не нужен собственный набор компонентов — используйте `FormField` из `@reformer/ui-kit`. Он сам
читает `componentProps`, показывает замечания и `pending`, проставляет `data-testid`. Свои обёртки
нужны редко.
:::

## Ключевой принцип: пропсы — из схемы

`label`, `placeholder`, `type`, `options` объявляются в **узле схемы** (`componentProps`) и
читаются в компоненте через `useFormControl(control).componentProps`. В JSX компонент получает
**один** prop — `control`.

```ts
// В узле схемы — источник истины для пропсов компонента
{
  model: model.$.email,
  component: MyFormField,
  componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
}
```

```tsx
// В разметке — только control, без label/placeholder-пропсов
<MyFormField control={form.email} />
```

## Универсальная обёртка

Одна обёртка на `useFormControl` читает значение, замечания и `componentProps`, а тип поля берёт из
`componentProps.type`. Не плодите обёртки под каждый тип input — пусть одна диспатчит внутри.

```tsx
import { useFormControl } from '@reformer/core/react';
import { useIssueMessageResolver } from '@reformer/cdk';
import type { FormControl } from '@reformer/core';

type MyFormFieldProps<T> = { control: FormControl<T> }; // ← один prop

export function MyFormField<T>({ control }: MyFormFieldProps<T>) {
  const { value, issues, disabled, shouldShowError, componentProps } = useFormControl(control);
  const message = useIssueMessageResolver(); // код замечания → текст: словарь формы, затем локаль
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
      {shouldShowError && issues[0] && <span className="error">{message(issues[0])}</span>}
    </label>
  );
}
```

Четыре обязательных детали:

- **значение** читается из `value`, а не из внешнего state;
- **запись** — через `control.setValue(...)`, отметка взаимодействия — `control.markAsTouched()`
  на `onBlur` (после этого `shouldShowError` станет `true`, если у поля есть блокирующие замечания);
- **null-safe** рендер: `value ?? ''`, чтобы input не стал неуправляемым;
- **текст замечания** — по его коду: в замечании (`{ code, params?, severity? }`) текста нет.
  Резолвер `useIssueMessageResolver()` из `@reformer/cdk` берёт словарь формы от
  `ValidationMessagesProvider messages`, затем словарь локали; без cdk —
  `useIssueMessage(messages)` из `@reformer/core/react`.

## Конкретный компонент: Select

Компонент под конкретный тип строится так же — данные-опции берутся из
`componentProps.options`, а не из JSX-пропса.

```tsx
import { useFormControl } from '@reformer/core/react';
import { useIssueMessageResolver } from '@reformer/cdk';
import type { FormControl } from '@reformer/core';

type Option = { value: string; label: string };

export function MySelect({ control }: { control: FormControl<string> }) {
  const { value, disabled, issues, shouldShowError, componentProps } = useFormControl(control);
  const message = useIssueMessageResolver();
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
      {shouldShowError && issues[0] && <span className="error">{message(issues[0])}</span>}
    </label>
  );
}
```

Привязка — в узле схемы; опции обновляются реактивно через
`control.updateComponentProps({ options })` (например, после асинхронной загрузки в поведении):

```ts
{
  model: model.$.country,
  component: MySelect,
  componentProps: {
    label: 'Страна',
    options: [
      { value: 'ru', label: 'Россия' },
      { value: 'by', label: 'Беларусь' },
    ],
  },
}
```

## Анти-паттерны

:::warning Не передавайте пропсы поля через JSX
Пропсы компонента задаёт **схема**, а не разметка. JSX-пропсы дублируют логику и ломают единый
источник истины.

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

Если уже есть свой набор компонентов (shadcn, MUI и т.п.), есть два пути.

**Отдать контрол обёртке поля.** Объявите компоненту его диалект статикой — и кладите его в
`component` поля как есть: связывание с полем (значение, `onChange`, `onBlur`, `disabled`,
`aria-*`) выполнит `FormField` (`FormField.Control` из `@reformer/cdk`) или рендерер. Отдельная
«field-обёртка» под каждый контрол не нужна:

```tsx
import { defineFieldControl, checkedAdapter } from '@reformer/ui-kit/fields';
import { Checkbox } from '@/components/ui/checkbox';

// Checkbox говорит на checked / onCheckedChange — адаптер сводит его к значению поля.
export const FormCheckbox = defineFieldControl(Checkbox, { adapter: checkedAdapter });

// узел схемы: { model: model.$.agree, component: FormCheckbox, componentProps: { label: 'Согласен' } }
```

Для компонентов, на которые статику не повесить, при рендере через `@reformer/renderer-react`
диалект задаёт `settings.resolveFieldAdapter`.

**Своя обёртка поля.** Если нужна собственная разметка label/error — оберните набор в **один**
`MyFormField` с одним пропом `control`, а тип input'а диспатчьте по `componentProps.type` внутри.
Так вся форма остаётся описанной схемой, а разметка — единообразной.

## Дальше

- [React-хуки](./hooks) — полный разбор `useFormControl` и `useFormControlValue`.
- [Схема формы](../core-concepts/schemas/form-schema) — где объявляются `component` и `componentProps`.
- [Ноды формы](../core-concepts/nodes) — методы ноды: `setValue`, `markAsTouched`, `updateComponentProps`.

# FormField integration

`FormField` из `@reformer/ui-kit` — это готовая обёртка-«склейка» поверх
headless-компонента `FormField` из [`@reformer/cdk`](../../../reformer-cdk/).
Она автоматически рендерит `Label` → `Control` → `Error`, читает `pending`-флаг
для async-валидаций и подставляет `data-testid` для e2e.

В отличие от headless-`FormField` из CDK (нужно вручную собирать `Root` /
`Label` / `Control` / `Error`), ui-kit-вариант — однострочный:

```tsx
<FormField control={form.email} testId="email" />
```

Где-то под капотом разворачивается:

```tsx
<CdkFormField.Root control={control}>
  <div className={className} data-testid={`field-${testId}`}>
    {!isCheckbox && <CdkFormField.Label data-testid={`label-${testId}`} />}
    <CdkFormField.Control data-testid={`input-${testId}`} />
    <CdkFormField.Error data-testid={`error-${testId}`} />
    {pending && <span>Проверка...</span>}
  </div>
</CdkFormField.Root>
```

`Control` сам инстанцирует `control.component` (`Input`, `Select`, `Checkbox`...)
и прокидывает `value`/`onChange`/`onBlur`/`error` из `FieldNode` без
дополнительного кода.

## API

```typescript
interface FormFieldProps {
  control: FieldNode<any>;
  className?: string;
  testId?: string;
  /** Кастомный input — для использования с RenderSchema fieldWrapper */
  children?: React.ReactNode;
}
```

| Prop        | Тип            | Описание                                                                                                                                                     |
| ----------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `control`   | `FieldNode<T>` | Поле формы. Из него берутся `component`, `componentProps`, `value`, `error`, `pending`, `setValue`, `blur`.                                                  |
| `className` | `string`       | Класс корневой `<div>`-обёртки.                                                                                                                              |
| `testId`    | `string`       | Префикс для `data-testid` (`field-<id>`, `label-<id>`, `input-<id>`, `error-<id>`). Если опущен — пытается взять `componentProps.testId`. Иначе `'unknown'`. |
| `children`  | `ReactNode`    | Кастомный контрол: оборачивается в `CdkFormField.Control asChild`. См. сценарий 3.                                                                           |

`FormField` обёрнут в `React.memo` со сравнением по ссылочному равенству
`control` — это критично для производительности больших форм (при ререндере
родителя поле не пересчитывается, пока не сменился сам `FieldNode`).

## Common Patterns

### 1. Standalone

Самый частый сценарий: ручная форма с `FormField`-ами для каждого поля.

```tsx
import { useMemo } from 'react';
import { createModel, createForm } from '@reformer/core';
import { Button, FormField, Input, Select } from '@reformer/ui-kit';

type RegistrationForm = {
  email: string;
  country: string;
};

function RegistrationPage() {
  const form = useMemo(() => {
    const model = createModel<RegistrationForm>({ email: '', country: '' });
    const schema = {
      children: [
        {
          value: model.$.email,
          component: Input,
          componentProps: { label: 'Email', placeholder: 'you@example.com', testId: 'email' },
        },
        {
          value: model.$.country,
          component: Select,
          componentProps: {
            label: 'Страна',
            testId: 'country',
            options: [
              { value: 'ru', label: 'Россия' },
              { value: 'by', label: 'Беларусь' },
            ],
          },
        },
      ],
    };
    return createForm<RegistrationForm>({ model, schema });
  }, []);

  return (
    <form className="space-y-4">
      <FormField control={form.email} testId="email" />
      <FormField control={form.country} testId="country" />
      <Button type="submit">Регистрация</Button>
    </form>
  );
}
```

`Label` берётся из `componentProps.label` через `CdkFormField.Label`. `error`
автоматически появляется под полем после `validate()` или `blur()`.

### 2. Как `fieldWrapper` в `FormRenderer`

В `@reformer/renderer-react` каждый field-узел `RenderSchema` оборачивается в
указанный `fieldWrapper`. `FormField` из ui-kit идеально подходит для этой
роли — он использует тот же контракт `FieldNode`, что и сам рендерер.

```tsx
import { useMemo } from 'react';
import { createForm } from '@reformer/core';
import { FormRenderer, createRenderSchema } from '@reformer/renderer-react';
import { FormField, Input, Section } from '@reformer/ui-kit';
import { createCreditApplicationModel } from './schemas/model';

function CreditApplicationPage() {
  const { form, schema } = useMemo(() => {
    // M1: модель — источник истины; листья схемы ссылаются на её сигналы.
    const model = createCreditApplicationModel();
    const schema = createRenderSchema<CreditApplication>(() => ({
      component: Section,
      componentProps: { title: 'Заявка', className: 'space-y-4' },
      children: [
        { value: model.$.email, component: Input, componentProps: { testId: 'email' } },
        { value: model.$.phone, component: Input, componentProps: { testId: 'phone' } },
        { value: model.$.amount, component: Input, componentProps: { testId: 'amount' } },
      ],
    }));
    const form = createForm<CreditApplication>({ model, schema });
    return { form, schema };
  }, []);

  // settings.fieldWrapper применяется к каждому field-узлу автоматически.
  return <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />;
}
```

`testId` рендерер берёт из `componentProps.testId` листа schema:

```tsx
{ value: itemModel.$.bank, component: Input, componentProps: { testId: 'existingLoan-bank' } }
// → <FormField control={...} testId="existingLoan-bank" />
// → data-testid="field-existingLoan-bank", "input-existingLoan-bank", ...
```

### 3. Кастомизация через `children`

Для случаев, когда нужен нестандартный контрол (например, маска, которая не
зарегистрирована в `control.component`, или комбинированный input). `children`
оборачивается в `CdkFormField.Control asChild`, и в кастомный input
прокидываются все нужные props (`value`, `onChange`, `onBlur`, `aria-invalid`).

```tsx
import { FormField } from '@reformer/ui-kit';
import { InputMask } from '@reformer/ui-kit/input-mask';

<FormField control={form.phone} testId="phone">
  <InputMask mask="+7 (999) 999-99-99" />
</FormField>;
```

> Важно: кастомный child должен быть единичным React-элементом и принимать
> `value`/`onChange`/`onBlur`/`aria-invalid` (см. контракт ui-kit-полей). Для
> сложных случаев — двух input-ов рядом — используй `CdkFormField.Root` напрямую,
> минуя ui-kit-обёртку.

### 4. Checkbox-исключение

`Checkbox` сам рендерит `label` рядом с собственным контролом. Если бы
`FormField` ставил `Label` сверху, мы получили бы дубль:

```
Условия использования       <-- FormField.Label (нежелательно)
[ ] Условия использования    <-- сам Checkbox
```

Поэтому `FormField` детектит `control.component === Checkbox` и не рендерит
верхний `Label`:

```tsx
import { createModel, createForm } from '@reformer/core';
import { Checkbox, FormField } from '@reformer/ui-kit';

const model = createModel<{ accept: boolean }>({ accept: false });
const schema = {
  children: [
    {
      value: model.$.accept,
      component: Checkbox,
      componentProps: { label: 'Принимаю условия' },
    },
  ],
};
const form = createForm<{ accept: boolean }>({ model, schema });

<FormField control={form.accept} testId="accept" />;
// рендерится только Checkbox с label справа + error снизу.
```

Проверка идёт по `===`, поэтому если ты сам реэкспортируешь `Checkbox` через
обёртку — детектор не сработает. Решения:

- Использовать оригинальный `Checkbox` из `@reformer/ui-kit`.
- Либо вручную скрывать label через `componentProps.label = undefined` и
  оборачивать обвязку самостоятельно.

## Anti-patterns

- Передавать `control` другого типа (`FormProxy`, `ArrayNode`) — ожидается
  именно `FieldNode<T>`. Для массивов используй `FormArray.Root` из CDK; для
  groups — отдельные `FormField` на каждое лиственное поле.
- Динамически менять `control` (`<FormField control={isAdvanced ? form.x : form.y} />`)
  — `React.memo` не пересоздаст внутренний `Root`, но сам `Root` сменит контекст,
  что может привести к лишнему re-mount контрола. Предпочтительно условно
  рендерить два разных `FormField`.
- Перекрывать `componentProps.testId` через атрибут — побеждает явный
  `testId`-prop `FormField`, поэтому смесь даёт неожиданный результат. Выбирай
  один источник.
- Использовать `FormField` для чисто декоративных компонентов (заголовков,
  баннеров) — обёртка ставит `Label` и слот ошибки, что нелогично. Для такого
  рендерь компоненты напрямую (через container-узлы `Box`/`Section`).

## See also

- [02-text-fields.md](02-text-fields.md), [03-choice-fields.md](03-choice-fields.md) — компоненты, которые `FormField` оборачивает.
- [04-layout-and-buttons.md](04-layout-and-buttons.md) — `Button` для submit/prev/next.
- [06-troubleshooting.md](06-troubleshooting.md) — «label дублируется», «error не появляется», «FormField не подцепляет ошибки».
- CDK-хуки: [@reformer/cdk/form-field](../../../reformer-cdk/docs/llms/) (`FormField.Root`, `useFormFieldContext`).

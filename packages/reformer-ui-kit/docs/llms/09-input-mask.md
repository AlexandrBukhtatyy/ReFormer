# InputMask — поля с маской ввода

`InputMask` из `@reformer/ui-kit` — input с placeholder-маской: символ `'9'` означает
«цифра», остальные символы (`+`, `-`, `(`, `)`, пробел, точка) — литералы для подсказки
формата в placeholder.

> **Важно**: автоматическая вставка литералов **не** выполняется (это lightweight mask,
> не full input-mask библиотека). Маска используется как visual hint в placeholder.
> Для строгой маски с формат-вставкой используй `react-input-mask` или `imask`
> через `<FormField><CustomMask /></FormField>` pattern (см. секцию ниже).

## Schema-driven (canonical pattern)

Канон M1: `createModel` → схема, где лист = `{ value: model.$.field, component,
componentProps, validators }` → `createForm({ model, schema })`. Объяви InputMask
как `component` листа; передай `mask` в `componentProps`:

```ts
import { createModel, createForm } from '@reformer/core';
import { required, pattern } from '@reformer/core/validators';
import { InputMask } from '@reformer/ui-kit';

type ContactForm = {
  phone: string;
  passport: string;
  inn: string;
  snils: string;
};

const model = createModel<ContactForm>({ phone: '', passport: '', inn: '', snils: '' });

const schema = {
  children: [
    {
      value: model.$.phone,
      component: InputMask,
      componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99', testId: 'phone' },
      validators: [
        required({ message: 'Телефон обязателен' }),
        pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { message: 'Неверный формат телефона' }),
      ],
    },
    {
      value: model.$.passport,
      component: InputMask,
      componentProps: { label: 'Серия и номер паспорта', mask: '9999 999999', testId: 'passport' },
      validators: [required()],
    },
    {
      value: model.$.inn,
      component: InputMask,
      componentProps: { label: 'ИНН', mask: '999999999999', testId: 'inn' },
      validators: [required(), pattern(/^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' })],
    },
    {
      value: model.$.snils,
      component: InputMask,
      componentProps: { label: 'СНИЛС', mask: '999-999-999 99', testId: 'snils' },
      validators: [required()],
    },
  ],
};

const form = createForm<ContactForm>({ model, schema });
```

Render как обычно через `FormField`:

```tsx
import { FormField } from '@reformer/ui-kit';

<FormField control={form.phone} testId="phone" />
<FormField control={form.passport} testId="passport" />
<FormField control={form.inn} testId="inn" />
<FormField control={form.snils} testId="snils" />
```

## Common masks

| Поле                 | Маска                 | Пример вывода         |
| -------------------- | --------------------- | --------------------- |
| Телефон РФ           | `+7 (999) 999-99-99`  | `+7 (495) 123-45-67`  |
| Серия+номер паспорта | `9999 999999`         | `4501 123456`         |
| Серия паспорта       | `99 99`               | `45 01`               |
| Номер паспорта       | `999999`              | `123456`              |
| Код подразделения    | `999-999`             | `770-001`             |
| ИНН (физлицо)        | `999999999999`        | `771234567890`        |
| ИНН (юрлицо)         | `9999999999`          | `7712345678`          |
| СНИЛС                | `999-999-999 99`      | `123-456-789 01`      |
| Почтовый индекс      | `999999`              | `123456`              |
| Дата (DD.MM.YYYY)    | `99.99.9999`          | `15.05.1990`          |
| Карта                | `9999 9999 9999 9999` | `4111 1111 1111 1111` |

## Validation

`InputMask` пишет в значение **то, что ввёл пользователь** (с literal-символами маски).
Валидаторы — фабрики из `@reformer/core/validators` — кладутся в массив `validators`
листа схемы (см. схему выше), а не в отдельную path-функцию. Прогоняются через
`validateFormModel(model, schema)`:

- `required({ message })` — на пустоту;
- `minLength(18)` — для проверки длины с literal-символами (телефон ровно 18 символов);
- `pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { message })` — точный формат.

```ts
import { validateFormModel } from '@reformer/core';

// schema — из блока Schema-driven выше (валидаторы уже на листьях phone/inn/…).
const onSubmit = async () => {
  form.markAsTouched();
  const res = await validateFormModel(model, schema);
  if (!res.valid) return;
  await api.submit(model.get());
};
```

Cross-field правила (например, «доп. телефон отличается от основного») — это
именованные `ModelValidator<value, scope, root>` в том же массиве `validators`
(читают корень формы через третий аргумент).

## Advanced — strict mask через FormField + children slot

Если нужна автоматическая вставка literal-символов (true input-mask), используй
библиотеку типа `react-input-mask` или `imask` как кастомный child в FormField:

```tsx
import { FormField } from '@reformer/ui-kit';
import InputMask from 'react-input-mask';

<FormField control={form.phone} testId="phone">
  <InputMask mask="+7 (999) 999-99-99" maskChar="_" />
</FormField>;
```

`FormField` оборачивает child в `CdkFormField.Control asChild` и прокидывает
`value` / `onChange` / `onBlur` / `aria-invalid`. См. рецепт
[05-form-field-integration.md → Pattern 3](05-form-field-integration.md).

## See also

- [02-text-fields.md](02-text-fields.md) — обычный Input
- [05-form-field-integration.md](05-form-field-integration.md) — FormField обёртка
- [06-troubleshooting.md](06-troubleshooting.md) — «маска не вставляется автоматически» → используй `react-input-mask`

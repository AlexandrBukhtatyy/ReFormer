# InputMask — поля с маской ввода

`InputMask` из `@reformer/ui-kit` — input с placeholder-маской: символ `'9'` означает
«цифра», остальные символы (`+`, `-`, `(`, `)`, пробел, точка) — литералы для подсказки
формата в placeholder.

> **Важно**: автоматическая вставка литералов **не** выполняется (это lightweight mask,
> не full input-mask библиотека). Маска используется как visual hint в placeholder.
> Для строгой маски с формат-вставкой используй `react-input-mask` или `imask`
> через `<FormField><CustomMask /></FormField>` pattern (см. секцию ниже).

## Schema-driven (canonical pattern)

Сборка `createForm`: узел поля — `{ model: model.$.field, component, componentProps }`, правила —
отдельной `defineValidation` в поле `validation`. Объяви InputMask как `component` узла; передай
`mask` в `componentProps`:

```ts
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, pattern } from '@reformer/core/validators';
import { InputMask } from '@reformer/ui-kit';

type ContactForm = {
  phone: string;
  passport: string;
  inn: string;
  snils: string;
};

// Схема — только component/componentProps, без правил
const contactSchema = (model: FormModel<ContactForm>): FormSchemaNode => ({
  children: [
    {
      model: model.$.phone,
      component: InputMask,
      componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99', testId: 'phone' },
    },
    {
      model: model.$.passport,
      component: InputMask,
      componentProps: { label: 'Серия и номер паспорта', mask: '9999 999999', testId: 'passport' },
    },
    {
      model: model.$.inn,
      component: InputMask,
      componentProps: { label: 'ИНН', mask: '999999999999', testId: 'inn' },
    },
    {
      model: model.$.snils,
      component: InputMask,
      componentProps: { label: 'СНИЛС', mask: '999-999-999 99', testId: 'snils' },
    },
  ],
});

// Правила — отдельной validation-схемой (@reformer/core/validation); тексты — по кодам в словаре
const contactRules = defineValidation<ContactForm>(({ model }) => {
  validate(model.$.phone, [
    required({ code: 'field.required' }),
    pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { code: 'phone.pattern' }),
  ]);
  validate(model.$.passport, [required()]);
  validate(model.$.inn, [required(), pattern(/^\d{12}$/, { code: 'inn.pattern' })]);
  validate(model.$.snils, [required()]);
});

// В React: useFormBundle(createContactForm)
export const createContactForm = () =>
  createForm<ContactForm>({
    initial: { phone: '', passport: '', inn: '', snils: '' },
    schema: contactSchema,
    validation: contactRules,
  });
```

Render как обычно через `FormField`:

```tsx
import { useFormBundle } from '@reformer/core/react';
import { FormField } from '@reformer/ui-kit';

const contact = useFormBundle(createContactForm);
const { form } = contact;

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
Валидаторы — фабрики из `@reformer/core/validators` — передаются в `validate(sig, [...])`
внутри `defineValidation` (см. схему выше), а не в схему формы. Опции правила — только
`{ code?, params? }`; текст замечания берётся по коду из словаря `defineIssueMessages`
(`ValidationMessagesProvider messages` из `@reformer/cdk`):

- `required({ code: 'phone.required' })` — на пустоту;
- `minLength(18)` — для проверки длины с literal-символами (телефон ровно 18 символов);
- `pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { code: 'phone.pattern' })` — точный формат.

```ts
import { defineIssueMessages } from '@reformer/core/i18n';

export const contactMessages = defineIssueMessages({
  'field.required': 'Обязательное поле',
  'phone.pattern': 'Телефон в формате +7 (999) 999-99-99',
  'inn.pattern': 'ИНН — 12 цифр',
});

// contact — сборка createContactForm() из блока выше.
const onSubmit = async () => {
  // Один прогон всех правил: при замечаниях обработчик не зовётся, поля помечены `touched`.
  const outcome = await contact.submission.submit((values) => api.submit(values));
  if (outcome.status !== 'submitted') return;
};
```

Cross-field правила (например, «доп. телефон отличается от основного») — это
`cross(model.$.phoneAdditional, (f) => ...)` из области той же validation-схемы
(`defineValidation(({ model, cross }) => …)`): функция получает снапшот модели и читает соседние
поля напрямую.

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

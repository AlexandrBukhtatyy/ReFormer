---
sidebar_position: 4
---

# Кастомные валидаторы

Своё [правило](../reference/glossary.md) — обычная функция: получает значение поля и возвращает
[замечание](../reference/glossary.md) или `null`. Оно кладётся в тот же массив оператора
`validate`, что и встроенные фабрики.

## Когда нужно

- Проверки нет среди [встроенных валидаторов](./built-in.md): «пароль с заглавной буквой», «ИНН из
  10 цифр».
- Поле сравнивается с другим полем: «повтор пароля», «дата окончания позже даты начала».
- Одна проверка нужна в нескольких формах — её оформляют фабрикой.

## Пример

```typescript
import { createForm } from '@reformer/core';
import { defineValidation, validate } from '@reformer/core/validation';

type AgeForm = { age: number | null };

const ageValidation = defineValidation<AgeForm>(({ model }) => {
  validate(model.$.age, [
    // Пустое пропускаем: обязательность — дело required().
    (value) => (value !== null && value < 18 ? { code: 'age.adult' } : null),
  ]);
});

const ageForm = createForm<AgeForm>({ initial: { age: null }, validation: ageValidation });
const result = await ageForm.validate(); // status 'invalid', если меньше 18
```

Тип правила — `Rule<T>` из `@reformer/core/validation`:

```typescript
type Rule<T> = (value: T) => ValidationIssue | null;
```

Правило видит только значение своего поля. Текста в замечании нет: текст кода `age.adult` берётся
из словаря формы `defineIssueMessages` (см. [Тексты замечаний](./overview.mdx#тексты-замечаний)).

## Фабрика правила

Чтобы правило работало в нескольких формах, оформите его фабрикой. По примеру встроенных правил
дайте ей опции `RuleOptions` — тогда поле сможет задать свой код:

```typescript title="validators/range.ts"
import type { RuleOptions } from '@reformer/core';
import type { Rule } from '@reformer/core/validation';

export function range(min: number, max: number, options?: RuleOptions): Rule<number | null> {
  return (value) => {
    if (value === null) return null; // пустое пропускаем
    if (value < min || value > max) {
      return {
        code: options?.code ?? 'range',
        params: { min, max, actual: value, ...options?.params },
      };
    }
    return null;
  };
}
```

```typescript title="validation/messages.ts"
import { defineIssueMessages } from '@reformer/core/i18n';

// Параметры правила подставляются в шаблон.
export const formMessages = defineIssueMessages({
  range: 'Допустимо от {min} до {max}',
});
```

```typescript
validate(model.$.quantity, [required(), range(1, 100)]);
```

Одно правило — одно замечание. Сложную проверку разбейте на несколько правил: `validate` выполнит
все и соберёт замечания каждого.

```typescript
const hasUppercase = (): Rule<string> => (value) =>
  !value || /[A-Z]/.test(value) ? null : { code: 'password.uppercase' };

const hasDigit = (): Rule<string> => (value) =>
  !value || /[0-9]/.test(value) ? null : { code: 'password.digit' };

validate(model.$.password, [required(), minLength(8), hasUppercase(), hasDigit()]);
```

## Правило над несколькими полями

Правило, которому нужно другое поле, ставит оператор `cross(поле, check)`. `cross` приходит
аргументом схемы вместе с `model`. Функция `check` получает снимок значений формы, а замечание
`cross` вешает на поле из первого аргумента:

```typescript
import type { ValidationIssue } from '@reformer/core';
import { defineValidation, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';

type Stay = { checkIn: string; checkOut: string };

// Дата выезда позже даты заезда. Даты в формате YYYY-MM-DD сравниваются как строки.
const checkOutAfterCheckIn = (stay: Stay): ValidationIssue | null =>
  stay.checkIn && stay.checkOut && stay.checkOut <= stay.checkIn
    ? { code: 'checkOut.beforeCheckIn' }
    : null;

const stayValidation = defineValidation<Stay>(({ model, cross }) => {
  validate(model.$.checkIn, [required()]);
  validate(model.$.checkOut, [required()]);
  cross(model.$.checkOut, checkOutAfterCheckIn); // замечание — у даты выезда
});
```

`cross` читает снимок и за соседним полем не следит. Чтобы правило пересчитывалось при правке
`checkIn`, нужна живая стратегия или `revalidateWhen` — см.
[Стратегии валидации](./validation-strategies.md#зависимые-поля).

## Правила строки массива и группы

У схемы, подключённой к строке массива (`applyEach`) или к группе (`apply`), своя область: `model`
в ней — под-модель строки или группы, а `cross` получает снимок строки, а не всей формы.

```typescript
import { applyEach, defineValidation, validate } from '@reformer/core/validation';
import { email, required } from '@reformer/core/validators';

type EmailRow = { address: string; confirm: string };
type Contacts = { emails: EmailRow[] };

const emailRowRules = defineValidation<EmailRow>(({ model, cross }) => {
  validate(model.$.address, [required(), email()]);
  cross(model.$.confirm, (row) =>
    row.confirm !== row.address ? { code: 'email.mismatch' } : null
  );
});

const contactsValidation = defineValidation<Contacts>(({ model }) => {
  applyEach(model.$.emails, emailRowRules);
});
```

Подробнее о массивах — в [Массивах и динамических формах](../patterns/arrays.mdx).

## Предупреждение вместо ошибки

Замечание с `severity: 'warning'` показывается, но отправку не блокирует: если других замечаний
нет, проверка получает статус `valid`.

```typescript
const longerIsSafer: Rule<string> = (value) =>
  value && value.length < 12 ? { code: 'password.short', severity: 'warning' } : null;

validate(model.$.password, [required(), minLength(8), longerIsSafer]);
```

## Подводные камни

- **Возвращайте `null`, когда значение верно** — не `undefined` и не `{}`.
- **Пропускайте пустое значение.** Обязательность проверяет `required()`; иначе пустое поле получит
  два замечания.
- **Соседние поля — через `cross`.** `Rule<T>` получает только значение своего поля, а `cross`
  получает снимок формы и сам вешает замечание на нужное поле.
- **Каждому своему коду — запись в словаре.** Код без текста показывается как есть. Коды принято
  называть `<поле>.<правило>`: `password.uppercase`.
- **Параметры кладите в `params`** — их подставит шаблон текста: `{ min: 1, max: 100, actual }`.

## См. также

- [Встроенные валидаторы](./built-in.md) — готовые фабрики.
- [Асинхронная валидация](./async.mdx) — правило с запросом к серверу.
- [Обработка ошибок](./error-handling.md) — чтение и показ замечаний.

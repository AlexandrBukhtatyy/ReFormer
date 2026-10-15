---
sidebar_position: 4
---

# Кастомные валидаторы

Когда встроенных фабрик недостаточно, правило описывается обычной функцией. Кастомное правило
кладётся в тот же массив, что и встроенные фабрики — вторым аргументом оператора
`validate(handle, [rules])` внутри схемы `defineValidation`. Схема валидации живёт **отдельно** от
схемы формы: она не несёт компонентов, подключается к сборке `createForm({ validation })` и
прогоняется по требованию (`bundle.validate()`, `bundle.submission.submit(handler)`, шаг
потока).

## Контракт

Синхронное правило — функция типа `Rule<TField>`: правило видит **только значение поля** и
возвращает `ValidationIssue` (`{ code, params?, severity? }`) либо `null`, если значение валидно.

```typescript
type Rule<TField> = (value: TField) => ValidationIssue | null;
```

Текста в замечании нет: правило отдаёт код и параметры, а текст для пользователя находится по коду
в словаре формы `defineIssueMessages` или в словаре локали (см.
[Тексты замечаний](/docs/validation/overview#тексты-замечаний)). Всё, что зависит от соседних
полей, — это уже [кросс-полевая проверка](#кросс-полевые-проверки) через оператор `cross`.

Пустые значения принято пропускать — обязательность закрывает `required()`.

## Инлайн-валидатор

Простое правило можно записать прямо в массиве оператора `validate`:

```typescript
import { createForm } from '@reformer/core';
import { validate, defineValidation } from '@reformer/core/validation';

type AgeForm = { age: number | null };

const ageValidation = defineValidation<AgeForm>(({ model }) => {
  validate(model.$.age, [
    (value) => (value != null && value < 18 ? { code: 'age.mustBeAdult' } : null),
  ]);
});

const ageForm = createForm<AgeForm>({ initial: { age: null }, validation: ageValidation });

// Прогон по требованию: замечания разносятся по нодам формы.
const result = await ageForm.validate(); // result.status === 'invalid', если меньше 18
```

## Переиспользуемая фабрика

Чтобы применять правило в нескольких формах, оформите его фабрикой, возвращающей `Rule<T>`.
Каждое правило возвращает **одно** замечание — сложную проверку разбивают на несколько правил в
массиве; оператор `validate` выполняет их все и накапливает замечания:

```typescript title="validators/password.ts"
import type { Rule } from '@reformer/core/validation';

export const hasUppercase = (): Rule<string> => (value) =>
  !value || /[A-Z]/.test(value) ? null : { code: 'noUppercase' };

export const hasNumber = (): Rule<string> => (value) =>
  !value || /[0-9]/.test(value) ? null : { code: 'noNumber' };
```

```typescript
// Применение в схеме — внутри defineValidation(({ model }) => { … }):
import { validate } from '@reformer/core/validation';
import { required, minLength } from '@reformer/core/validators';
import { hasUppercase, hasNumber } from './validators/password';

validate(model.$.password, [required(), minLength(8), hasUppercase(), hasNumber()]);
```

## Валидатор с параметрами

Параметризуйте фабрику и прикладывайте данные замечания через `params` — они подставляются в текст.
По примеру встроенных правил дайте фабрике опции `RuleOptions`, чтобы поле могло задать свой код:

```typescript title="validators/range.ts"
import type { RuleOptions } from '@reformer/core';
import type { Rule } from '@reformer/core/validation';

export function range(min: number, max: number, options?: RuleOptions): Rule<number | null> {
  return (value) => {
    if (value == null) return null; // пропускаем пустое
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

// Текст своего кода — в словаре формы; параметры правила подставляются в шаблон.
export const formMessages = defineIssueMessages({
  range: 'Допустимо от {min} до {max}',
});
```

```typescript
// Внутри defineValidation(({ model }) => { … }):
import { validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { range } from './validators/range';

validate(model.$.quantity, [required(), range(1, 100)]);
```

Словарь подключают к форме провайдером `ValidationMessagesProvider messages={formMessages}` из
`@reformer/cdk` — см. [Обзор валидации](/docs/validation/overview#тексты-замечаний).

## Кросс-полевые проверки

Правило, зависящее от другого поля, — это оператор `cross(handle, check)`. Он приходит аргументом
схемы вместе с `model`: `defineValidation(({ model, cross }) => …)`. Функция `check` получает
**снимок** модели области (`model.get()`) и читает соседние поля прямо из объекта, а замечание `cross`
вешает на переданную ручку `handle` — то поле, которое должно его нести:

```typescript
import type { ValidationIssue } from '@reformer/core';
import { validate, defineValidation } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';

type PasswordForm = { password: string; confirmPassword: string };

// confirmPassword должен совпадать с password — правило читает снимок всей формы
const passwordsMatch = (f: PasswordForm): ValidationIssue | null =>
  f.confirmPassword && f.password && f.confirmPassword !== f.password
    ? { code: 'passwordMismatch' }
    : null;

const passwordValidation = defineValidation<PasswordForm>(({ model, cross }) => {
  validate(model.$.password, [required()]);
  validate(model.$.confirmPassword, [required()]);
  // замечание несёт confirmPassword — на его ручку и вешаем cross
  cross(model.$.confirmPassword, passwordsMatch);
});
```

:::tip Пересчёт зависимого поля
Прогон валидации сам по себе не реактивен. Чтобы `confirmPassword` перепроверялся при изменении
`password`, выберите живую стратегию (`validation: { rules, strategy: 'change' }`) или свяжите поля
через `revalidateWhen` в behavior. См.
[Стратегии валидации](/docs/validation/validation-strategies#зависимые-поля).
:::

## Условная валидация

Правила, действующие только в части формы, оборачиваются оператором `validateWhen(cond, cb)`. Пока
`cond()` истинно, вложенные правила активны; когда ложно — они **не выполняются**, а замечания их
полей гасятся (поле получает `setIssues([])`), так что «прятать» лишние замечания в UI не нужно:

```typescript
import { validate, validateWhen, defineValidation, type Rule } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';

type TaxForm = { country: string; taxId: string };

const isNineDigits: Rule<string> = (value) =>
  !value || /^\d{9}$/.test(value) ? null : { code: 'invalidTaxId' };

const taxValidation = defineValidation<TaxForm>(({ model }) => {
  validate(model.$.country, [required()]);
  // ИНН обязателен только для страны US; иначе правила ветки гасятся
  validateWhen(
    () => model.country === 'US',
    () => validate(model.$.taxId, [required(), isNineDigits])
  );
});
```

Условие `cond` читает значения через value-proxy модели (`model.country`), поэтому в момент прогона
учитывается актуальное состояние формы.

## Валидация строк массива

Для строк массива под-форм служит оператор `applyEach(model.$.<массив>, rowRules)`. Он проходит по
каждой строке и запускает `rowRules` — обычную схему валидации над типом элемента — в области строки:
`model` в ней — под-модель строки, а `cross` получает снимок строки, а не корня формы:

```typescript
import { applyEach, defineValidation, validate } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';

type EmailRow = { address: string; confirm: string };
type ContactForm = { emails: EmailRow[] };

// Схема одной строки — правила по под-модели строки
const emailRowRules = defineValidation<EmailRow>(({ model, cross }) => {
  validate(model.$.address, [required(), email()]);
  cross(model.$.confirm, (row) => (row.confirm !== row.address ? { code: 'emailMismatch' } : null));
});

const contactValidation = defineValidation<ContactForm>(({ model }) => {
  applyEach(model.$.emails, emailRowRules);
});
```

## Предупреждения вместо ошибок

Замечание с `severity: 'warning'` показывается пользователю, но **не блокирует** отправку — при
наличии только предупреждений прогон получает статус `valid`. Используйте для «мягких» подсказок:

```typescript
import type { Rule } from '@reformer/core/validation';

const weakButAllowed: Rule<string> = (value) =>
  value && value.length < 12 ? { code: 'shortPassword', severity: 'warning' } : null;
```

```typescript
// Подключается как обычное правило:
import { validate } from '@reformer/core/validation';
import { required, minLength } from '@reformer/core/validators';

validate(model.$.password, [required(), minLength(8), weakButAllowed]);
```

## Советы

- **Возвращайте `null` для валидного значения** — не `undefined` и не `{}`.
- **Пропускайте пустое** (`if (!value) return null`) — обязательность закрывает `required()`.
- **Значения — через `validate`, зависимости — через `cross`.** Правило `Rule<T>` видит только
  `value`; всё, что читает соседние поля, выносите в `cross(handle, (f) => …)` по снимку.
- **Используйте описательные `code`** (`passwordTooWeak`, а не `invalid`) — по ним находится текст в
  словаре и удобно фильтровать замечания. Код конкретного поля принято именовать
  `<поле>.<правило>`.
- **Кладите контекст в `params`** (`{ max: 100, actual: value.length }`) — он подставляется в текст.

## Дальше

- [Асинхронная валидация](/docs/validation/async) — проверки уникальности через сервер.
- [Стратегии валидации](/docs/validation/validation-strategies) — пошаговые формы, зависимые поля, момент запуска.
- [Обработка ошибок](/docs/validation/error-handling) — чтение и отображение `ValidationIssue`.

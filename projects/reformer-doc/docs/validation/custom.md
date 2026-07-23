---
sidebar_position: 4
---

# Кастомные валидаторы

Когда встроенных фабрик недостаточно, правило описывается обычной функцией. Кастомное правило
кладётся в тот же массив, что и встроенные фабрики — вторым аргументом оператора `validate(sig, [rules])`
внутри схемы `defineValidationSchema`. Схема валидации живёт **отдельно** от layout (`RenderNode` / JSON):
она не несёт компонентов, а прогоняется по требованию раннером `validateModel(model, schema)`.

## Контракт

Синхронное правило — функция типа `Rule<TField>`. Ментальная модель автора — `(value) => error`:
правило видит **только значение поля** и возвращает `ValidationError` (`{ code, message, params?, severity? }`)
либо `null`, если значение валидно.

Тип `Rule<TField>` объявляет позиционные `scope`/`root` как `never` — это техническая деталь, благодаря
которой в один массив кладутся и value-only фабрики (`required()`/`min()`), и инлайн-правила `(value) => …`.
Использовать эти аргументы не нужно: правилу доступно только `value`. Всё, что зависит от соседних
полей, — это уже [кросс-полевая проверка](#кросс-полевые-проверки) через оператор `cross`.

Пустые значения принято пропускать — обязательность закрывает `required()`.

## Инлайн-валидатор

Простое правило можно записать прямо в массиве оператора `validate`:

```typescript
import { createModel } from '@reformer/core';
import { validate, defineValidationSchema, validateModel } from '@reformer/core/validation';

type AgeForm = { age: number | null };

const model = createModel<AgeForm>({ age: null });

const schema = defineValidationSchema<AgeForm>(({ model }) => {
  validate(model.$.age, [
    (value) =>
      value != null && value < 18 ? { code: 'mustBeAdult', message: 'Только 18+' } : null,
  ]);
});

// Прогон по требованию: ошибки разносятся по нодам формы, возвращается флаг валидности
const ok = await validateModel(model, schema);
```

## Переиспользуемая фабрика

Чтобы применять правило в нескольких формах, оформите его фабрикой, возвращающей `Rule<T>`.
Каждое правило возвращает **одну** ошибку — сложную проверку разбивают на несколько правил в массиве;
оператор `validate` выполняет их все и накапливает ошибки:

```typescript title="validators/password.ts"
import type { Rule } from '@reformer/core/validation';

export const hasUppercase = (): Rule<string> => (value) =>
  !value || /[A-Z]/.test(value) ? null : { code: 'noUppercase', message: 'Нужна заглавная буква' };

export const hasNumber = (): Rule<string> => (value) =>
  !value || /[0-9]/.test(value) ? null : { code: 'noNumber', message: 'Нужна цифра' };
```

```typescript
// Применение в схеме — внутри defineValidationSchema(({ model }) => { … }):
import { validate } from '@reformer/core/validation';
import { required, minLength } from '@reformer/core/validators';
import { hasUppercase, hasNumber } from './validators/password';

validate(model.$.password, [required(), minLength(8), hasUppercase(), hasNumber()]);
```

## Валидатор с параметрами

Параметризуйте фабрику и прикладывайте данные ошибки через `params` — их можно использовать при
отображении:

```typescript title="validators/range.ts"
import type { Rule } from '@reformer/core/validation';

export function range(min: number, max: number): Rule<number | null> {
  return (value) => {
    if (value == null) return null; // пропускаем пустое
    if (value < min || value > max) {
      return {
        code: 'range',
        message: `Допустимо от ${min} до ${max}`,
        params: { min, max, actual: value },
      };
    }
    return null;
  };
}
```

```typescript
// Внутри defineValidationSchema(({ model }) => { … }):
import { validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { range } from './validators/range';

validate(model.$.quantity, [required(), range(1, 100)]);
```

## Кросс-полевые проверки

Правило, зависящее от другого поля, — это оператор `cross(sig, fn)`. Функция `fn` получает **снапшот**
модели текущего scope (`model.get()`) и читает соседние поля прямо из объекта, а ошибку `cross`
вешает на переданный сигнал `sig` — то поле, которое должно её нести:

```typescript
import { createModel, type ValidationError } from '@reformer/core';
import { validate, cross, defineValidationSchema, validateModel } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';

type PasswordForm = { password: string; confirmPassword: string };

const model = createModel<PasswordForm>({ password: '', confirmPassword: '' });

// confirmPassword должен совпадать с password — правило читает снапшот всей формы
const passwordsMatch = (f: PasswordForm): ValidationError | null =>
  f.confirmPassword && f.password && f.confirmPassword !== f.password
    ? { code: 'passwordMismatch', message: 'Пароли не совпадают' }
    : null;

const schema = defineValidationSchema<PasswordForm>(({ model }) => {
  validate(model.$.password, [required()]);
  validate(model.$.confirmPassword, [required()]);
  // ошибку несёт confirmPassword — на его сигнал и вешаем cross
  cross(model.$.confirmPassword, passwordsMatch);
});

const ok = await validateModel(model, schema);
```

:::tip Пересчёт зависимого поля
Прогон валидации сам по себе не реактивен. Чтобы `confirmPassword` перепроверялся при изменении
`password`, свяжите поля через `revalidateWhen` в behavior — он вызовет `validateModel` заново.
См. [Стратегии валидации](/docs/validation/validation-strategies#зависимые-поля).
:::

## Условная валидация

Правила, действующие только в части формы, оборачиваются оператором `validateWhen(cond, cb)`. Пока
`cond()` истинно, вложенные правила активны; когда ложно — они **не выполняются**, а ошибки их полей
гасятся (поле получает `setErrors([])`), так что «прятать» лишние ошибки в UI не нужно:

```typescript
import { createModel } from '@reformer/core';
import {
  validate,
  validateWhen,
  defineValidationSchema,
  validateModel,
} from '@reformer/core/validation';
import { required } from '@reformer/core/validators';

type TaxForm = { country: string; taxId: string };

const model = createModel<TaxForm>({ country: '', taxId: '' });

const isNineDigits = (value: string) =>
  /^\d{9}$/.test(value) ? null : { code: 'invalidTaxId', message: 'ИНН — 9 цифр' };

const schema = defineValidationSchema<TaxForm>(({ model }) => {
  validate(model.$.country, [required()]);
  // ИНН обязателен только для страны US; иначе правила ветки гасятся
  validateWhen(
    () => model.country === 'US',
    () => validate(model.$.taxId, [required(), isNineDigits])
  );
});

const ok = await validateModel(model, schema);
```

Условие `cond` читает значения через value-proxy модели (`model.country`), поэтому в момент прогона
`validateModel` учитывается актуальное состояние формы.

## Валидация элементов массива

Для валидации элементов массива служит оператор `each(arr, itemFn)`. Он проходит по каждому элементу
массива модели и вызывает `itemFn` с под-моделью элемента `FormModel<Item>`, внутри которой применяются
обычные операторы `validate`/`cross`:

```typescript
import { createModel, type FormModel } from '@reformer/core';
import { validate, each, defineValidationSchema, validateModel } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';

type ContactForm = { emails: { address: string }[] };

const model = createModel<ContactForm>({ emails: [{ address: '' }] });

// Под-схема одного элемента массива — правила по под-модели элемента
const emailItem = (im: FormModel<{ address: string }>): void => {
  validate(im.$.address, [required(), email()]);
};

const schema = defineValidationSchema<ContactForm>(({ model }) => {
  each(model.emails, emailItem);
});

const ok = await validateModel(model, schema);
```

Для кросс-полевой проверки **внутри** элемента захватите его снапшот в замыкание (`const item = im.get()`)
и передайте в `cross` — так `cross` увидит данные элемента, а не корня формы.

## Предупреждения вместо ошибок

Ошибка с `severity: 'warning'` показывается пользователю, но **не блокирует** submit — при наличии
только предупреждений `validateModel` возвращает `true`. Используйте для «мягких» подсказок:

```typescript
import type { Rule } from '@reformer/core/validation';

const weakButAllowed: Rule<string> = (value) =>
  value && value.length < 12
    ? { code: 'shortPassword', message: 'Рекомендуем 12+ символов', severity: 'warning' }
    : null;
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
- **Значения — через `validate`, зависимости — через `cross`.** Правило `Rule<T>` видит только `value`;
  всё, что читает соседние поля, выносите в `cross(sig, (f) => …)` по снапшоту.
- **Используйте описательные `code`** (`passwordTooWeak`, а не `invalid`) — по ним удобно фильтровать
  и локализовать ошибки.
- **Кладите контекст в `params`** (`{ max: 100, actual: value.length }`) — пригодится при отображении.

## Дальше

- [Асинхронная валидация](/docs/validation/async) — проверки уникальности через сервер.
- [Стратегии валидации](/docs/validation/validation-strategies) — пошаговые формы, зависимые поля, момент запуска.
- [Обработка ошибок](/docs/validation/error-handling) — чтение и отображение `ValidationError`.

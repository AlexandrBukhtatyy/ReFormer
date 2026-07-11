---
sidebar_position: 4
---

# Кастомные валидаторы

Когда встроенных фабрик недостаточно, правило описывается обычной функцией. Кастомный валидатор
кладётся в тот же массив `validators`, что и встроенные.

## Контракт

Валидатор — чистая функция `(value, scope, root)`:

- `value` — значение поля;
- `scope` — ближайшая scope-модель (под-модель элемента массива или корень);
- `root` — корневая модель формы (`root.someField` читает значение соседнего поля).

Возвращает `ValidationError` (`{ code, message, params?, severity? }`) либо `null`, если значение
валидно. Пустые значения принято пропускать — обязательность закрывает `required()`.

## Инлайн-валидатор

Простое правило можно записать прямо в массиве:

```typescript
import { createModel, createForm } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

const model = createModel<{ age: number | null }>({ age: null });

const schema = {
  age: {
    value: model.$.age,
    component: Input,
    validators: [
      (value: number | null) =>
        value != null && value < 18 ? { code: 'mustBeAdult', message: 'Только 18+' } : null,
    ],
  },
};

const form = createForm({ model, schema });
```

## Переиспользуемая фабрика

Чтобы применять правило в нескольких формах, оформите его фабрикой, возвращающей `Validator`.
В M1 каждый валидатор возвращает **одну** ошибку — сложную проверку разбивают на несколько
правил, все они выполняются и их ошибки накапливаются:

```typescript title="validators/password.ts"
import type { Validator } from '@reformer/core';

export const hasUppercase = (): Validator<unknown, string> => (value) =>
  !value || /[A-Z]/.test(value) ? null : { code: 'noUppercase', message: 'Нужна заглавная буква' };

export const hasNumber = (): Validator<unknown, string> => (value) =>
  !value || /[0-9]/.test(value) ? null : { code: 'noNumber', message: 'Нужна цифра' };
```

```typescript
// Применение в схеме:
import { required, minLength } from '@reformer/core/validators';
import { hasUppercase, hasNumber } from './validators/password';

password: {
  value: model.$.password,
  component: Input,
  validators: [required(), minLength(8), hasUppercase(), hasNumber()],
},
```

## Валидатор с параметрами

Параметризуйте фабрику и прикладывайте данные ошибки через `params` — их можно использовать при
отображении:

```typescript title="validators/range.ts"
import type { Validator } from '@reformer/core';

export function range(min: number, max: number): Validator<unknown, number> {
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
import { required } from '@reformer/core/validators';
import { range } from './validators/range';

quantity: {
  value: model.$.quantity,
  component: Input,
  validators: [required(), range(1, 100)],
},
```

## Кросс-полевые проверки

Правило, зависящее от другого поля, читает соседа через третий аргумент `root`. Оно вешается на
поле, которое должно нести ошибку. Для типизированного `root` используйте `ModelValidator`:

```typescript
import type { ModelValidator } from '@reformer/core';
import { required } from '@reformer/core/validators';

type PasswordForm = { password: string; confirmPassword: string };

// confirmPassword должен совпадать с password — читаем соседа через root
const matchesPassword: ModelValidator<string, unknown, PasswordForm> = (value, _scope, root) =>
  value && root.password && value !== root.password
    ? { code: 'passwordMismatch', message: 'Пароли не совпадают' }
    : null;

const schema = {
  password: { value: model.$.password, component: Input, validators: [required()] },
  confirmPassword: {
    value: model.$.confirmPassword,
    component: Input,
    validators: [required(), matchesPassword],
  },
};
```

:::tip Пересчёт зависимого поля
Чтобы `confirmPassword` перепроверялся при изменении `password`, свяжите поля через `revalidateWhen`
в behavior — см. [Стратегии валидации](/docs/validation/validation-strategies#зависимые-поля).
:::

## Условная валидация

Кастомные правила, действующие только в части формы, включаются узлом-веткой `{ when, children }`.
Когда `when` — `false`, поддерево пропускается, а ошибки его полей очищаются:

```typescript
import { validateFormModel } from '@reformer/core';
import { required } from '@reformer/core/validators';

const isNineDigits = (value: string) =>
  /^\d{9}$/.test(value) ? null : { code: 'invalidTaxId', message: 'ИНН — 9 цифр' };

const schema = {
  country: { value: model.$.country, component: Input, validators: [required()] },
  // ИНН обязателен только для страны US
  taxBranch: {
    when: (_scope, root) => root.country === 'US',
    children: [{ value: model.$.taxId, component: Input, validators: [required(), isNineDigits] }],
  },
};

const { valid } = await validateFormModel(model, schema);
```

## Валидация элементов массива

Секция массива в схеме валидации описывается как
`{ componentProps: { control: model.<array>, itemComponent: (item) => subSchema } }`.
`validateFormModel` проходит её по каждому элементу и применяет валидаторы к его полям:

```typescript
import { createModel, validateFormModel, type FormModel } from '@reformer/core';
import { required, email } from '@reformer/core/validators';

type ContactForm = { emails: { address: string }[] };

const model = createModel<ContactForm>({ emails: [{ address: '' }] });

// Под-схема одного элемента массива
const emailItem = (item: FormModel<{ address: string }>) => ({
  address: { value: item.$.address, validators: [required(), email()] },
});

const schema = {
  emails: { componentProps: { control: model.emails, itemComponent: emailItem } },
};

const { valid, errors } = await validateFormModel(model, schema);
```

## Предупреждения вместо ошибок

Ошибка с `severity: 'warning'` показывается пользователю, но **не блокирует** submit (`valid`
остаётся `true`). Используйте для «мягких» подсказок:

```typescript
const weakButAllowed = (value: string) =>
  value && value.length < 12
    ? { code: 'shortPassword', message: 'Рекомендуем 12+ символов', severity: 'warning' as const }
    : null;
```

## Советы

- **Возвращайте `null` для валидного значения** — не `undefined` и не `{}`.
- **Пропускайте пустое** (`if (!value) return null`) — обязательность закрывает `required()`.
- **Используйте описательные `code`** (`passwordTooWeak`, а не `invalid`) — по ним удобно фильтровать
  и локализовать ошибки.
- **Кладите контекст в `params`** (`{ max: 100, actual: value.length }`) — пригодится при отображении.

## Дальше

- [Асинхронная валидация](/docs/validation/async) — проверки уникальности через сервер.
- [Стратегии валидации](/docs/validation/validation-strategies) — `updateOn`, пошаговые формы, зависимые поля.
- [Обработка ошибок](/docs/validation/error-handling) — чтение и отображение `ValidationError`.

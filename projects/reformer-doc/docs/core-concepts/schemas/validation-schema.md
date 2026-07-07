---
sidebar_position: 3
---

# Схема валидации

В M1 валидация — **не** отдельная схема-функция. Она живёт прямо в схеме формы: каждый узел поля
несёт массив `validators`, а вся модель проверяется против схемы через `validateFormModel` (или
`validateModelSync`). Отдельного `validateForm()`, реестра или операторов регистрации в v6 нет.

## Валидаторы на узле схемы

Валидаторы — **чистые фабрики** из `@reformer/core/validators`. Фабрика возвращает функцию
`(value) => error | null` и кладётся в массив `validators` узла поля:

```typescript
import { createModel, createForm } from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

type User = { name: string; email: string };

const model = createModel<User>({ name: '', email: '' });

const schema = {
  name: { value: model.$.name, component: Input, validators: [required(), minLength(2)] },
  email: { value: model.$.email, component: Input, validators: [required(), email()] },
};

const form = createForm<User>({ model, schema });
```

Схема привязывает каждое поле к **сигналу модели** (`value: model.$.<field>`): значение — источник
истины в модели, а узел добавляет поверх UI-конфиг и валидаторы. Схема здесь ровно та же, что
передаётся в `createForm` — отдельную схему для валидации собирать не нужно.

## Запуск валидации

```typescript
import { validateFormModel, validateModel, validateModelSync } from '@reformer/core';

// Async-aware (sync + async валидаторы). Роутит ошибки в ноды формы для показа в UI.
const { valid, errors } = await validateFormModel(model, schema);

// То же, но БЕЗ роутинга в ноды — чистая headless-проверка данных.
const res = await validateModel(model, schema);

// Только sync (например, быстрый gate «можно ли перейти на след. шаг»). Async пропускаются.
const sync = validateModelSync(model, schema);
if (!sync.valid) console.log(sync.errors); // { 'email': [{ code, message }], ... }
```

| Функция             | Async                 | Роутинг ошибок в ноды | Когда использовать                      |
| ------------------- | --------------------- | --------------------- | --------------------------------------- |
| `validateFormModel` | да (sync + async)     | да                    | submit — показать ошибки в UI           |
| `validateModel`     | да (sync + async)     | нет                   | headless-проверка данных                |
| `validateModelSync` | нет (async пропущены) | нет                   | быстрый sync-gate (шаг wizard, переход) |

Результат — `{ valid: boolean; errors: Record<string, ValidationError[]> }`, где ключ `errors` — путь
поля (`'email'`, `'items.0.name'`), и попадают в него только поля с ошибками.

:::tip Показ ошибок в UI
Перед submit вызовите `form.touchAll()` и затем `validateFormModel(model, schema)` — ошибки
разведутся по нодам и покажутся автоматически. См. [Быстрый старт](../../getting-started/quick-start).
:::

## Встроенные валидаторы

| Валидатор      | Описание                   |
| -------------- | -------------------------- |
| `required()`   | Поле должно иметь значение |
| `email()`      | Корректный email           |
| `minLength(n)` | Минимальная длина строки   |
| `maxLength(n)` | Максимальная длина строки  |
| `min(n)`       | Минимальное число          |
| `max(n)`       | Максимальное число         |
| `pattern(re)`  | Совпадение с регуляркой    |
| `isNumber()`   | Значение — число           |
| `integer()`    | Целое число                |

Полный список (числовые, датовые и др.) — в [Встроенных валидаторах](../../validation/built-in).

## Тип валидатора

Валидатор — чистая функция трёх аргументов `(value, scope, root)`:

```typescript
type Validator<TForm, TField> = (
  value: TField, // значение поля
  scope: unknown, // ближайшая scope-модель (под-модель элемента массива или корень)
  root: FormModel<TForm> // корневая модель (value-proxy: root.field читает значение)
) => ValidationError | null;
```

Тот же контракт, но со стороны **данных** (2-й/3-й аргументы — модель, а не ноды формы), называется
`ModelValidator<TValue, TModel, TRoot>`; он также допускает `Promise` в результате:

```typescript
type ModelValidator<TValue, TModel, TRoot> = (
  value: TValue,
  model: TModel, // ближайший scope
  root: TRoot // корневая модель
) => ValidationError | null | Promise<ValidationError | null>;
```

Встроенные фабрики (`required()`, `email()`, …) возвращают `(value) => …` и лишние аргументы
игнорируют. Кастомные валидаторы принимают все три и кладутся в тот же массив `validators`.

## Кастомные и cross-field валидаторы

Кастомная проверка — обычная функция в `validators`. Cross-field правило читает соседние поля через
`root` и вешается на поле-носитель ошибки:

```typescript
import type { ModelValidator } from '@reformer/core';

// Value-only
const strongPassword: ModelValidator<string> = (value) =>
  !value || value.length < 8 ? { code: 'too-short', message: 'Минимум 8 символов' } : null;

// Cross-field: сравниваем с другим полем через root
const passwordsMatch: ModelValidator<string, unknown, { password: string }> = (
  value,
  _scope,
  root
) =>
  value && root.password && value !== root.password
    ? { code: 'mismatch', message: 'Пароли не совпадают' }
    : null;

const schema = {
  password: { value: model.$.password, component: Input, validators: [required(), strongPassword] },
  confirmPassword: {
    value: model.$.confirmPassword,
    component: Input,
    validators: [required(), passwordsMatch],
  },
};
```

## Условная валидация

Чтобы поле проверялось только при выполнении условия, сделайте валидатор **самопроверяющим**: он
читает управляющее поле через `root` и возвращает `null`, когда правило неприменимо:

```typescript
import { Input, Checkbox } from '@reformer/ui-kit';

const schema = {
  wantsSms: { value: model.$.wantsSms, component: Checkbox },
  phone: {
    value: model.$.phone,
    component: Input,
    validators: [
      // Телефон обязателен только если пользователь хочет SMS.
      (value, _scope, root) =>
        root.wantsSms && !value ? { code: 'required', message: 'Укажите телефон для SMS' } : null,
    ],
  },
};
```

:::info Условие валидации ≠ условная доступность
Если поле должно ещё и **отключаться** (или скрываться) при невыполнении условия — это забота
behavior, а не валидатора. Используйте `enableWhen` (см. [Схему behavior](./behavior-schema)) и
условный рендер, а валидатор оставьте самопроверяющим.
:::

## Асинхронная валидация

Асинхронные проверки (например, уникальность на сервере) кладите в `asyncValidators` узла. Они
запускаются под `validateFormModel` / `validateModel` и пропускаются `validateModelSync`:

```typescript
const schema = {
  username: {
    value: model.$.username,
    component: Input,
    validators: [required()],
    asyncValidators: [
      async (value) => {
        const exists = await checkUsername(value as string);
        return exists ? { code: 'taken', message: 'Имя уже занято' } : null;
      },
    ],
    debounce: 300,
  },
};
```

Подробнее — в [Асинхронной валидации](../../validation/async).

## Валидация по массиву

Правило уровня всего массива (уникальность, «хотя бы один элемент») пишется как `ModelValidator`,
читает элементы через `root.<array>` и вешается на поле-носитель ошибки:

```typescript
import type { ModelValidator } from '@reformer/core';

type Order = { orderName: string; items: { name: string }[] };

// Уникальность имён по массиву.
const uniqueItemNames: ModelValidator<string, unknown, Order> = (_value, _scope, root) => {
  const names = root.items.map((i) => i.name);
  return names.length !== new Set(names).size
    ? { code: 'duplicate', message: 'Имена элементов должны быть уникальны' }
    : null;
};

const schema = {
  orderName: {
    value: model.$.orderName,
    component: Input,
    validators: [required(), uniqueItemNames],
  },
  items: { array: model.items, item: itemSchema },
};
```

Правила отдельных полей элемента (`name` обязателен и т.п.) объявляются в под-схеме элемента
`item` — см. [Схему формы](./form-schema).

## Переиспользование наборов валидаторов

Списки валидаторов и целые builder узлов легко вынести и переиспользовать:

```typescript
import { required, email, minLength } from '@reformer/core/validators';
import type { SchemaValidator } from '@reformer/core';

// Переиспользуемые списки валидаторов.
// Тип поля узла — SchemaValidator (широкий контракт, принимает и фабрики, и ModelValidator);
// встроенные фабрики возвращают Validator, поэтому ModelValidator[] здесь не подойдёт.
const nameValidators: SchemaValidator[] = [required(), minLength(2)];
const emailValidators: SchemaValidator[] = [required(), email()];

const schema = {
  firstName: { value: model.$.user.firstName, component: Input, validators: nameValidators },
  lastName: { value: model.$.user.lastName, component: Input, validators: nameValidators },
  email: { value: model.$.user.email, component: Input, validators: emailValidators },
};
```

## Дальше

- [Обзор валидации](../../validation/overview) — подробный гайд.
- [Встроенные валидаторы](../../validation/built-in) — весь список.
- [Кастомные валидаторы](../../validation/custom) — свои правила.
- [Композиция](./composition) — переиспользование наборов валидации.

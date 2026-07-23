---
sidebar_position: 2
---

# Формы из OpenAPI

Если бэкенд описан спецификацией OpenAPI (Swagger), её удобно использовать как источник **типов**
формы. Форма в M1 строится вокруг `type`-алиаса ([структура проекта](./project-structure)), поэтому
готовый тип запроса из OpenAPI-спеки подставляется прямо в `createModel` / `createForm`, а
ограничения (`required`, `minLength`, `format`) переносятся в **схему валидации** `ValidationSchema<T>`
(отдельный слой, не layout-схема).

:::caution Своего генератора в ReFormer нет
`@reformer/core` **не содержит** встроенного генератора кода из OpenAPI (типов, сервисов, схем).
Ниже — подтверждённый паттерн интеграции под M1: типы получаете внешним генератором, а модель,
layout-схему и валидацию собираете вручную. Полноценная автогенерация схемы/сервисов — в разделе
[Планы](#планы) ниже, как не реализованная на данный момент возможность.
:::

## Шаг 1. Типы из спецификации

Тип запроса генерируется любым внешним инструментом (`openapi-typescript`, `orval` и т.п.) — это
обычный шаг сборки, к ReFormer он отношения не имеет. На выходе — TypeScript-тип, который вы
объявляете как `type`-алиас формы:

```typescript title="types.ts"
// Тип соответствует request body из OpenAPI (POST /users)
export type CreateUserRequest = {
  firstName: string;
  lastName: string;
  email: string;
  age: number | null;
};
```

:::tip Форма — это `type`
Для `FormProxy<T>` нужен `type`-алиас со структурной индекс-сигнатурой, а не `interface`. Если
генератор выдаёт `interface`, оберните его: `type CreateUserForm = CreateUserRequest;`.
:::

## Шаг 2. Модель, схема и валидация

Тип задаёт форму модели. **Layout-схема** (узлы формы) описывает только привязку полей к UI —
`value` (сигнал модели), `component`, `componentProps` — и **валидаторов не несёт**:

```typescript title="form.schema.ts"
import { createModel, createForm } from '@reformer/core';
import { Input } from '@reformer/ui-kit';
import type { CreateUserRequest } from './types';

const model = createModel<CreateUserRequest>({
  firstName: '',
  lastName: '',
  email: '',
  age: null,
});

// Layout-схема: только привязка полей, без правил валидации
const schema = {
  firstName: {
    value: model.$.firstName,
    component: Input,
    componentProps: { label: 'Имя' },
  },
  email: {
    value: model.$.email,
    component: Input,
    componentProps: { label: 'Email', type: 'email' },
  },
  age: {
    value: model.$.age,
    component: Input,
    componentProps: { label: 'Возраст', type: 'number' },
  },
};

const form = createForm<CreateUserRequest>({ model, schema });
```

Ограничения из OpenAPI (`required`, `minLength`, `format: email`, `minimum`) переносятся в **отдельную
схему валидации** — обычную функцию `defineValidationSchema(({ model }) => …)` из
`@reformer/core/validation`. Правила поля собираются оператором `validate(sig, [rules])` из фабрик
`@reformer/core/validators`:

```typescript title="form.validation.ts"
import { defineValidationSchema, validate } from '@reformer/core/validation';
import { required, email, minLength, min } from '@reformer/core/validators';
import type { CreateUserRequest } from './types';

export const userValidation = defineValidationSchema<CreateUserRequest>(({ model }) => {
  validate(model.$.firstName, [required(), minLength(2)]); // required + minLength из OpenAPI
  validate(model.$.email, [required(), email()]); // format: email
  validate(model.$.age, [min(18)]); // minimum
});
```

| OpenAPI                   | Правило валидации               |
| ------------------------- | ------------------------------- |
| `required: [...]`         | `required()`                    |
| `minLength` / `maxLength` | `minLength(n)` / `maxLength(n)` |
| `minimum` / `maximum`     | `min(n)` / `max(n)`             |
| `format: email`           | `email()`                       |
| `pattern`                 | `pattern(regexp)`               |

Фабрики принимают nullable-значения, поэтому `min(18)` корректно работает и на `age: number | null`.
Ошибки прогон разносит по нодам формы сам (`getNodeForSignal(sig).setErrors(...)`) — UI подсветит поля.

## Шаг 3. Отправка

Схема валидации запускается **по требованию** внешним раннером `validateModel(model, schema)` — он
возвращает `Promise<boolean>` (`false`, если есть блокирующие ошибки; `severity: 'warning'` не
блокирует). Снимок модели `model.get()` уже совпадает по форме с request body — его можно отправлять
как есть:

```typescript title="api.ts"
import { validateModel, type ValidationSchema } from '@reformer/core/validation';
import type { FormModel } from '@reformer/core';
import type { CreateUserRequest } from './types';

export async function submitUser(
  model: FormModel<CreateUserRequest>,
  validation: ValidationSchema<CreateUserRequest>
) {
  const valid = await validateModel(model, validation);
  if (!valid) return;

  await fetch('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(model.get()), // ← совпадает с CreateUserRequest
  });
}
```

:::caution Валидацию запускаете вы
`form.validate()` / `form.submit()` **больше не прогоняют** schema-валидацию — она идёт только через
явный вызов `validateModel(model, validation)`. Вызывайте раннер сами перед отправкой (как выше).
:::

Так тип из OpenAPI-спеки удерживает согласованность формы и API: несовпадение полей формы с request
body ловится компилятором TypeScript.

## Планы

Встроенная автогенерация из OpenAPI пока **не реализована**. В планах:

- генерация `type`-алиасов формы из request/response-моделей;
- вывод валидаторов из ограничений схемы (`required`, `minLength`, `format`, …);
- генерация сервис-функций отправки формы.

До появления этих возможностей используйте паттерн выше: внешний генератор типов + ручная сборка
модели/layout-схемы/валидации под M1.

## Дальше

- [Структура проекта](./project-structure) — где живут `types`, `model`, `schema`, `api`.
- [Встроенные валидаторы](../validation/built-in) — полный список фабрик.
- [Быстрый старт](../getting-started/quick-start) — базовый цикл модель → схема → форма → отправка.

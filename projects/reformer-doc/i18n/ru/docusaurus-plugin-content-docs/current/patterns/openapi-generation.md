---
sidebar_position: 2
---

# Формы из OpenAPI

Если бэкенд описан спецификацией OpenAPI (Swagger), её удобно использовать как источник **типов**
формы. Форма в M1 строится вокруг `type`-алиаса ([структура проекта](./project-structure)), поэтому
готовый тип запроса из OpenAPI-спеки подставляется прямо в `createModel` / `createForm`, а
ограничения (`required`, `minLength`, `format`) переносятся в валидаторы.

:::caution Своего генератора в ReFormer нет
`@reformer/core` **не содержит** встроенного генератора кода из OpenAPI (типов, сервисов, схем).
Ниже — подтверждённый паттерн интеграции под M1: типы получаете внешним генератором, а модель,
схему и валидацию собираете вручную. Полноценная автогенерация схемы/сервисов — в разделе
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

## Шаг 2. Модель, схема и валидаторы

Тип задаёт форму модели. Ограничения из OpenAPI (`required`, `minLength`, `format: email`,
`minimum`) переносятся в валидаторы-фабрики вручную:

```typescript title="form.schema.ts"
import { createModel, createForm } from '@reformer/core';
import { required, email, minLength, min } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';
import type { CreateUserRequest } from './types';

const model = createModel<CreateUserRequest>({
  firstName: '',
  lastName: '',
  email: '',
  age: null,
});

const schema = {
  firstName: {
    value: model.$.firstName,
    component: Input,
    componentProps: { label: 'Имя' },
    validators: [required(), minLength(2)], // minLength из OpenAPI
  },
  email: {
    value: model.$.email,
    component: Input,
    componentProps: { label: 'Email', type: 'email' },
    validators: [required(), email()], // format: email
  },
  age: {
    value: model.$.age,
    component: Input,
    componentProps: { label: 'Возраст', type: 'number' },
    validators: [min(18)], // minimum
  },
};

const form = createForm<CreateUserRequest>({ model, schema });
```

| OpenAPI                   | Валидатор M1                    |
| ------------------------- | ------------------------------- |
| `required: [...]`         | `required()`                    |
| `minLength` / `maxLength` | `minLength(n)` / `maxLength(n)` |
| `minimum` / `maximum`     | `min(n)` / `max(n)`             |
| `format: email`           | `email()`                       |
| `pattern`                 | `pattern(regexp)`               |

## Шаг 3. Отправка

Снимок модели `model.get()` уже совпадает по форме с request body — его можно отправлять как есть:

```typescript title="api.ts"
import { validateFormModel, type FormModel, type FormSchema } from '@reformer/core';

export async function submitUser(
  model: FormModel<CreateUserRequest>,
  schema: FormSchema<CreateUserRequest>
) {
  const { valid } = await validateFormModel(model, schema);
  if (!valid) return;

  await fetch('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(model.get()), // ← совпадает с CreateUserRequest
  });
}
```

Так тип из OpenAPI-спеки удерживает согласованность формы и API: несовпадение полей формы с request
body ловится компилятором TypeScript.

## Планы

Встроенная автогенерация из OpenAPI пока **не реализована**. В планах:

- генерация `type`-алиасов формы из request/response-моделей;
- вывод валидаторов из ограничений схемы (`required`, `minLength`, `format`, …);
- генерация сервис-функций отправки формы.

До появления этих возможностей используйте паттерн выше: внешний генератор типов + ручная сборка
модели/схемы/валидации под M1.

## Дальше

- [Структура проекта](./project-structure) — где живут `types`, `model`, `schema`, `api`.
- [Встроенные валидаторы](../validation/built-in) — полный список фабрик.
- [Быстрый старт](../getting-started/quick-start) — базовый цикл модель → схема → форма → отправка.

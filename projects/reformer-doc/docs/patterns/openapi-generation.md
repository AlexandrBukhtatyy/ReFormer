---
sidebar_position: 2
---

# Формы из OpenAPI

Если бэкенд описан спецификацией OpenAPI (Swagger), её удобно использовать как источник **типов**
формы. Форма в M1 строится вокруг `type`-алиаса ([структура проекта](./project-structure)), поэтому
готовый тип запроса из OpenAPI-спеки подставляется прямо в `createModel` / `createForm`, а
ограничения (`required`, `minLength`, `format`) переносятся в **отдельную схему валидации**.

:::caution Своего генератора в ReFormer нет
`@reformer/core` **не содержит** встроенного генератора кода из OpenAPI (типов, сервисов, схем).
Ниже — подтверждённый паттерн интеграции под M1: типы получаете внешним генератором, а модель,
layout-схему и схему валидации собираете вручную. Полноценная автогенерация схемы/сервисов — в разделе
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

## Шаг 2. Модель, layout-схема и схема валидации

Тип задаёт форму модели. **Layout-схема** привязывает поля к сигналам модели и описывает вёрстку —
валидаторов её узлы не несут (в M1 это два раздельных слоя):

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

// Только привязка полей и вёрстка — правила корректности живут в отдельной схеме валидации.
const schema = {
  firstName: {
    value: model.$.firstName,
    component: Input,
    componentProps: { label: 'Имя' },
  },
  lastName: {
    value: model.$.lastName,
    component: Input,
    componentProps: { label: 'Фамилия' },
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

Ограничения из OpenAPI (`required`, `minLength`, `format: email`, `minimum`) переносятся вручную в
**схему валидации** `defineValidationSchema<T>(({ model }) => …)`. Каждое поле проверяется оператором
`validate(sig, [rules])` над той же моделью:

```typescript title="validation.ts"
import { validate, defineValidationSchema } from '@reformer/core/validation';
import { required, email, minLength, min } from '@reformer/core/validators';
import type { CreateUserRequest } from './types';

export const userValidation = defineValidationSchema<CreateUserRequest>(({ model }) => {
  validate(model.$.firstName, [required(), minLength(2)]); // required + minLength
  validate(model.$.lastName, [required()]);
  validate(model.$.email, [required(), email()]); // format: email
  validate(model.$.age, [min(18)]); // minimum
});
```

Фабрики-валидаторы (`required`/`email`/…) берутся из `@reformer/core/validators` и переиспользуются как
есть (value-only, пропускают пустые значения). Отображение ограничений OpenAPI на операторы `validate`:

| OpenAPI                   | Валидатор M1                    |
| ------------------------- | ------------------------------- |
| `required: [...]`         | `required()`                    |
| `minLength` / `maxLength` | `minLength(n)` / `maxLength(n)` |
| `minimum` / `maximum`     | `min(n)` / `max(n)`             |
| `format: email`           | `email()`                       |
| `pattern`                 | `pattern(regexp)`               |

:::info Layout и валидация — независимые слои
Вёрстку (`form.schema.ts`) и правила (`validation.ts`) можно менять порознь: layout приходит хоть с
сервера, а схема валидации пишется один раз над той же моделью. Cross-field правила из OpenAPI-инвариантов
объявляются оператором `cross(sig, fn)`, условные ветки — `validateWhen`, элементы массивов — `each`. См.
[Схему валидации](../core-concepts/schemas/validation-schema).
:::

## Шаг 3. Отправка

Перед отправкой схему валидации прогоняет внешний раннер `validateModel(model, schema)` — он возвращает
`Promise<boolean>` и сам разносит ошибки по нодам формы (UI подсветит поля). Снимок модели `model.get()`
уже совпадает по форме с request body — его можно отправлять как есть:

```typescript title="api.ts"
import { validateModel, type ValidationSchema } from '@reformer/core/validation';
import type { FormModel } from '@reformer/core';
import type { CreateUserRequest } from './types';

export async function submitUser(
  model: FormModel<CreateUserRequest>,
  schema: ValidationSchema<CreateUserRequest>
) {
  const valid = await validateModel(model, schema); // ошибки сами доедут до нод формы
  if (!valid) return;

  await fetch('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(model.get()), // ← совпадает с CreateUserRequest
  });
}
```

:::warning Валидация — только через `validateModel`
`form.validate()` / `form.submit()` **больше не прогоняют** схему валидации: она запускается
исключительно внешним раннером `validateModel`. `severity: 'warning'` не блокирует отправку
(`validateModel` вернёт `true`), а устаревшие прогоны той же пары `(model, schema)` отменяются.
:::

Так тип из OpenAPI-спеки удерживает согласованность формы и API: несовпадение полей формы с request
body ловится компилятором TypeScript.

## Планы

Встроенная автогенерация из OpenAPI пока **не реализована**. В планах:

- генерация `type`-алиасов формы из request/response-моделей;
- вывод схемы валидации из ограничений (`required`, `minLength`, `format`, …) в операторы `validate`;
- генерация сервис-функций отправки формы.

До появления этих возможностей используйте паттерн выше: внешний генератор типов + ручная сборка
модели, layout-схемы и схемы валидации под M1.

## Дальше

- [Структура проекта](./project-structure) — где живут `types`, `model`, `schema`, `api`.
- [Встроенные валидаторы](../validation/built-in) — полный список фабрик.
- [Быстрый старт](../getting-started/quick-start) — базовый цикл модель → схема → форма → отправка.

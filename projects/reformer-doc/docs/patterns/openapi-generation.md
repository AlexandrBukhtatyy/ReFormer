---
sidebar_position: 2
---

# Формы из OpenAPI

Если бэкенд описан спецификацией OpenAPI (Swagger), её удобно использовать как источник **типов**
формы. Готовый тип запроса из OpenAPI-спеки подставляется прямо в `createForm<T>`, а ограничения
(`required`, `minLength`, `format`) переносятся в **отдельную схему валидации** `ValidationDefinition<T>`.

:::caution Своего генератора в ReFormer нет
`@reformer/core` **не содержит** встроенного генератора кода из OpenAPI (типов, сервисов, схем).
Ниже — подтверждённый паттерн интеграции: типы получаете внешним генератором, а модель, схему
разметки и правила собираете вручную. Полноценная автогенерация — в разделе [Планы](#планы) ниже,
как не реализованная на данный момент возможность.
:::

## Шаг 1. Типы из спецификации

Тип запроса генерируется любым внешним инструментом (`openapi-typescript`, `orval` и т.п.) — это
обычный шаг сборки, к ReFormer он отношения не имеет. На выходе — TypeScript-тип формы; годится и
`type`, и `interface`:

```typescript title="types.ts"
// Тип соответствует request body из OpenAPI (POST /users)
export type CreateUserRequest = {
  firstName: string;
  lastName: string;
  email: string;
  age: number | null;
};
```

## Шаг 2. Схема разметки и правила

Тип задаёт форму модели. **Схема разметки** привязывает поля к сигналам модели и описывает вёрстку —
валидаторов её узлы не несут (разметка и правила — два раздельных слоя):

```typescript title="form.schema.ts"
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Input, InputNumber } from '@reformer/ui-kit';
import type { CreateUserRequest } from './types';

// Только привязка полей и вёрстка — правила корректности живут в отдельной схеме валидации.
export const userSchema = (model: FormModel<CreateUserRequest>): FormSchemaNode => ({
  children: [
    { model: model.$.firstName, component: Input, componentProps: { label: 'Имя' } },
    { model: model.$.lastName, component: Input, componentProps: { label: 'Фамилия' } },
    {
      model: model.$.email,
      component: Input,
      componentProps: { label: 'Email', type: 'email' },
    },
    { model: model.$.age, component: InputNumber, componentProps: { label: 'Возраст' } },
  ],
});
```

Ограничения из OpenAPI (`required`, `minLength`, `format: email`, `minimum`) переносятся вручную в
**схему валидации** `defineValidation<T>(({ model }) => …)`. Каждое поле проверяется оператором
`validate(sig, [rules])` над той же моделью:

```typescript title="form.validation.ts"
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email, minLength, min } from '@reformer/core/validators';
import type { CreateUserRequest } from './types';

export const userRules = defineValidation<CreateUserRequest>(({ model }) => {
  validate(model.$.firstName, [required(), minLength(2)]); // required + minLength
  validate(model.$.lastName, [required()]);
  validate(model.$.email, [required(), email()]); // format: email
  validate(model.$.age, [min(18)]); // minimum
});
```

Фабрики-валидаторы (`required` / `email` / …) берутся из `@reformer/core/validators`: проверяют
только значение и пропускают пустые значения, поэтому `min(18)` корректно работает на
`age: number | null`. Правило несёт код замечания (`required`, `minLength`, …), текст по коду даёт
словарь локали либо словарь формы (`defineIssueMessages`). Отображение ограничений OpenAPI:

| OpenAPI                   | Правило                         |
| ------------------------- | ------------------------------- |
| `required: [...]`         | `required()`                    |
| `minLength` / `maxLength` | `minLength(n)` / `maxLength(n)` |
| `minimum` / `maximum`     | `min(n)` / `max(n)`             |
| `format: email`           | `email()`                       |
| `pattern`                 | `pattern(regexp)`               |

:::info Разметка и правила — независимые слои
Вёрстку (`form.schema.ts`) и правила (`form.validation.ts`) можно менять порознь: разметка приходит
хоть с сервера (JSON), а схема валидации пишется один раз над той же моделью. Правила над
несколькими полями объявляются оператором `cross(sig, fn)` области схемы, условные ветки —
`validateWhen`, строки массивов — `applyEach`. См.
[Схему валидации](../core-concepts/schemas/validation-schema).
:::

## Шаг 3. Сборка и отправка

Модель, разметка и правила соединяются одной сборкой `createForm`. Отправка —
`bundle.submission.submit(handler)`: один прогон правил, при замечаниях обработчик не вызывается, а
поля подсвечиваются. Значения модели уже совпадают по форме с request body — их можно отправлять
как есть:

```tsx title="index.tsx"
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { userSchema } from './form.schema';
import { userRules } from './form.validation';
import type { CreateUserRequest } from './types';

const createUserForm = () =>
  createForm<CreateUserRequest>({
    initial: { firstName: '', lastName: '', email: '', age: null },
    schema: userSchema,
    validation: userRules,
  });

async function postUser(values: CreateUserRequest) {
  const response = await fetch('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values), // ← совпадает с CreateUserRequest
  });
  return response.ok;
}

export function CreateUserPage() {
  const bundle = useFormBundle(createUserForm);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const outcome = await bundle.submission.submit(postUser);
    if (outcome.status === 'submitted' && outcome.result) bundle.form.reset();
  };

  // …разметка: <FormField control={bundle.form.firstName} /> и т.д.
}
```

`severity: 'warning'` отправку не блокирует, а исключение обработчика приходит результатом
`{ status: 'failed', error }`. Подробнее — [Отправка и сброс](./submit-and-reset).

Так тип из OpenAPI-спеки удерживает согласованность формы и API: несовпадение полей формы с request
body ловится компилятором TypeScript.

## Планы

Встроенная автогенерация из OpenAPI пока **не реализована**. В планах:

- генерация типов формы из request/response-моделей;
- вывод схемы валидации из ограничений (`required`, `minLength`, `format`, …) в операторы `validate`;
- генерация сервис-функций отправки формы.

До появления этих возможностей используйте паттерн выше: внешний генератор типов + ручная сборка
модели, схемы разметки и правил.

## Дальше

- [Структура проекта](./project-structure) — где живут `types`, `model`, `schema`, `api`.
- [Встроенные валидаторы](../validation/built-in) — полный список фабрик.
- [Быстрый старт](../getting-started/quick-start) — базовый цикл модель → схема → форма → отправка.

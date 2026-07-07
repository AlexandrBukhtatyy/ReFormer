---
sidebar_position: 1
---

# Обзор валидации

Валидация в ReFormer — **декларативная** и **headless**. Правила описываются прямо в схеме поля,
а сама проверка — чистая функция данных: движок обходит модель по схеме, прогоняет валидаторы и
раскладывает ошибки по полям. UI подсвечивает их автоматически.

## Как это устроено

Валидаторы кладутся в массив `validators` узла схемы. Это чистые **фабрики**
(`required()`, `email()`, `min(18)`, …) из `@reformer/core/validators`, возвращающие функцию
`(value, scope, root) => ValidationError | null`.

```typescript
import { createModel, createForm, validateFormModel } from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

type ContactForm = { name: string; email: string };

const model = createModel<ContactForm>({ name: '', email: '' });

const schema = {
  name: {
    value: model.$.name,
    component: Input,
    validators: [required(), minLength(2)],
  },
  email: {
    value: model.$.email,
    component: Input,
    validators: [required(), email()],
  },
};

const form = createForm<ContactForm>({ model, schema });
```

:::info Валидаторы — чистые фабрики
`required()`, `min(50000)`, `email()` возвращают функцию и **вызываются со скобками** прямо в массиве:
`validators: [required(), min(50000)]`. Валидация запускается движком, а не самим полем.
:::

## Запуск валидации

Валидация выполняется **по требованию** — обычно на submit — через `validateFormModel(model, schema)`.
Функция обходит модель по схеме, возвращает `{ valid, errors }` и **роутит ошибки в ноды формы**,
поэтому поля с ошибками подсветятся в UI.

```typescript
const { valid, errors } = await validateFormModel(model, schema);
// valid: boolean
// errors: Record<string, ValidationError[]> — только поля с ошибками, ключ — путь поля
```

Канонический submit-флоу — «валидировать → проверить `valid` → взять снимок `model.get()`»:

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  form.touchAll(); // раскрыть все ошибки в UI

  const { valid } = await validateFormModel(model, schema);
  if (valid) {
    await api.save(model.get());
  }
};
```

:::tip Три варианта запуска

- `validateFormModel(model, schema)` — полная проверка (sync + async), **роутит ошибки в ноды формы**.
- `validateModel(model, schema)` — то же самое, но **без нод** (headless: server action, тест) — только результат.
- `validateModelSync(model, schema)` — только синхронные валидаторы, без сети; удобно как быстрый
  gate «можно ли перейти на следующий шаг».
  :::

## Чтение состояния поля

В компонентах реактивное состояние поля читают через `useFormControl`:

```tsx
import { useFormControl } from '@reformer/core';

function NameField() {
  const { value, errors, valid, shouldShowError } = useFormControl(form.name);
  // errors: ValidationError[] — пустой [] когда поле валидно
  // valid: boolean
  // shouldShowError: invalid && (touched || dirty) — показывать ошибку только после взаимодействия

  return (
    <div>
      <input value={value} onChange={(e) => form.name.setValue(e.target.value)} />
      {shouldShowError && errors[0] && <span className="error">{errors[0].message}</span>}
    </div>
  );
}
```

| Поле состояния      | Тип                 | Назначение                                              |
| ------------------- | ------------------- | ------------------------------------------------------- | --- | ----------------------------- |
| `value`             | `T`                 | текущее значение поля                                   |
| `errors`            | `ValidationError[]` | ошибки поля; `[]` когда валидно                         |
| `valid` / `invalid` | `boolean`           | прошло ли поле проверку                                 |
| `touched` / `dirty` | `boolean`           | взаимодействовал ли пользователь / менялось ли значение |
| `shouldShowError`   | `boolean`           | `invalid && (touched                                    |     | dirty)` — удобный флаг для UI |
| `pending`           | `boolean`           | идёт асинхронная валидация                              |

:::info `@reformer/ui-kit`
Универсальный `FormField` из `@reformer/ui-kit` уже подписан на `useFormControl` — он сам покажет
ошибку и индикатор `pending`. Свои обёртки нужны, только если вы не используете ui-kit.
:::

## Объект ошибки

Каждая ошибка — это `ValidationError`:

```typescript
interface ValidationError {
  code: string; // машинный код: 'required', 'email', 'minLength', …
  message: string; // текст для пользователя
  params?: Record<string, FormValue>; // данные ошибки: { minLength: 2, actualLength: 1 }
  severity?: 'error' | 'warning'; // 'error' (по умолчанию) блокирует submit; 'warning' — нет
}
```

```typescript
// Пример содержимого form.name.errors (валидаторам передан свой { message }):
[]; // — когда валидно
[{ code: 'required', message: 'Укажите имя' }]; // — required не пройден
[{ code: 'minLength', message: 'Минимум 2 символа', params: { minLength: 2, actualLength: 1 } }];
```

:::tip Пустое сообщение = резолв по коду
Если валидатору не передать `{ message }`, в `message` попадёт пустая строка (или `'invalid'`), а
человекочитаемый текст резолвится из `code` в слое отображения (`@reformer/ui-kit`). Свой текст
задаётся опцией: `required({ message: 'Укажите имя' })`.
:::

## Условная валидация

Правила, применяемые только в части формы, описываются узлом-веткой `{ when, children }`. Когда
`when` возвращает `false`, поддерево пропускается, а ошибки его полей очищаются.

```typescript
const schema = {
  contactByPhone: { value: model.$.contactByPhone, component: Checkbox },
  // Телефон обязателен, только если выбран контакт по телефону:
  phoneBranch: {
    when: (_scope, root) => root.contactByPhone === true,
    children: [{ value: model.$.phone, component: Input, validators: [required()] }],
  },
};

const { valid } = await validateFormModel(model, schema);
```

## Дальше

- [Встроенные валидаторы](/docs/validation/built-in) — полный список фабрик с сигнатурами.
- [Кастомные валидаторы](/docs/validation/custom) — свои правила и кросс-полевые проверки.
- [Асинхронная валидация](/docs/validation/async) — проверки через сервер.
- [Стратегии валидации](/docs/validation/validation-strategies) — `updateOn`, debounce, пошаговые формы.
- [Обработка ошибок](/docs/validation/error-handling) — чтение, фильтрация и отображение ошибок.

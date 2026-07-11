---
sidebar_position: 3
---

# Асинхронная валидация

Для проверок, требующих сервера — уникальность email, валидация ИНН, доступность имени — служат
**асинхронные валидаторы**. Они живут в отдельном массиве `asyncValidators` узла схемы.

## Контракт

Асинхронный валидатор — функция `(value, options?) => Promise<ValidationError | null>`. Второй
аргумент содержит `signal: AbortSignal` для отмены устаревших запросов:

```typescript
import type { AsyncValidatorFn } from '@reformer/core';

const checkEmailUnique: AsyncValidatorFn<string> = async (value, options) => {
  if (!value) return null; // пусто = валидно (обязательность — sync-валидатором)

  const res = await fetch(`/api/check-email?email=${encodeURIComponent(value)}`, {
    signal: options?.signal, // отмена запроса при следующей проверке
  });
  const { available } = (await res.json()) as { available: boolean };

  return available ? null : { code: 'emailTaken', message: 'Email уже зарегистрирован' };
};
```

## Подключение в схему

```typescript
import { createModel, createForm } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

const model = createModel<{ email: string }>({ email: '' });

const schema = {
  email: {
    value: model.$.email,
    component: Input,
    validators: [required(), email()], // синхронные — быстрый отсев
    asyncValidators: [checkEmailUnique], // асинхронные — серверная проверка
    debounce: 400, // задержка перед асинхронной валидацией (живой путь ноды)
    updateOn: 'blur', // когда запускать проверку поля
  },
};

const form = createForm({ model, schema });
```

:::info Порядок валидаторов
Под `validateFormModel` валидаторы поля идут по порядку в массиве, но прогоняются **все** —
включая асинхронные (раннего выхода при sync-ошибке нет), а ошибки агрегируются. Поэтому
async-валидатор обязан сам отсеивать пустые/невалидные значения (`if (!value) return null`), иначе
запрос уйдёт даже для незаполненного поля.
:::

## Debounce

Опция `debounce` (мс) на узле откладывает запуск асинхронной валидации до паузы во вводе — вместо
запроса на каждое нажатие клавиши:

```typescript
username: {
  value: model.$.username,
  component: Input,
  asyncValidators: [checkUsernameUnique],
  debounce: 500, // подождать 500 мс после остановки ввода
  updateOn: 'change',
},
```

:::note debounce/updateOn — про «живой» путь ноды
Опции `debounce` и `updateOn`, как и автоматическая отмена по `AbortController` ниже, действуют на
**реактивном пути поля** (когда значение меняется через ноду). При запуске **on-demand** через
`validateFormModel` (submit, шаг wizard, `revalidateWhen`) поле-узел валидаторы не троттлят. Для
дорогого async вне ввода дросселируйте запуск сами — через `revalidateWhen` + собственный debounce
(см. [Стратегии валидации](/docs/validation/validation-strategies)).
:::

## Отмена устаревших запросов

Когда значение меняется до завершения предыдущей проверки, ReFormer **автоматически отменяет**
устаревший запуск через `AbortController` — применяется только результат последней проверки.
Чтобы прервать и сам сетевой запрос, передайте `options.signal` в `fetch` (см. пример выше) и
игнорируйте `AbortError`:

```typescript
import type { AsyncValidatorFn } from '@reformer/core';

const hasResults: AsyncValidatorFn<string> = async (value, options) => {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`, {
      signal: options?.signal,
    });
    const results = (await res.json()) as unknown[];
    return results.length > 0 ? null : { code: 'noResults', message: 'Ничего не найдено' };
  } catch (e) {
    if ((e as Error).name === 'AbortError') return null; // устаревший запрос — молча выходим
    return { code: 'checkFailed', message: 'Не удалось выполнить проверку' };
  }
};
```

## Индикатор `pending`

Пока идёт асинхронная валидация, у поля активен сигнал `pending`. Читайте его через `useFormControl`:

```tsx
import { useFormControl } from '@reformer/core';

function UsernameField() {
  const { value, errors, pending, shouldShowError } = useFormControl(form.username);

  return (
    <div>
      <input value={value} onChange={(e) => form.username.setValue(e.target.value)} />
      {pending && <span>Проверяем…</span>}
      {shouldShowError && errors[0] && <span className="error">{errors[0].message}</span>}
    </div>
  );
}
```

## Проверка на submit

На отправке `validateFormModel(model, schema)` прогоняет **все** валидаторы, включая асинхронные
(параллельно, через `Promise.all`), и роутит ошибки в поля:

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  form.touchAll();

  const { valid } = await validateFormModel(model, schema);
  if (valid) await api.save(model.get());
};
```

:::warning Дождитесь результата
`validateFormModel` асинхронна — всегда `await`-айте её перед проверкой `valid`, иначе async-валидаторы
не успеют отработать и форма отправится с непроверенными данными.
:::

## Кросс-полевой async

Асинхронному валидатору, запущенному через `validateFormModel`, доступна корневая модель третьим
аргументом `root` — можно читать соседние поля:

```typescript
import type { ModelValidator, AsyncValidatorFn } from '@reformer/core';

const checkEmailForUser: ModelValidator<string, unknown, { userId: string }> = async (
  value,
  _scope,
  root
) => {
  const res = await fetch('/api/check-email', {
    method: 'POST',
    body: JSON.stringify({ email: value, userId: root.userId }),
  });
  const { valid } = (await res.json()) as { valid: boolean };
  return valid ? null : { code: 'emailInUse', message: 'Email уже занят' };
};

// email читает userId через root. Тип поля `asyncValidators` — AsyncValidatorFn (2 аргумента),
// а cross-field ModelValidator принимает 3, поэтому при добавлении в схему нужен явный каст:
email: {
  value: model.$.email,
  component: Input,
  asyncValidators: [checkEmailForUser as AsyncValidatorFn<string>],
},
```

## Дальше

- [Кастомные валидаторы](/docs/validation/custom) — синхронные правила и кросс-полевые проверки.
- [Стратегии валидации](/docs/validation/validation-strategies) — `updateOn`, debounce, пошаговые формы.
- [Обработка ошибок](/docs/validation/error-handling) — чтение и отображение ошибок.

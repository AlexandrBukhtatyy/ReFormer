---
sidebar_position: 3
---

# Асинхронная Валидация

Валидация на сервере или выполнение дорогих проверок.

## Базовый Асинхронный Валидатор

Асинхронный валидатор — это функция, возвращающая `Promise<ValidationError | null>`. Кладётся в
массив `asyncValidators` поля схемы:

```typescript
import { createModel, createForm, validateFormModel } from '@reformer/core';
import { required } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

const model = createModel<{ username: string }>({ username: '' });

const schema = {
  username: {
    value: model.$.username,
    component: Input,
    validators: [required()],
    asyncValidators: [
      async (value: string) => {
        const response = await fetch(`/api/check-username?name=${value}`);
        const { available } = await response.json();

        return available ? null : { code: 'usernameTaken', message: 'Имя пользователя занято' };
      },
    ],
  },
};

const form = createForm({ model, schema });

// Полная валидация формы (sync + async) прогоняет и асинхронные валидаторы:
const { valid, errors } = await validateFormModel(model, schema);
```

## Debouncing (Задержка)

Избегайте слишком большого количества запросов с помощью пофилдового `debounce` (мс).
Асинхронный валидатор запускается только после паузы во вводе:

```typescript
const schema = {
  username: {
    value: model.$.username,
    component: Input,
    asyncValidators: [
      async (value: string) => {
        const available = await checkUsername(value);
        return available ? null : { code: 'usernameTaken', message: 'Имя пользователя занято' };
      },
    ],
    debounce: 300, // Ждать 300мс после остановки ввода
  },
};
```

## Состояние Загрузки

Отслеживайте процесс асинхронной валидации через сигнал `pending` поля:

```typescript
const username = form.username;

username.pending.value; // true во время валидации
```

```tsx
import { useFormControl } from '@reformer/core';

function UsernameField() {
  const field = useFormControl(form.username);

  return (
    <div>
      <input value={field.value} onChange={(e) => field.setValue(e.target.value)} />
      {field.pending && <span>Проверка...</span>}
      {field.errors.find((e) => e.code === 'usernameTaken') && <span>Имя пользователя занято</span>}
    </div>
  );
}
```

## Асинхронная Валидация с Контекстом

Доступ к другим полям во время асинхронной валидации через `root`. Третий аргумент доступен,
когда валидатор запускается через `validateFormModel(model, schema)`:

```typescript
const checkEmail = async (value: string, _scope: unknown, root: { userId: string }) => {
  const userId = root.userId;

  const response = await fetch('/api/check-email', {
    method: 'POST',
    body: JSON.stringify({ email: value, userId }),
  });

  const { valid } = await response.json();
  return valid ? null : { code: 'emailInUse', message: 'Email уже используется' };
};

// Внутри схемы формы:
email: { value: model.$.email, component: Input, asyncValidators: [checkEmail] },

// root передаётся при валидации всей формы:
await validateFormModel(model, schema);
```

## Комбинирование Синхронной и Асинхронной

Синхронные валидаторы запускаются первыми. Асинхронные только если синхронные прошли:

```typescript
import { required, minLength } from '@reformer/core/validators';

const schema = {
  username: {
    value: model.$.username,
    component: Input,
    // Синхронно: выполняется сразу
    validators: [required(), minLength(3)],
    // Асинхронно: только если синхронные валидаторы прошли
    asyncValidators: [checkUsernameAvailable],
  },
};
```

## Следующие Шаги

- [Кастомные Валидаторы](/docs/validation/custom) — Создание переиспользуемых валидаторов
- [Поведения](/docs/behaviors/overview) — Условная валидация с поведениями
  </content>

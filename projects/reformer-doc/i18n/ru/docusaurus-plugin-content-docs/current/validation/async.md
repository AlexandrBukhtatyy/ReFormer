---
sidebar_position: 3
---

# Асинхронная Валидация

Валидация на сервере или выполнение дорогих проверок.

## Базовый Асинхронный Валидатор

```typescript
import { GroupNode } from '@reformer/core';
import { required } from '@reformer/core/validators';

const form = new GroupNode({
  form: {
    username: { value: '' },
  },
  validation: (path, { validateAsync }) => {
    required(path.username);

    validateAsync(path.username, async (value) => {
      const response = await fetch(`/api/check-username?name=${value}`);
      const { available } = await response.json();

      if (!available) {
        return { usernameTaken: true };
      }
      return null;
    });
  },
});
```

## Debouncing (Задержка)

Избегайте слишком большого количества запросов с помощью debounce:

```typescript
validation: (path, { validateAsync }) => {
  validateAsync(
    path.username,
    async (value) => {
      const available = await checkUsername(value);
      return available ? null : { usernameTaken: true };
    },
    { debounce: 300 } // Ждать 300мс после остановки ввода
  );
};
```

## Состояние Загрузки

Отслеживайте процесс асинхронной валидации:

```typescript
const username = form.controls.username;

username.pending.value; // true во время валидации
```

```tsx
function UsernameField() {
  const field = useFormControl(form.controls.username);

  return (
    <div>
      <input value={field.value} onChange={(e) => field.setValue(e.target.value)} />
      {field.pending && <span>Проверка...</span>}
      {field.errors?.usernameTaken && <span>Имя пользователя занято</span>}
    </div>
  );
}
```

## Асинхронная Валидация с Контекстом

Доступ к другим полям во время асинхронной валидации:

```typescript
validation: (path, { validateAsync }) => {
  validateAsync(path.email, async (value, ctx) => {
    const userId = ctx.form.userId.value.value;

    const response = await fetch('/api/check-email', {
      method: 'POST',
      body: JSON.stringify({ email: value, userId }),
    });

    const { valid } = await response.json();
    return valid ? null : { emailInUse: true };
  });
};
```

## Комбинирование Синхронной и Асинхронной

Синхронные валидаторы запускаются первыми. Асинхронные только если синхронные прошли:

```typescript
validation: (path, { validateAsync }) => {
  // Синхронно: выполняется сразу
  required(path.username);
  minLength(path.username, 3);

  // Асинхронно: только если синхронные валидаторы прошли
  validateAsync(path.username, checkUsernameAvailable);
};
```

## Следующие Шаги

- [Кастомные Валидаторы](/docs/validation/custom) — Создание переиспользуемых валидаторов
- [Поведения](/docs/behaviors/overview) — Условная валидация с поведениями

---
sidebar_position: 3
---

# Асинхронная валидация

Валидация на сервере или выполнение ресурсоёмких проверок.

## Базовый асинхронный валидатор

```typescript
import { GroupNode, FieldNode } from 'reformer';
import { required } from 'reformer/validators';

const form = new GroupNode({
  schema: {
    username: new FieldNode({ value: '' }),
  },
  validationSchema: (path, { validate, validateAsync }) => [
    validate(path.username, required()),
    validateAsync(path.username, async (value) => {
      const response = await fetch(`/api/check-username?name=${value}`);
      const { available } = await response.json();

      if (!available) {
        return { usernameTaken: true };
      }
      return null;
    }),
  ],
});
```

## Debounce

Избежание слишком частых запросов с помощью debounce:

```typescript
validateAsync(
  path.username,
  async (value) => {
    const available = await checkUsername(value);
    return available ? null : { usernameTaken: true };
  },
  { debounce: 300 } // Ждать 300мс после окончания ввода
)
```

## Состояние загрузки

Отслеживание выполнения асинхронной валидации:

```typescript
const username = form.controls.username;

username.pending; // true во время валидации
```

```tsx
function UsernameField() {
  const field = useFormControl(form.controls.username);

  return (
    <div>
      <input value={field.value} onChange={...} />
      {field.pending && <span>Проверка...</span>}
      {field.errors?.usernameTaken && <span>Имя занято</span>}
    </div>
  );
}
```

## Асинхронная валидация с контекстом

Доступ к другим полям во время асинхронной валидации:

```typescript
validateAsync(path.email, async (value, context) => {
  const userId = context.root.controls.userId.value;

  const response = await fetch('/api/check-email', {
    method: 'POST',
    body: JSON.stringify({ email: value, userId }),
  });

  const { valid } = await response.json();
  return valid ? null : { emailInUse: true };
})
```

## Комбинирование синхронной и асинхронной валидации

Синхронные валидаторы выполняются первыми. Асинхронные запускаются только если синхронные прошли:

```typescript
validationSchema: (path, { validate, validateAsync }) => [
  // Синхронно: выполняется сразу
  validate(path.username, required(), minLength(3)),

  // Асинхронно: только если синхронные валидаторы прошли
  validateAsync(path.username, checkUsernameAvailable),
]
```

## Следующие шаги

- [Кастомные валидаторы](/docs/validation/custom) — создание переиспользуемых валидаторов
- [Behaviors](/docs/behaviors/overview) — условная валидация с behaviors

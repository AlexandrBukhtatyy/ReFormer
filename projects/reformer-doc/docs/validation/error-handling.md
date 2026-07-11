---
sidebar_position: 6
---

# Обработка ошибок

Как устроен объект ошибки, чем `warning` отличается от `error`, как читать и фильтровать ошибки поля
и как централизованно обрабатывать исключения валидаторов.

## `ValidationError`

Любая ошибка валидации — это объект `ValidationError`:

```typescript
interface ValidationError {
  code: string; // машинный код: 'required', 'email', 'passwordMismatch', …
  message: string; // текст для пользователя
  params?: Record<string, FormValue>; // данные ошибки: { minLength: 8, actualLength: 3 }
  severity?: 'error' | 'warning'; // 'error' (по умолчанию) блокирует submit; 'warning' — нет
}
```

`code` — стабильный идентификатор для фильтрации и локализации; `message` — готовый текст (может быть
пустым, тогда его резолвят из `code`); `params` — контекст для подстановки в шаблон сообщения.

## `severity`: error и warning

- `severity: 'error'` (значение по умолчанию) — **блокирует** submit: делает поле `invalid`, а
  результат валидации — `valid: false`.
- `severity: 'warning'` — показывается пользователю, но **не блокирует** submit: `valid` остаётся
  `true`.

```typescript
// Мягкая подсказка — не мешает отправке
const weakPassword = (value: string) =>
  value && value.length < 12
    ? { code: 'weakPassword', message: 'Рекомендуем 12+ символов', severity: 'warning' as const }
    : null;
```

:::info Как считается `valid`
И движок данных (`validateModel`/`validateFormModel`), и статус поля выводят `valid` из наличия
**блокирующих** ошибок. Ошибки с `severity: 'warning'` в этот расчёт не входят — поэтому поле с одними
предупреждениями остаётся валидным.
:::

## Чтение ошибок

### В компоненте — `useFormControl`

Реактивный массив `errors` (плюс флаг `shouldShowError`):

```tsx
import { useFormControl } from '@reformer/core';

function Field() {
  const { errors, shouldShowError } = useFormControl(form.email);

  // Показывать ошибку только после взаимодействия
  return shouldShowError && errors[0] ? (
    <span className="error" role="alert">
      {errors[0].message}
    </span>
  ) : null;
}
```

### Из результата валидации

`validateFormModel` / `validateModel` возвращают ошибки по пути поля:

```typescript
const { valid, errors } = await validateFormModel(model, schema);
// errors: Record<string, ValidationError[]>
// { 'email': [{ code: 'emailTaken', message: '…' }], 'password': [ … ] }
```

### Фильтрация — `getErrors(options?)`

У любой ноды (`form.<field>`, группа, массив) есть метод `getErrors` с фильтром `ErrorFilterOptions`:

```typescript
interface ErrorFilterOptions {
  code?: string | string[]; // по коду (одному или нескольким)
  message?: string; // частичное совпадение по тексту (регистронезависимо)
  params?: Record<string, FormValue>; // по значениям params
  predicate?: (error: ValidationError) => boolean; // произвольный предикат
}
```

```typescript
form.password.getErrors(); // все ошибки поля
form.password.getErrors({ code: 'required' }); // только required
form.password.getErrors({ code: ['required', 'minLength'] }); // несколько кодов
form.password.getErrors({ params: { minLength: 8 } }); // по params
form.password.getErrors({ predicate: (e) => e.severity === 'warning' }); // только предупреждения
```

Без аргументов `getErrors()` возвращает все ошибки — эквивалент `form.password.errors.value`.

## Серверные ошибки

Бизнес-ошибки, пришедшие с сервера, кладут в поле напрямую через `setErrors` — форму при этом **не**
сбрасывают:

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  form.touchAll();

  const { valid } = await validateFormModel(model, schema);
  if (!valid) return;

  try {
    const res = await api.register(model.get());
    if (res.success) {
      model.reset();
    } else {
      // Серверная ошибка — показываем в конкретном поле
      form.email.setErrors([{ code: 'emailTaken', message: res.message }]);
    }
  } catch (err) {
    showToast(`Ошибка сети: ${(err as Error).message}`);
  }
};
```

`setErrors([])` очищает ошибки поля вручную (например, при повторной отправке).

## Централизованная обработка исключений

Если валидатор (обычно асинхронный) **бросает** исключение, его можно провести через
`FormErrorHandler.handle(error, context, strategy)` — единая точка логирования и выбора стратегии.
Стратегии заданы enum `ErrorStrategy`:

| Стратегия               | Поведение                                                        |
| ----------------------- | ---------------------------------------------------------------- |
| `ErrorStrategy.THROW`   | залогировать и пробросить дальше (критичная ошибка)              |
| `ErrorStrategy.LOG`     | залогировать и продолжить (некритичная)                          |
| `ErrorStrategy.CONVERT` | залогировать и вернуть `ValidationError` (для async-валидаторов) |

```typescript
import { FormErrorHandler, ErrorStrategy } from '@reformer/core';
import type { AsyncValidatorFn } from '@reformer/core';

const checkUnique: AsyncValidatorFn<string> = async (value, options) => {
  try {
    const res = await fetch(`/api/check?value=${value}`, { signal: options?.signal });
    const { available } = (await res.json()) as { available: boolean };
    return available ? null : { code: 'taken', message: 'Значение уже занято' };
  } catch (error) {
    // Превращаем неожиданное исключение в отображаемую ошибку валидации
    return FormErrorHandler.handle(error, 'checkUnique', ErrorStrategy.CONVERT);
  }
};
```

:::info Встроенная защита async-валидаторов
Реактивный запуск async-валидаторов уже оборачивает исключения через
`FormErrorHandler` (`CONVERT`), поэтому упавший запрос превращается в `ValidationError`
(`code: 'validator_error'`), а не роняет форму. Ручной вызов нужен, когда вы хотите свой `context`
или другую стратегию. Отмена устаревшего запроса (`AbortError`) при этом обрабатывается отдельно и
ошибкой не считается.
:::

Вспомогательные методы `FormErrorHandler`:

```typescript
FormErrorHandler.createValidationError('required', 'Обязательное поле', 'email');
// { code: 'required', message: 'Обязательное поле', params: { field: 'email' } }

FormErrorHandler.isValidationError(value); // type guard: value is ValidationError
```

## Доступность

Связывайте сообщение с полем через ARIA — так ошибку озвучат скринридеры:

```tsx
function Field() {
  const { value, errors, shouldShowError } = useFormControl(form.email);
  const errorId = 'email-error';

  return (
    <div>
      <input
        id="email"
        value={value}
        onChange={(e) => form.email.setValue(e.target.value)}
        onBlur={() => form.email.markAsTouched()}
        aria-invalid={shouldShowError}
        aria-describedby={shouldShowError ? errorId : undefined}
      />
      {shouldShowError && errors[0] && (
        <span id={errorId} role="alert" className="error">
          {errors[0].message}
        </span>
      )}
    </div>
  );
}
```

## Дальше

- [Стратегии валидации](/docs/validation/validation-strategies) — когда и как запускать проверки.
- [Кастомные валидаторы](/docs/validation/custom) — коды ошибок, `params`, `severity`.
- [Асинхронная валидация](/docs/validation/async) — серверные проверки и отмена запросов.

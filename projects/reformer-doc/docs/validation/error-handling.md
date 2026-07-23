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
И раннер `validateModel`, и статус поля выводят `valid` из наличия **блокирующих** ошибок. Ошибки с
`severity: 'warning'` в этот расчёт не входят — поэтому поле с одними предупреждениями остаётся
валидным (`validateModel` возвращает `true`, а предупреждение всё равно показывается пользователю).
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

### После прогона `validateModel`

Раннер `validateModel(model, schema)` возвращает `Promise<boolean>` (нет блокирующих ошибок), а сами
ошибки **разносит по нодам формы** — из результата их доставать не нужно, они уже лежат на полях:

```typescript
import { validateModel } from '@reformer/core/validation';

const valid = await validateModel(model, schema); // Promise<boolean>

// Ошибки уже на нодах — читаем их с конкретного поля:
form.email.getErrors(); // ValidationError[] этого поля
form.email.errors.value; // тот же массив, реактивно
```

Если ноды формы под рукой нет, а есть только сигнал модели, ту же ноду достаёт `getNodeForSignal`:

```typescript
import { getNodeForSignal } from '@reformer/core';

getNodeForSignal(model.$.email)?.getErrors(); // ValidationError[] | undefined
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

  const valid = await validateModel(model, schema);
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
import type { AsyncRule } from '@reformer/core/validation';

// Регистрируется в схеме через validateAsync(model.$.value, [checkUnique])
const checkUnique: AsyncRule<string> = async (value, { signal }) => {
  try {
    const res = await fetch(`/api/check?value=${value}`, { signal });
    const { available } = (await res.json()) as { available: boolean };
    return available ? null : { code: 'taken', message: 'Значение уже занято' };
  } catch (error) {
    // Превращаем неожиданное исключение в отображаемую ошибку валидации
    return FormErrorHandler.handle(error, 'checkUnique', ErrorStrategy.CONVERT);
  }
};
```

:::info Сбой async-правила не блокирует submit
Раннер `validateModel` дожидается async-правил и **проглатывает** отклонённый промис — брошенное
исключение или сетевой сбой не роняют форму и `validateModel` не возвращает из-за них `false`. Поэтому
решение принимаете внутри самого правила: поймайте исключение и верните `null`, если сбой не должен
мешать отправке, — либо `FormErrorHandler.handle(error, 'checkUnique', ErrorStrategy.CONVERT)`, если ошибку нужно
показать пользователю как `ValidationError` (`code: 'validator_error'`). Отмену устаревшего прогона
(`AbortError`) раннер делает сам через `AbortSignal` и ошибкой не считает.
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

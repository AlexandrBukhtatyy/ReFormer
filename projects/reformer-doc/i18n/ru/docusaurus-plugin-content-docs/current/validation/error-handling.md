---
sidebar_position: 6
---

# Обработка ошибок

Как устроено замечание валидации, чем `warning` отличается от `error`, как читать и фильтровать
замечания поля, как показывать серверные ошибки и что делать со сбоем асинхронного правила.

## `ValidationIssue`

Любое замечание валидации — это объект `ValidationIssue`:

```typescript
interface ValidationIssue {
  code: string; // встроенный код ('required', 'email') или свой ('password.mismatch')
  params?: Record<string, unknown>; // значения для текста: { minLength: 8, actualLength: 3 }
  severity?: 'error' | 'warning'; // 'error' (по умолчанию) блокирует отправку; 'warning' — нет
}
```

`code` — стабильный идентификатор для фильтрации и поиска текста; `params` — значения для подстановки
в шаблон текста. Самого текста в замечании нет: его находит резолвер при показе — словарь формы
`defineIssueMessages` → словарь локали → встроенный английский → сам `code` (см.
[Тексты замечаний](/docs/validation/overview#тексты-замечаний)).

## `severity`: error и warning

- `severity: 'error'` (значение по умолчанию) — **блокирует** отправку: делает поле `invalid`, а
  прогон — `status: 'invalid'`.
- `severity: 'warning'` — показывается пользователю, но **не блокирует** отправку: поле остаётся
  `valid`, прогон — `status: 'valid'`.

```typescript
import type { Rule } from '@reformer/core/validation';

// Мягкая подсказка — не мешает отправке
const weakPassword: Rule<string> = (value) =>
  value && value.length < 12 ? { code: 'weakPassword', severity: 'warning' } : null;
```

:::info Как считается `valid`
И статус прогона, и флаги поля выводятся из наличия **блокирующих** замечаний. Замечания с
`severity: 'warning'` в этот расчёт не входят — поэтому поле с одними предупреждениями остаётся
валидным, `bundle.submit` вызывает обработчик, а предупреждение всё равно показывается.
:::

## Чтение замечаний

### В компоненте — `useFormControl`

Реактивный массив `issues` (плюс флаг `shouldShowIssues`); текст — через `useIssueMessage`:

```tsx
import { useFormControl, useIssueMessage } from '@reformer/core/react';

function EmailIssue() {
  const { issues, shouldShowIssues } = useFormControl(form.email);
  const message = useIssueMessage();

  // Показывать замечание только после взаимодействия
  return shouldShowIssues && issues[0] ? (
    <span className="error" role="alert">
      {message(issues[0])}
    </span>
  ) : null;
}
```

Внутри `ValidationMessagesProvider` (`@reformer/cdk`) текст с учётом словаря формы даёт
`useIssueMessageResolver()` — им пользуется `FormField`.

### После прогона

`bundle.validate()` возвращает `ValidationResult`, а сами замечания **разносит по нодам формы** —
они уже лежат на полях:

```typescript
const result = await bundle.validate(); // ValidationResult

result.status; // 'valid' | 'invalid' | 'error' | 'cancelled'
result.issues.get(model.$.email); // замечания поля по его ручке
form.email.issues.value; // те же замечания на ноде, реактивно
form.issues.value; // замечания всей формы: свои и всех полей
```

Если ноды под рукой нет, а есть только ручка модели, ту же ноду достаёт `getNodeForSignal`:

```typescript
import { getNodeForSignal } from '@reformer/core';

getNodeForSignal(model.$.email)?.issues.value; // readonly ValidationIssue[] | undefined
```

### Фильтрация

Отдельного метода-фильтра у ноды нет: `issues` — обычный массив, фильтруйте его как массив.

```typescript
const issues = form.password.issues.value;

issues.filter((issue) => issue.code === 'required'); // только required
issues.filter((issue) => ['required', 'minLength'].includes(issue.code)); // несколько кодов
issues.filter((issue) => issue.params?.minLength === 8); // по params
issues.filter((issue) => issue.severity === 'warning'); // только предупреждения
```

## Серверные ошибки

Бизнес-ошибки, пришедшие с сервера, кладут в поле напрямую через `setIssues` — форму при этом
**не** сбрасывают. Удобнее всего — в обработчике `bundle.submit`:

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  const outcome = await bundle.submit(async (values) => {
    const res = await api.register(values);
    if (!res.success) {
      // Серверная ошибка — показываем в конкретном поле
      form.email.setIssues([{ code: 'emailTaken' }]);
      form.email.markAsTouched();
    }
    return res;
  });

  if (outcome.status === 'submitted' && outcome.result.success) model.reset();
  if (outcome.status === 'failed') showToast('Ошибка сети, попробуйте ещё раз');
};
```

Если обработчик бросил исключение, `submit` не пробрасывает его, а возвращает
`{ status: 'failed', error }`. `form.email.clearIssues()` (или `setIssues([])`) очищает замечания
поля вручную; следующий прогон правил тоже перезапишет их.

## Сбой асинхронного правила

Если async-правило **бросает** исключение или его промис отклоняется (сеть, 500), прогон не
считает это «замечаний нет»:

- статус прогона — `error`, сбой — в `result.failures` (`{ handle, error }`);
- поле получает блокирующее замечание `ruleFailed` — у него есть текст в словаре локали;
- `bundle.submit` обработчик не вызывает и возвращает `{ status: 'error', validation }`.

```typescript
const result = await bundle.validate();
if (result.status === 'error') {
  for (const { handle, error } of result.failures) {
    console.warn(`Правило поля ${handle.__path} не отработало`, error);
  }
  showToast('Не удалось проверить форму, повторите попытку');
}
```

Если сбой сервиса не должен мешать отправке, поймайте ошибку внутри правила и верните `null`; если
нужен свой текст — верните своё замечание (`{ code: 'checkUnavailable' }`). Отмену устаревшего
прогона (`AbortError`) прогон делает сам через `AbortSignal` и сбоем не считает.

:::note Прежний контракт
Удалены: `getErrors()` / `ErrorFilterOptions` (→ фильтр массива `issues`), `FormErrorHandler` /
`ErrorStrategy` (→ статус прогона `error`, `result.failures` и замечание `ruleFailed`), поле `message`
в замечании (→ словарь `defineIssueMessages`), `errors` / `setErrors` / `clearErrors` ноды
(→ `issues` / `setIssues` / `clearIssues`).
:::

## Доступность

Связывайте текст замечания с полем через ARIA — так его озвучат скринридеры:

```tsx
function EmailField() {
  const { value, issues, shouldShowError, shouldShowIssues } = useFormControl(form.email);
  const message = useIssueMessage();
  const errorId = 'email-error';

  return (
    <div>
      <input
        id="email"
        value={value}
        onChange={(e) => form.email.setValue(e.target.value)}
        onBlur={() => form.email.markAsTouched()}
        aria-invalid={shouldShowError}
        aria-describedby={shouldShowIssues ? errorId : undefined}
      />
      {shouldShowIssues && issues[0] && (
        <span id={errorId} role="alert" className="error">
          {message(issues[0])}
        </span>
      )}
    </div>
  );
}
```

## Дальше

- [Стратегии валидации](/docs/validation/validation-strategies) — когда и как запускать проверки.
- [Кастомные валидаторы](/docs/validation/custom) — коды замечаний, `params`, `severity`.
- [Асинхронная валидация](/docs/validation/async) — серверные проверки и отмена запросов.

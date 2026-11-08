---
sidebar_position: 6
---

# Обработка ошибок

Как читать [замечания](../reference/glossary.md) поля, показывать их своим компонентом, класть в
поле ошибку сервера и отличать замечания от сбоя проверки.

## Когда нужно

- Своя разметка поля вместо `FormField`: нужен список замечаний и их текст.
- Сервер отклонил данные — ошибку нужно показать у конкретного поля.
- Асинхронное правило не ответило — форму не удалось проверить.

## Пример

Ошибка сервера кладётся в поле методом `setIssues` прямо в обработчике отправки:

```tsx
const handleSubmit = async (event: React.FormEvent) => {
  event.preventDefault();
  const outcome = await signup.submission.submit(async (values) => {
    const reply = await api.register(values);
    // Ошибка сервера — замечание на поле; значения не трогаем.
    if (reply.error === 'EMAIL_TAKEN') signup.form.email.setIssues([{ code: 'email.taken' }]);
    return reply;
  });

  if (outcome.status === 'submitted' && outcome.result.ok) signup.form.reset();
  if (outcome.status === 'error') showToast('Не удалось проверить форму, повторите попытку');
  if (outcome.status === 'failed') showToast('Сервер недоступен, попробуйте ещё раз');
};
```

Живой пример этого приёма — в [Отправке и сбросе](../patterns/submit-and-reset.mdx#ошибка-сервера-в-поле).
Код `email.taken` получает текст из словаря формы `defineIssueMessages`, как любой свой код.

## Замечание

```typescript
interface ValidationIssue {
  code: string; // встроенный код ('required', 'email') или свой ('email.taken')
  params?: Record<string, unknown>; // значения для текста: { minLength: 8, actualLength: 3 }
  severity?: 'error' | 'warning'; // 'error' по умолчанию
}
```

- `code` — по нему ищется текст и фильтруются замечания.
- `params` — значения, которые шаблон текста подставит в строку.
- `severity` — важность. `error` делает поле невалидным и блокирует отправку. `warning`
  показывается, но поле остаётся валидным, а отправка проходит.

## Чтение замечаний

### В компоненте

`useFormControl` возвращает замечания поля и флаг «пора показать». Текст по коду даёт
`useIssueMessageResolver()` из `@reformer/cdk` — он учитывает словарь формы от
`ValidationMessagesProvider`. Без cdk — `useIssueMessage(messages)` из `@reformer/core/react`.

```tsx
import { useFormControl } from '@reformer/core/react';
import { useIssueMessageResolver } from '@reformer/cdk';

function EmailIssue() {
  const { issues, shouldShowIssues } = useFormControl(form.email);
  const message = useIssueMessageResolver();

  // Показываем, только когда поле трогали или меняли.
  return shouldShowIssues && issues[0] ? <span role="alert">{message(issues[0])}</span> : null;
}
```

### Вне компонента

Замечания лежат в нодах формы: проверка сама записывает их туда.

```typescript
const result = await bundle.validate();

result.status; // 'valid' | 'invalid' | 'error' | 'cancelled'
result.issues.get(model.$.email); // замечания поля в результате проверки
form.email.issues.value; // те же замечания в ноде поля
form.issues.value; // замечания формы и всех её полей
```

Если под рукой только сигнал поля модели, ноду найдёт `getNodeForSignal` из `@reformer/core`:

```typescript
import { getNodeForSignal } from '@reformer/core';

getNodeForSignal(model.$.email)?.issues.value;
```

### Фильтрация

`issues` — обычный массив, фильтруйте его как массив:

```typescript
const issues = form.password.issues.value;

issues.filter((issue) => issue.code === 'required'); // по коду
issues.filter((issue) => issue.severity === 'warning'); // только предупреждения
issues.filter((issue) => issue.params?.minLength === 8); // по параметрам
```

## Ошибки сервера

- `form.<поле>.setIssues([...])` — положить замечания в поле. Форму не сбрасывайте: пользователь
  исправит значение.
- `form.<поле>.clearIssues()` — снять замечания вручную.
- Следующая проверка правил поля заменит замечание сервера своим результатом. Со стратегией
  `change` или `afterFirstSubmit` это случится, как только пользователь исправит значение.
- Если обработчик отправки бросил исключение, `submission.submit` его не пробрасывает, а
  возвращает `{ status: 'failed', error }`.

## Сбой асинхронного правила

Если асинхронное правило бросило исключение или его промис отклонён, проверка не считает это «замечаний
нет»:

- статус — `error`, причины — в `result.failures`: пары `{ handle, error }`;
- поле получает блокирующее замечание `ruleFailed` — у него есть текст в словаре локали;
- `submission.submit` не вызывает обработчик, возвращает `{ status: 'error', validation }` и
  отмечает тронутой всю форму, как при `invalid`.

```typescript
const result = await bundle.validate();
if (result.status === 'error') {
  for (const { error } of result.failures) console.warn('Правило не ответило', error);
  showToast('Не удалось проверить форму, повторите попытку');
}
```

Если сбой сервиса не должен мешать отправке, поймайте ошибку в правиле и верните `null` — см.
[Асинхронную валидацию](./async.mdx#сбой-правила). Отмена устаревшей проверки сбоем не считается.

## Доступность

Свяжите текст замечания с полем через ARIA — тогда его прочитает скринридер:

```tsx
function EmailField() {
  const { value, issues, shouldShowError, shouldShowIssues } = useFormControl(form.email);
  const message = useIssueMessageResolver();

  return (
    <div>
      <input
        id="email"
        value={value}
        onChange={(event) => form.email.setValue(event.target.value)}
        onBlur={() => form.email.markAsTouched()}
        aria-invalid={shouldShowError}
        aria-describedby={shouldShowIssues ? 'email-issue' : undefined}
      />
      {shouldShowIssues && issues[0] && (
        <span id="email-issue" role="alert">
          {message(issues[0])}
        </span>
      )}
    </div>
  );
}
```

- `shouldShowError` — поле невалидно и его трогали или меняли: для `aria-invalid` и красной рамки.
- `shouldShowIssues` — есть замечания, ошибки или предупреждения, и поле трогали или меняли: пора
  показать текст.

`FormField` из `@reformer/ui-kit` делает всё это сам.

## Подводные камни

- **Предупреждение не блокирует.** Если обработчик вызвался, а у поля висит замечание, проверьте
  его `severity`.
- **`setIssues` — не правило.** Замечание сервера живёт до следующей проверки поля; на повторную
  отправку оно не влияет, если сервер не вернёт его снова.
- **`error` — не `invalid`.** При `error` у полей может не быть замечаний правил — только `ruleFailed`.
  Покажите пользователю, что проверку стоит повторить.

## См. также

- [Обзор валидации](./overview.mdx) — правила, прогон и тексты замечаний.
- [Отправка и сброс](../patterns/submit-and-reset.mdx) — итоги отправки и сброс формы.
- [Свои компоненты полей](../react/custom-fields.md) — поле на `useFormControl`.
- [Локализация](/docs/guides/localization) — тексты замечаний и порядок их поиска.
- [Тестирование форм](/docs/guides/testing) — проверка замечаний в тестах.

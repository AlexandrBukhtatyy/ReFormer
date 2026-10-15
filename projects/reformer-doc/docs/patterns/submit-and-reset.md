---
sidebar_position: 3
---

# Отправка и сброс

Отправка — отдельный объект **уровня формы** сборки `createForm`: `bundle.submission`. Его
`submit(handler)` один раз прогоняет все правила формы и зовёт обработчик со значениями модели,
только если блокирующих замечаний нет; сигнал `submitting` говорит, идёт ли обработчик. Правила
живут отдельно от разметки — в `validation` и в шагах `flow` сборки; при отказе отправка сама
помечает форму тронутой, и UI подсвечивает ошибки. Сброс — `form.reset()` либо `model.reset()`, в
зависимости от того, к чему нужно вернуться.

## Жизненный цикл отправки

`bundle.submission.submit(handler)`:

1. прогоняет полный набор правил — `validation` сборки плюс правила шагов `flow` (включая
   async-правила);
2. при отказе (`invalid`, `error`) помечает тронутой всю форму — видны замечания и тех полей,
   которых правила не касались, — и возвращает результат проверки; `handler` не вызывается;
3. при успехе зовёт `handler(model.get())` и возвращает его результат; тронутыми помечены только
   поля, которые проверили правила.

Это попытка отправки: стратегия `afterFirstSubmit` после неё переходит в живую фазу. Проверка без
отправки — `bundle.validate()` — фазу не меняет (см.
[Стратегии валидации](../validation/validation-strategies)).

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';
import { FormField, Input, Button } from '@reformer/ui-kit';

type SignupForm = { name: string; email: string };

// Правила — отдельная схема над моделью. Стабильная ссылка уровня модуля: по ней сборка
// отменяет устаревшие прогоны.
const signupRules = defineValidation<SignupForm>(({ model }) => {
  validate(model.$.name, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
});

export function SignupForm() {
  // useFormBundle зовёт фабрику ровно один раз и держит сборку стабильной между рендерами.
  const bundle = useFormBundle(() =>
    createForm<SignupForm>({
      initial: { name: '', email: '' },
      schema: (model) => ({
        children: [
          { model: model.$.name, component: Input, componentProps: { label: 'Имя' } },
          { model: model.$.email, component: Input, componentProps: { label: 'Email' } },
        ],
      }),
      validation: signupRules,
    })
  );
  const { form } = bundle;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const outcome = await bundle.submission.submit((values) => api.signup(values));
    if (outcome.status === 'submitted') form.reset(); // чистый старт после успеха
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField control={form.name} />
      <FormField control={form.email} />
      <Button type="submit">Отправить</Button>
    </form>
  );
}
```

:::warning Всегда `await` перед проверкой результата
`submission.submit` асинхронен — он дожидается async-правил и самого обработчика. Читайте результат
только после `await`.
:::

:::info Правила ≠ разметка
`schema` сборки — дерево разметки: привязка полей к компонентам, без валидаторов. Правила —
`defineValidation` в поле `validation` (или в шагах `flow`). Подробнее —
[Обзор валидации](../validation/overview).
:::

## SubmitResult

`submission.submit` не бросает: и замечания, и исключение обработчика приходят вариантом результата.

```typescript
type SubmitResult<R> =
  | { status: 'submitted'; result: R } // обработчик отработал
  | { status: 'invalid' | 'error' | 'cancelled'; validation: ValidationResult } // обработчик не вызывался
  | { status: 'failed'; error: unknown }; // обработчик бросил исключение
```

| `status`    | Что произошло                                                                       | Какие поля тронуты    |
| ----------- | ----------------------------------------------------------------------------------- | --------------------- |
| `submitted` | правила прошли, обработчик вернул `result`                                          | проверенные правилами |
| `invalid`   | есть блокирующие замечания (`severity: 'warning'` отправку не блокирует)            | вся форма             |
| `error`     | правило не вернуло результат (например, упал async-запрос проверки)                 | вся форма             |
| `cancelled` | прогон отменён более новым, модель изменилась, пока шла проверка, либо сборку сняли | форма не помечается   |
| `failed`    | правила прошли, но обработчик бросил исключение — оно в `error`                     | проверенные правилами |

`validation` — полный `ValidationResult` прогона: по нему можно, например, перевести визард на шаг
с первой ошибкой.

## Серверные ошибки и сбои

Обработчик отправки — обычная async-функция: в нём удобно разобрать ответ сервера. Бизнес-ошибку
кладите в поле через `setIssues` — код замечания получает текст из словаря формы
(`defineIssueMessages` + `ValidationMessagesProvider messages`). Значения при ошибке не
сбрасывайте.

```tsx
import { defineIssueMessages } from '@reformer/core/i18n';

export const signupMessages = defineIssueMessages({
  'email.taken': 'Этот email уже зарегистрирован',
});

const handleSubmit = async (event: React.FormEvent) => {
  event.preventDefault();
  const outcome = await bundle.submission.submit(async (values) => {
    const response = await api.signup(values);
    // бизнес-ошибка сервера — показываем на поле, значения не трогаем
    if (response.code === 'EMAIL_TAKEN') form.email.setIssues([{ code: 'email.taken' }]);
    return response;
  });

  if (outcome.status === 'submitted' && outcome.result.success) form.reset();
  if (outcome.status === 'failed') showToast('Сервер недоступен — попробуйте ещё раз');
};
```

## Индикация отправки

Сборка держит сигналы `bundle.submission.submitting` (идёт ли обработчик) и `bundle.validating`
(идёт ли проверка). Готового хука для произвольного сигнала в `@reformer/core` нет: в React сигнал
читают подпиской `useSyncExternalStore` — так же, как это делают хуки ядра:

```tsx
import { useSyncExternalStore } from 'react';
import type { FormBundle } from '@reformer/core';
import type { ReadonlySignal } from '@reformer/core/signals';

// Свой хелпер приложения: подписка на сигнал и снимок его значения.
function useSignalSnapshot<T>(source: ReadonlySignal<T>): T {
  return useSyncExternalStore(
    (onChange) => source.subscribe(() => onChange()),
    () => source.peek(),
    () => source.peek() // SSR: снимок без подписки
  );
}

function SubmitButton({ bundle }: { bundle: FormBundle<SignupForm> }) {
  const submitting = useSignalSnapshot(bundle.submission.submitting);
  const validating = useSignalSnapshot(bundle.validating);
  const busy = submitting || validating;
  return (
    <Button type="submit" disabled={busy}>
      {busy ? 'Отправка…' : 'Отправить'}
    </Button>
  );
}
```

Визард (`FormWizard`) делает это сам: кнопки блокируются на время проверки и отправки.

## Сброс формы

Значениями владеет модель, состоянием полей (замечания, `touched`, `dirty`) — ноды формы. Поэтому
сброса два:

| Вызов                    | Что делает                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `form.reset()`           | значения — к тем, с которыми форма создана; замечания, `touched` и `dirty` сброшены                   |
| `form.reset(values)`     | то же, но к переданным значениям                                                                      |
| `model.reset()`          | значения — к снимку модели (`createModel` или последний `captureInitial()`); состояние нод не трогает |
| `model.captureInitial()` | зафиксировать текущие значения как новый снимок модели                                                |
| `model.isDirty()`        | отличаются ли значения от снимка модели                                                               |

Чистый старт после успешной отправки — `form.reset()`. Если данные пришли с сервера
(`model.patch(...)` + `model.captureInitial()`), «вернуть как было загружено» — это `model.reset()`
плюс очистка состояния полей:

```tsx
import type { FormBundle } from '@reformer/core';

function ResetButton({ bundle }: { bundle: FormBundle<SignupForm> }) {
  const handleReset = () => {
    if (!bundle.model.isDirty()) return; // нечего сбрасывать
    if (!confirm('Отменить изменения?')) return;
    bundle.model.reset(); // значения — к загруженному снимку
    bundle.form.clearIssues(); // замечания — прочь
    bundle.form.markAsUntouched(); // ошибки не показываются, пока поле снова не тронут
  };

  return (
    <Button type="button" onClick={handleReset}>
      Отменить изменения
    </Button>
  );
}
```

:::warning `form.reset()` после загрузки данных
`form.reset()` возвращает ноды к значениям, с которыми форма **создана**, — загруженные позже данные
он затрёт. Чтобы вернуть загруженное, зовите `model.reset()` (после `captureInitial()`) и чистите
состояние полей, как выше.
:::

## Снятие сборки — `bundle.dispose()`

Владелец сборки — тот, кто вызвал `createForm`. Вне React (тесты, сервер, своя оболочка) сборку
снимают, когда форма больше не нужна: `bundle.dispose()` снимает поведение формы, подписки нод и
живую проверку, а идущие проверки — полная, шага, отправки — получают `cancelled`, и их замечания на
ноды не ложатся. Значения модели остаются; повторный вызов ничего не делает.

```typescript
import { createForm } from '@reformer/core';

const signup = createForm<SignupForm>({
  initial: { name: '', email: '' },
  validation: signupRules,
});
try {
  const outcome = await signup.submission.submit((values) => api.signup(values));
  expect(outcome.status).toBe('invalid');
} finally {
  signup.dispose();
}
```

- Форму из `createFormFromModel` (без сборки) снимает `disposeForm(form)` — поведение и подписки
  нод.
- `useFormBundle` при размонтировании снимает только живую проверку, которую сам армировал;
  сборку целиком он не снимает.

:::info Прежний контракт
`form.submit()`, `form.submitWithResult()`, сигнал `form.submitting`, `form.touchAll()`, `form.validate()`
и `SubmitOptions` (`skipValidation`, `skipTouch`) удалены. Отправка —
`bundle.submission.submit(handler)` с `SubmitResult`, отметка полей — `form.markAsTouched()`,
проверка без отправки — `bundle.validate()`. Метода `bundle.submit` и сигнала `bundle.submitting` у
сборки тоже нет — это `bundle.submission`. Отправку без сборки строит низкоуровневый
`createSubmission({ check, values })`: с `check: undefined` обработчик получает `values()` без
проверки.
:::

## Дальше

- [Модель данных](../core-concepts/model) — `get` / `patch` / `reset` / `captureInitial`.
- [Валидация](../validation/overview) — правила, коды замечаний и тексты.
- [Асинхронная предзагрузка](./async-preload) — загрузка значений с сервера.

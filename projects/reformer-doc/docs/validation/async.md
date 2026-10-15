---
sidebar_position: 3
---

# Асинхронная валидация

Для проверок, требующих сервера — уникальность email, валидация ИНН, доступность имени — служат
**асинхронные правила**. Они описываются оператором `validateAsync` в схеме валидации и прогоняются
вместе с остальными правилами по требованию: на отправке, на шаге потока, по живой стратегии.

## Контракт

Асинхронное правило — функция `(value, { signal }) => Promise<ValidationIssue | null>`. Второй
аргумент — контекст с `signal: AbortSignal` для отмены устаревших запросов. Тип — `AsyncRule<T>`
из `@reformer/core/validation`:

```typescript
import type { AsyncRule } from '@reformer/core/validation';

const usernameAvailable: AsyncRule<string> = async (value, { signal }) => {
  if (!value || value.length < 3) return null; // пусто/коротко = валидно (обязательность — sync-правилом)

  const res = await fetch(`/api/check-username?u=${encodeURIComponent(value)}`, {
    signal, // отмена сетевого запроса при следующем прогоне
  });
  const { available } = (await res.json()) as { available: boolean };
  return available ? null : { code: 'usernameTaken' };
};
```

## Сбой правила

Отклонённое правило (сеть, 500, таймаут, исключение) — это **сбой проверки**, а не «замечаний нет»:

- прогон получает статус `error`, а сбой попадает в `ValidationResult.failures` (`{ handle, error }`);
- поле получает блокирующее замечание `ruleFailed` (текст — из словаря локали: «Не удалось проверить
  поле. Повторите попытку»);
- `bundle.submission.submit(handler)` обработчик не вызывает и возвращает
  `{ status: 'error', validation }`.

Отмена устаревшего прогона (`AbortError` прерванного `fetch`) сбоем не считается.

Если недоступность сервиса **не должна** мешать отправке, это решение автора правила: поймайте
ошибку и верните `null`.

```typescript
const usernameAvailableSoft: AsyncRule<string> = async (value, { signal }) => {
  if (!value) return null;
  try {
    const res = await fetch(`/api/check-username?u=${encodeURIComponent(value)}`, { signal });
    const { available } = (await res.json()) as { available: boolean };
    return available ? null : { code: 'usernameTaken' };
  } catch {
    return null; // сервис недоступен — не блокируем отправку
  }
};
```

## Подключение в схему

Правила не живут в схеме формы: `createForm({ schema })` несёт только разметку. Правила — отдельная
`ValidationDefinition`, где синхронный `validate` даёт быстрый отсев, а `validateAsync` — серверную
проверку:

```typescript
import { createForm } from '@reformer/core';
import { defineValidation, validate, validateAsync } from '@reformer/core/validation';
import { required, minLength } from '@reformer/core/validators';

type SignupForm = { username: string };

const signupValidation = defineValidation<SignupForm>(({ model }) => {
  validate(model.$.username, [
    required({ code: 'username.required' }),
    minLength(3, { code: 'username.minLength' }),
  ]);
  validateAsync(model.$.username, [usernameAvailable]); // серверная проверка
});

const signup = createForm<SignupForm>({
  initial: { username: '' },
  validation: signupValidation,
});

// Прогон по требованию (дожидается async-правил):
const result = await signup.validate(); // 'valid' | 'invalid' | 'error' | 'cancelled'
```

:::info `validate` и `validateAsync` независимы
Это два разных оператора одного поля, а не один массив. Sync-замечание **не отменяет** async-правило:
прогон регистрирует оба и дожидается асинхронного, замечания агрегируются. Поэтому async-правило
обязано само отсеивать пустые/невалидные значения (`if (!value) return null`), иначе запрос уйдёт и
для незаполненного поля.
:::

## Живая проверка и debounce

У правил нет опций `debounce` / `updateOn`: момент прогона выбирает **стратегия** валидации сборки.
Чтобы гонять async «вживую», пока пользователь печатает, включите стратегию `change` с паузой:

```typescript
const signup = createForm<SignupForm>({
  initial: { username: '' },
  validation: { rules: signupValidation, strategy: 'change', debounce: 500 },
});
```

В React живую стратегию армирует `useFormBundle`. Для формы без сборки то же даёт хук
`useFormValidation({ model, schema, strategy, debounce })`. Подробнее — в
[Стратегиях валидации](/docs/validation/validation-strategies).

Точечный мост «изменилось поле → перепроверить» — оператор поведения `revalidateWhen`, с
собственным дебаунсом:

```typescript
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { validateModel } from '@reformer/core/validation';

let timer: ReturnType<typeof setTimeout>;

const behavior = defineFormBehavior<SignupForm>(({ model }) => {
  revalidateWhen([model.$.username], () => {
    clearTimeout(timer);
    timer = setTimeout(() => void validateModel(model, signupValidation), 500);
  });
});
```

## Отмена устаревших запросов

Прогоны ключуются по паре «модель + правила»: быстрый повторный прогон отменяет предыдущий, ещё не
завершившийся, через `AbortController`. Результат устаревшего прогона получает статус `cancelled` и
**не разносится** по полям (отменённому результату нельзя доверять), а его `AbortSignal`
прокидывается в `validateAsync`. Передайте этот `signal` в `fetch` (как в примерах выше), чтобы
оборвать и сам сетевой запрос:

```typescript
const hasResults: AsyncRule<string> = async (value, { signal }) => {
  const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`, { signal });
  const results = (await res.json()) as unknown[];
  return results.length > 0 ? null : { code: 'noResults' };
};
```

Ловить `AbortError` отдельно не нужно: отменённый прогон сбоем не считается.

## Индикатор прогресса

Пока идут async-правила поля, его нода в `pending` — `useFormControl(control).pending` и
`FormField` из `@reformer/ui-kit` покажут «Проверка…» у конкретного поля. Состояние всей формы —
сигналы сборки `bundle.validating` (идёт проверка) и `bundle.submission.submitting` (идёт
обработчик отправки). Готового хука для произвольного сигнала в `@reformer/core` нет — в компоненте
сигнал читают подпиской `useSyncExternalStore`, как это делают хуки ядра:

```tsx
import { useSyncExternalStore } from 'react';
import type { ReadonlySignal } from '@reformer/core/signals';

// Свой хелпер приложения: подписка на сигнал и снимок его значения.
function useSignalSnapshot<T>(source: ReadonlySignal<T>): T {
  return useSyncExternalStore(
    (onChange) => source.subscribe(() => onChange()),
    () => source.peek(),
    () => source.peek() // SSR: снимок без подписки
  );
}

function SubmitButton() {
  const validating = useSignalSnapshot(signup.validating);
  const submitting = useSignalSnapshot(signup.submission.submitting);
  return (
    <button type="submit" disabled={validating || submitting}>
      {validating ? 'Проверка…' : 'Отправить'}
    </button>
  );
}
```

## Проверка на отправке

На отправке `bundle.submission.submit(handler)` прогоняет **все** правила, включая асинхронные
(дожидается их), и разносит замечания по полям. Обработчик вызывается только при статусе `valid`
(`severity: 'warning'` не блокирует):

```tsx
const handleSubmit = async (event: React.FormEvent) => {
  event.preventDefault();
  const outcome = await signup.submission.submit((values) => api.register(values));
  if (outcome.status === 'error') showToast('Не удалось проверить имя, повторите попытку');
};
```

:::warning Дождитесь результата
Проверка асинхронна — всегда `await`-айте `validate()` / `submission.submit()` перед проверкой
результата, иначе async-правила не успеют отработать.
:::

## Кросс-полевой async

Async-правило получает только `value` и `{ signal }` — модели среди аргументов нет. Соседние поля
читаются из модели, **захваченной замыканием схемы**: пишите правило прямо внутри
`defineValidation` и берите снимок через `model.get()`:

```typescript
type AccountForm = { email: string; userId: string };

const emailValidation = defineValidation<AccountForm>(({ model }) => {
  validateAsync(model.$.email, [
    async (value, { signal }) => {
      if (!value) return null;
      const { userId } = model.get(); // снимок соседних полей области
      const res = await fetch('/api/check-email', {
        method: 'POST',
        body: JSON.stringify({ email: value, userId }),
        signal,
      });
      const { valid } = (await res.json()) as { valid: boolean };
      return valid ? null : { code: 'emailInUse' };
    },
  ]);
});
```

`AsyncRule` остаётся чистой функцией `(value, { signal })`, а доступ к соседям даёт `model.get()` — тот
же приём со снимком, что и у синхронного [`cross`](/docs/validation/custom#кросс-полевые-проверки).

## Дальше

- [Кастомные валидаторы](/docs/validation/custom) — синхронные правила и кросс-полевые проверки через `cross`.
- [Стратегии валидации](/docs/validation/validation-strategies) — когда запускать: живая стратегия, шаги потока, отправка.
- [Обработка ошибок](/docs/validation/error-handling) — чтение и отображение замечаний.

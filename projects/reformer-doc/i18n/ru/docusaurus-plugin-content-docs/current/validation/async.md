---
sidebar_position: 3
---

# Асинхронная валидация

Для проверок, требующих сервера — уникальность email, валидация ИНН, доступность имени — служат
**асинхронные правила**. Они описываются оператором `validateAsync` в схеме валидации и прогоняются
внешним раннером `validateModel` по требованию (submit, шаг wizard).

## Контракт

Асинхронное правило — функция `(value, { signal }) => Promise<ValidationError | null>`. Второй
аргумент — контекст с `signal: AbortSignal` для отмены устаревших запросов. Тип — `AsyncRule<T>`
из `@reformer/core/validation`:

```typescript
import type { AsyncRule } from '@reformer/core/validation';

const usernameAvailable: AsyncRule<string> = async (value, { signal }) => {
  if (!value || value.length < 3) return null; // пусто/коротко = валидно (обязательность — sync-правилом)

  try {
    const res = await fetch(`/api/check-username?u=${encodeURIComponent(value)}`, {
      signal, // отмена сетевого запроса при следующем прогоне
    });
    const { available } = (await res.json()) as { available: boolean };
    return available ? null : { code: 'usernameTaken', message: 'Имя уже занято' };
  } catch {
    return null; // сбой сети НЕ должен блокировать отправку — возвращаем null, а не ошибку
  }
};
```

:::info Сбой сети → `null`
Если запрос упал (сеть, 500, таймаут), верните `null` — иначе временная недоступность бэкенда
навсегда заблокирует форму. Async-правило подтверждает ошибку только когда сервер **явно** ответил
«занято». Раннер к тому же сам проглатывает отклонённый промис правила (в т.ч. `AbortError`), так что
поле от исключения не станет невалидным — но осмысленный `catch → null` всё равно нагляднее.
:::

## Подключение в схему

Валидаторы больше **не живут** в layout-схеме формы: `createForm({ model, schema })` несёт только
разметку и поведение. Правила — отдельная `ValidationSchema`, где синхронный `validate` даёт быстрый
отсев, а `validateAsync` — серверную проверку:

```typescript
import { createModel } from '@reformer/core';
import {
  defineValidationSchema,
  validate,
  validateAsync,
  validateModel,
} from '@reformer/core/validation';
import { required, minLength } from '@reformer/core/validators';

interface SignupForm {
  username: string;
}

const model = createModel<SignupForm>({ username: '' });

const signupValidation = defineValidationSchema<SignupForm>(({ model }) => {
  validate(model.$.username, [
    required({ message: 'Имя пользователя обязательно' }),
    minLength(3, { message: 'Минимум 3 символа' }),
  ]);
  validateAsync(model.$.username, [usernameAvailable]); // серверная проверка
});

// Прогон — по требованию, внешним раннером (дожидается async-правил):
const valid = await validateModel(model, signupValidation);
```

:::info `validate` и `validateAsync` независимы
Это два разных оператора одного поля, а не один массив. Sync-ошибка **не отменяет** async-правило:
раннер регистрирует оба и дожидается асинхронного, ошибки агрегируются. Поэтому async-правило обязано
само отсеивать пустые/невалидные значения (`if (!value) return null`), иначе запрос уйдёт и для
незаполненного поля.
:::

## Debounce

У схемы валидации нет опций `debounce`/`updateOn` — валидация не реактивна, она прогоняется **по
требованию** через `validateModel`, а момент запуска выбирает приложение. Чтобы гонять async
«вживую», пока пользователь печатает, свяжите правку поля с прогоном через поведенческий мост
`revalidateWhen`, добавив собственный дебаунс:

```typescript
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { validateModel } from '@reformer/core/validation';

let timer: ReturnType<typeof setTimeout>;

const behavior = defineFormBehavior<SignupForm>(({ model }) => {
  revalidateWhen([model.$.username], () => {
    clearTimeout(timer);
    timer = setTimeout(() => void validateModel(model, signupValidation), 500); // подождать паузу во вводе
  });
});
```

`revalidateWhen` — часть контракта [поведения](/docs/behaviors/overview): он вызывает колбэк при изменении
зависимостей, а тот запускает прогон. Устаревшие прогоны одной пары `(model, schema)` раннер отменяет
сам (см. ниже) — дебаунс лишь сокращает число запусков. Подробнее о моменте запуска — в
[Стратегиях валидации](/docs/validation/validation-strategies).

## Отмена устаревших запросов

Раннер `validateModel` ключует прогоны по паре `(model, schema)`: быстрый повторный вызов отменяет
предыдущий, ещё не завершившийся, через `AbortController`. Результат устаревшего прогона **не роутится**
в поля (fail-closed — отменённому результату нельзя доверять), а его `AbortSignal` прокидывается в
`validateAsync`. Передайте этот `signal` в `fetch` (как в примере выше), чтобы оборвать и сам сетевой
запрос:

```typescript
const hasResults: AsyncRule<string> = async (value, { signal }) => {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`, { signal });
    const results = (await res.json()) as unknown[];
    return results.length > 0 ? null : { code: 'noResults', message: 'Ничего не найдено' };
  } catch {
    return null; // сбой ИЛИ отмена (AbortError) — молча выходим, результат всё равно устарел
  }
};
```

Специально ловить `AbortError` отдельной веткой не нужно: устаревший результат раннер и так отбросит,
а исключение прерванного `fetch` он проглотит. Достаточно `catch → null`.

## Индикатор прогресса

Async-прогон живёт внутри `await validateModel(...)`, которым управляет приложение, — значит и
индикатор «идёт проверка» это ваш собственный флаг вокруг вызова, а не пер-полевой сигнал. Форма
держит `pending`-сигнал, submit его поднимает и опускает:

```typescript
import { signal } from '@reformer/core/signals';

const ui = { pending: signal(false), status: signal<string | null>(null) };

const submit = async (): Promise<void> => {
  if (ui.pending.value) return; // повторный клик во время проверки игнорируем
  ui.pending.value = true;
  try {
    const valid = await validateModel(model, signupValidation);
    ui.status.value = valid ? null : 'Проверьте выделенные поля';
    if (valid) await api.save(model.get());
  } finally {
    ui.pending.value = false;
  }
};
```

Кнопка/статус читают `ui.pending` через `useSignalValue` и показывают «Проверка…».

:::note Пер-полевой `pending` из `useFormControl`
Сигнал `pending` на узле поля — остаток «живого» async-пути старого движка (`asyncValidators` в узле
схемы). Новый раннер `validateModel` его **не поднимает**: он только разносит ошибки
(`setErrors`). Ведите прогресс на уровне формы/приложения, как выше.
:::

## Проверка на submit

На отправке `validateModel(model, schema)` прогоняет **все** правила, включая асинхронные (раннер их
дожидается), и роутит ошибки в поля. Возвращает `boolean` — `true`, если нет блокирующих ошибок
(`severity: 'warning'` не блокирует):

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  form.markAsTouched(); // чтобы UI показал ошибки на всех полях
  const valid = await validateModel(model, signupValidation);
  if (valid) await api.save(model.get());
};
```

:::warning Дождитесь результата
`validateModel` асинхронна — всегда `await`-айте её перед проверкой результата, иначе async-правила
не успеют отработать и форма отправится с непроверенными данными.
:::

:::info `form.submit()` больше не валидирует
`form.validate()` / `form.submit()` в новом контракте **не** прогоняют schema-валидацию — это отдельный
слой, который запускает приложение через `validateModel`. Layout-схема формы валидаторов не несёт.
:::

## Кросс-полевой async

Async-правило получает только `value` и `{ signal }` — модели среди аргументов нет. Соседние поля
читаются из модели, **захваченной замыканием схемы**: пишите правило прямо внутри
`defineValidationSchema` (или фабрикой, замыкающей `model`) и берите снапшот через `model.get()`:

```typescript
interface AccountForm {
  email: string;
  userId: string;
}

const emailValidation = defineValidationSchema<AccountForm>(({ model }) => {
  validateAsync(model.$.email, [
    async (value, { signal }) => {
      if (!value) return null;
      const { userId } = model.get(); // снапшот соседних полей текущего scope
      try {
        const res = await fetch('/api/check-email', {
          method: 'POST',
          body: JSON.stringify({ email: value, userId }),
          signal,
        });
        const { valid } = (await res.json()) as { valid: boolean };
        return valid ? null : { code: 'emailInUse', message: 'Email уже занят' };
      } catch {
        return null;
      }
    },
  ]);
});
```

Каст не нужен: `AsyncRule` остаётся чистой функцией `(value, { signal })`, а доступ к соседям даёт
`model.get()` — тот же снапшот-идиом, что и у синхронного [`cross`](/docs/validation/custom).

## Дальше

- [Кастомные валидаторы](/docs/validation/custom) — синхронные правила и кросс-полевые проверки через `cross`.
- [Стратегии валидации](/docs/validation/validation-strategies) — когда запускать: шаги wizard, `revalidateWhen`, submit.
- [Обработка ошибок](/docs/validation/error-handling) — чтение и отображение ошибок.
  </content>
  </invoke>

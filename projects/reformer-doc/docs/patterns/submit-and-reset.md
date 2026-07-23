---
sidebar_position: 3
---

# Отправка и сброс

Канонический жизненный цикл отправки под M1: **пометить поля тронутыми → прогнать схему валидации →
взять снимок модели → отправить → сбросить**. Валидация — **отдельный слой**
(`@reformer/core/validation`): схема описывается функцией `defineValidationSchema`, не входит в layout
формы и прогоняется по требованию раннером `validateModel(model, schema)`. Раннер сам роутит ошибки в
ноды формы, поэтому UI подсветит проблемные поля.

## Жизненный цикл submit

Три обязательных шага:

1. `form.touchAll()` — пометить все поля тронутыми, чтобы ошибки стали видимыми.
2. `const ok = await validateModel(model, schema)` — прогнать схему валидации (включая async-правила);
   ошибки автоматически проставятся в ноды. Схема — отдельный слой, не layout формы.
3. При `ok` — взять снимок `model.get()` и отправить.

```tsx
import { useMemo } from 'react';
import { createModel, createForm } from '@reformer/core';
import { defineValidationSchema, validate, validateModel } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';
import { FormField, Input, Button } from '@reformer/ui-kit';

type SignupForm = { name: string; email: string };

// Валидация — отдельная схема над моделью, вне layout-дерева формы. Стабильная module-level
// ссылка: она нужна раннеру, чтобы отменять устаревшие прогоны той же (model, schema).
const signupValidation = defineValidationSchema<SignupForm>(({ model }) => {
  validate(model.$.name, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
});

export function SignupForm() {
  const { form, model } = useMemo(() => {
    const model = createModel<SignupForm>({ name: '', email: '' });
    // schema здесь — только layout: привязка сигналов к компонентам, без валидаторов.
    const schema = {
      name: { value: model.$.name, component: Input, componentProps: { label: 'Имя' } },
      email: { value: model.$.email, component: Input, componentProps: { label: 'Email' } },
    };
    const form = createForm<SignupForm>({ model, schema });
    return { form, model };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    form.touchAll();
    const ok = await validateModel(model, signupValidation);
    if (!ok) return;

    // ok — берём чистый снимок и отправляем
    const payload = model.get();
    await api.signup(payload);
    model.reset(); // чистый старт после успеха
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
`validateModel` асинхронна — она дожидается async-правил. Если прочитать результат без `await`,
submit уйдёт с невалидными данными. Дождитесь `Promise<boolean>` и проверьте его: `if (!ok) return;`.
Результат — сам `boolean`, а не объект `{ valid }`.
:::

:::info Схема валидации ≠ layout
`schema`, который получает `createForm`, — это **layout-дерево** (привязка сигналов к компонентам),
и валидаторов оно не несёт. Правила живут в отдельной `defineValidationSchema` и запускаются только
через `validateModel`. Подробнее — [Обзор валидации](../validation/overview).
:::

## Серверные ошибки и сбои

`model.reset()` вызывайте **только после успеха**. При бизнес-ошибке сервера — кладите её в поле
через `form.<field>.setErrors([...])` и не сбрасывайте значения; при сетевой ошибке — тоже
оставляйте данные.

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  form.touchAll();
  const ok = await validateModel(model, signupValidation);
  if (!ok) return;

  try {
    const res = await api.signup(model.get());
    if (res.success) {
      model.reset();
    } else {
      // бизнес-ошибка сервера — НЕ сбрасываем, показываем на поле
      form.email.setErrors([{ code: 'taken', message: res.message }]);
    }
  } catch (err) {
    // сеть/неожиданная ошибка — оставляем значения
    showToast(`Ошибка сети: ${(err as Error).message}`);
  }
};
```

## FormSubmitter — управление отправкой

`FormSubmitter<T>` инкапсулирует шаги `touchAll → onSubmit` и добавляет реактивное состояние
отправки. Он уже **встроен в форму**: `createForm` отдаёт `form.submit`, `form.submitWithResult` и
сигнал `form.submitting` из коробки — отдельно инстанцировать класс не нужно.

:::warning `submit()` больше не прогоняет схему валидации
Встроенный шаг валидации внутри `submit()` — это `form.validate()`, а он под M1 отражает лишь
состояние нод, но **не запускает схему** (правила вынесены из формы). Поэтому схему прогоняйте сами
через `validateModel` **до** `submit`, а сам `submit` вызывайте с `skipValidation: true` — иначе
встроенный `form.validate()` сначала очистит ошибки, разнесённые `validateModel`, и подтвердит submit
по пустому состоянию.
:::

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // Схему прогоняем сами — form.validate()/submit() её не знают.
  const ok = await validateModel(model, signupValidation);
  if (!ok) return;

  // submitWithResult даёт submitting-состояние и SubmitResult; skipValidation — чтобы встроенный
  // form.validate() не затирал уже разнесённые ошибки и не подменял вердикт схемы.
  const result = await form.submitWithResult(
    async (values) => api.signup(values), // values — form.getValue(); без отключённых полей
    { skipValidation: true }
  );

  if (result.success) {
    model.reset();
  } else if (result.error) {
    showToast(`Ошибка: ${result.error.message}`);
  }
  // result.success === false без error → onSubmit вернул неуспех / был прерван
};
```

### API

| Член                                | Назначение                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `submit(onSubmit, opts?)`           | `touchAll` + `form.validate()` (состояние нод, **не** схема); вызывает `onSubmit(values)`. Возвращает результат `onSubmit` или `null` при провале |
| `submitWithResult(onSubmit, opts?)` | то же, но возвращает `SubmitResult` с явным флагом `success`                                                                                      |
| `isSubmitting()`                    | нереактивный снимок — метод самого `FormSubmitter`; на форме используйте `form.submitting.value`                                                  |
| `submitting`                        | `ReadonlySignal<boolean>` — реактивное состояние отправки                                                                                         |

`SubmitResult<R>` и `SubmitOptions`:

```typescript
interface SubmitResult<R> {
  success: boolean; // прошла ли отправка целиком
  data: R | null; // результат onSubmit (null при неуспехе)
  error?: Error; // ошибка, если onSubmit бросил
}

interface SubmitOptions {
  skipValidation?: boolean; // пропустить встроенный form.validate() (схему всё равно гоняете сами)
  skipTouch?: boolean; // пропустить пометку полей тронутыми
}
```

:::info `submit` vs `submitWithResult`
`submit` возвращает `null` и при провале встроенного `form.validate()`, и когда `onSubmit` легитимно
вернул `null` — эти случаи не различить. Когда нужен явный статус — берите `submitWithResult` с полем
`success`.
:::

### Индикация отправки

Пока идёт запрос, блокируйте кнопку. Простейший способ в React — локальный флаг вокруг
async-обработчика; вне React — сигнал `form.submitting`.

```tsx
import { useState } from 'react';

function SubmitButton({ onSubmit }: { onSubmit: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      await onSubmit();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" onClick={handleClick} disabled={busy}>
      {busy ? 'Отправка…' : 'Отправить'}
    </Button>
  );
}
```

## Сброс формы

| Метод модели             | Назначение                                       |
| ------------------------ | ------------------------------------------------ |
| `model.reset()`          | вернуть значения к initial-снимку                |
| `model.captureInitial()` | зафиксировать текущие значения как новый initial |
| `model.isDirty()`        | отличаются ли значения от initial-снимка         |

`model.reset()` возвращает к снимку, зафиксированному при `createModel`. Если данные пришли с
сервера (через `model.patch(...)`) и должны стать новой «точкой отсчёта» — вызовите
`model.captureInitial()` после загрузки; тогда `reset()` вернёт именно к ним.

```tsx
function ActionButtons({ model }: { model: FormModel<SignupForm> }) {
  const handleReset = () => {
    if (!model.isDirty()) return; // нечего сбрасывать
    if (confirm('Очистить форму? Несохранённые изменения будут потеряны.')) {
      model.reset();
    }
  };

  return (
    <Button type="button" onClick={handleReset}>
      Очистить
    </Button>
  );
}
```

:::tip После `reset()` в UI остались старые ошибки
`model.reset()` меняет только значения; ошибки живут в нодах и чистятся валидацией. Перезапустите
`validateModel(model, schema)` после reset (валидные поля погаснут сами) либо очистите точечно
`form.field.clearErrors()`.
:::

:::warning `reset` после успешной загрузки данных
`reset()` возвращает к значениям на момент `createModel`, а не к последнему `patch`. Чтобы
загруженные с сервера данные стали новым initial — вызовите `model.captureInitial()` после
`model.patch(...)`.
:::

## Дальше

- [Модель данных](../core-concepts/model) — `get` / `patch` / `reset` / `captureInitial`.
- [Валидация](../validation/overview) — `validateModel` и встроенные валидаторы.
- [Асинхронная предзагрузка](./async-preload) — загрузка initial-значений с сервера.

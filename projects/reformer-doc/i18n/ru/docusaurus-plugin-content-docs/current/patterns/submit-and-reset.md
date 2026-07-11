---
sidebar_position: 3
---

# Отправка и сброс

Канонический жизненный цикл отправки под M1: **пометить поля тронутыми → провалидировать данные →
взять снимок модели → отправить → сбросить**. Валидация — чистая функция данных (модели); она же
роутит ошибки в ноды формы, поэтому UI подсветит проблемные поля.

## Жизненный цикл submit

Три обязательных шага:

1. `form.touchAll()` — пометить все поля тронутыми, чтобы ошибки стали видимыми.
2. `await validateFormModel(model, schema)` — прогнать все валидаторы (включая async); ошибки
   автоматически проставятся в ноды.
3. При `valid` — взять снимок `model.get()` и отправить.

```tsx
import { useMemo } from 'react';
import { createModel, createForm, validateFormModel } from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';
import { FormField, Input, Button } from '@reformer/ui-kit';

type SignupForm = { name: string; email: string };

export function SignupForm() {
  const { form, model, schema } = useMemo(() => {
    const model = createModel<SignupForm>({ name: '', email: '' });
    const schema = {
      name: {
        value: model.$.name,
        component: Input,
        componentProps: { label: 'Имя' },
        validators: [required(), minLength(2)],
      },
      email: {
        value: model.$.email,
        component: Input,
        componentProps: { label: 'Email' },
        validators: [required(), email()],
      },
    };
    const form = createForm<SignupForm>({ model, schema });
    return { form, model, schema };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    form.touchAll();
    const { valid } = await validateFormModel(model, schema);
    if (!valid) return;

    // valid — берём чистый снимок и отправляем
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

:::warning Всегда `await` перед проверкой `valid`
`validateFormModel` асинхронна (async-валидаторы). Если прочитать результат без `await`, submit
уйдёт с невалидными данными. Дождитесь результата и проверьте `valid`.
:::

## Серверные ошибки и сбои

`model.reset()` вызывайте **только после успеха**. При бизнес-ошибке сервера — кладите её в поле
через `form.<field>.setErrors([...])` и не сбрасывайте значения; при сетевой ошибке — тоже
оставляйте данные.

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  form.touchAll();
  const { valid } = await validateFormModel(model, schema);
  if (!valid) return;

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

`FormSubmitter<T>` инкапсулирует шаги `touchAll → validate → onSubmit` и добавляет реактивное
состояние отправки. Он уже **встроен в форму**: `createForm` отдаёт `form.submit`,
`form.submitWithResult` и сигнал `form.submitting` из коробки — отдельно инстанцировать класс не
нужно.

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // submit сам вызывает touchAll + валидацию; onSubmit — только при valid
  const result = await form.submitWithResult(async (values) => {
    return api.signup(values); // values — значения формы (form.getValue(); без отключённых полей)
  });

  if (result.success) {
    model.reset();
  } else if (result.error) {
    showToast(`Ошибка: ${result.error.message}`);
  }
  // result.success === false без error → форма не прошла валидацию
};
```

### API

| Член                                | Назначение                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `submit(onSubmit, opts?)`           | `touchAll` + валидация; при `valid` вызывает `onSubmit(values)`. Возвращает результат `onSubmit` или `null`, если валидация не прошла |
| `submitWithResult(onSubmit, opts?)` | то же, но возвращает `SubmitResult` с явным флагом `success`                                                                          |
| `isSubmitting()`                    | нереактивный снимок — метод самого `FormSubmitter`; на форме используйте `form.submitting.value`                                      |
| `submitting`                        | `ReadonlySignal<boolean>` — реактивное состояние отправки                                                                             |

`SubmitResult<R>` и `SubmitOptions`:

```typescript
interface SubmitResult<R> {
  success: boolean; // прошла ли отправка целиком
  data: R | null; // результат onSubmit (null при неуспехе)
  error?: Error; // ошибка, если onSubmit бросил
}

interface SubmitOptions {
  skipValidation?: boolean; // пропустить валидацию перед submit
  skipTouch?: boolean; // пропустить пометку полей тронутыми
}
```

:::info `submit` vs `submitWithResult`
`submit` возвращает `null` и при провале валидации, и когда `onSubmit` легитимно вернул `null` —
эти случаи не различить. Когда нужен явный статус — берите `submitWithResult` с полем `success`.
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
`validateFormModel(model, schema)` после reset либо очистите точечно `form.field.setErrors([])`.
:::

:::warning `reset` после успешной загрузки данных
`reset()` возвращает к значениям на момент `createModel`, а не к последнему `patch`. Чтобы
загруженные с сервера данные стали новым initial — вызовите `model.captureInitial()` после
`model.patch(...)`.
:::

## Дальше

- [Модель данных](../core-concepts/model) — `get` / `patch` / `reset` / `captureInitial`.
- [Валидация](../validation/overview) — `validateFormModel` и встроенные валидаторы.
- [Асинхронная предзагрузка](./async-preload) — загрузка initial-значений с сервера.

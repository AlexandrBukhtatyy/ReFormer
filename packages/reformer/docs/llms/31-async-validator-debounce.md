## 31. ASYNC VALIDATOR

Для проверок типа «уникальность email», «валидация ИНН через API», «проверка адреса» —
async-валидатор это `ModelValidator`, возвращающий `Promise<ValidationError | null>`. Он
исполняется движком `validateFormModel`/`validateModel` (async-задачи прогоняются параллельно
через `Promise.all`).

```ts
import { createModel, createForm, validateFormModel, type ModelValidator } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

// async-валидатор: (value, scope, root) => Promise<ValidationError | null>
const checkEmailUnique: ModelValidator<string> = async (value) => {
  if (!value) return null; // пусто = валидно (sync `required` отдельно)
  try {
    const res = await fetch(`/api/check-email?email=${encodeURIComponent(value)}`);
    const { available } = (await res.json()) as { available: boolean };
    return available ? null : { code: 'email-taken', message: 'Email уже зарегистрирован' };
  } catch {
    return { code: 'check-failed', message: 'Не удалось проверить email' };
  }
};

const model = createModel<{ email: string }>({ email: '' });
const schema = {
  email: {
    value: model.$.email,
    component: Input,
    // sync-фабрики и async-валидатор в одном массиве validators
    validators: [required(), email(), checkEmailUnique],
  },
};
const form = createForm({ model, schema });
```

### Как это исполняется

1. `validateFormModel(model, schema)` собирает field-задачи и прогоняет их валидаторы.
2. Для каждого поля валидаторы выполняются по порядку; async-валидаторы `await`-ятся.
3. `validateModelSync(model, schema)` — синхронный вариант: async-валидаторы **пропускаются**
   (для мгновенных проверок без сети).
4. Ошибки роутятся в ноды формы (`form.field.errors`), UI подсвечивает поле.

### Отдельное поле `asyncValidators`

В схеме можно разделить sync и async: `validators: [...]` и `asyncValidators: [...]`. Оба типа
поддерживаются `FieldConfig`. На практике удобнее держать всё в `validators` — движок сам
различает sync/async по возвращаемому `Promise`.

### UI integration

`FormField` из `@reformer/ui-kit` показывает индикатор проверки, пока идёт async-валидация
(`useFormControl(...).pending === true`):

```tsx
const { pending, errors } = useFormControl(form.email);
return pending ? <Spinner /> : errors.length ? <Error errors={errors} /> : null;
```

### Debounce и отмена

- Валидация запускается on-demand (на submit / шаг / через `revalidateWhen`), а не на каждый
  keystroke — отдельный `debounce` в валидаторе обычно не нужен.
- Если нужно дебаунсить дорогой async-валидатор относительно частых изменений, вешай его через
  `revalidateWhen([...], () => validateFormModel(...))` и оборачивай запуск в собственный debounce.
- Cross-field async — обычный `ModelValidator`, читающий соседние поля через `root`.

### See also

- [27-revalidate-when.md](27-revalidate-when.md) — перезапуск валидации по триггерам
- [29-async-preload.md](29-async-preload.md) — async preload данных при init формы
- [03-api-signatures.md](03-api-signatures.md) — `ModelValidator` и `validateFormModel`

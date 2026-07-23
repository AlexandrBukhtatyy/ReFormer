## 31. ASYNC VALIDATOR

Для проверок типа «уникальность email», «валидация ИНН через API», «проверка адреса» —
async-правило это `AsyncRule<T>` = `(value, { signal }) => Promise<ValidationError | null>`.
Оно регистрируется оператором `validateAsync(sig, [asyncRules])` внутри схемы валидации
(`@reformer/core/validation`) и исполняется внешним раннером `validateModel` (async-правила
прогоняются параллельно через `Promise.all`, раннер их дожидается).

Слои разделены: layout (`createForm`-схема / JSON) НЕ несёт валидаторов — правила живут в
отдельной функции-схеме `defineValidationSchema<T>(({ model }) => …)`.

```ts
import { createModel } from '@reformer/core';
import {
  validate,
  validateAsync,
  defineValidationSchema,
  validateModel,
  type AsyncRule,
} from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';

// async-правило: (value, { signal }) => Promise<ValidationError | null>.
// `signal` — AbortSignal устаревшего прогона: прокинь его в fetch, чтобы отменить in-flight.
const checkEmailUnique: AsyncRule<string> = async (value, { signal }) => {
  if (!value) return null; // пусто = валидно (sync `required` отдельно)
  try {
    const res = await fetch(`/api/check-email?email=${encodeURIComponent(value)}`, { signal });
    const { available } = (await res.json()) as { available: boolean };
    return available ? null : { code: 'email-taken', message: 'Email уже зарегистрирован' };
  } catch {
    return null; // сетевой сбой/отмена НЕ блокирует submit — возвращаем null, а не ошибку
  }
};

const model = createModel<{ email: string }>({ email: '' });

// Схема — обычная функция над моделью; sync и async — разными операторами на одном сигнале.
const schema = defineValidationSchema<{ email: string }>(({ model }) => {
  validate(model.$.email, [required(), email()]); // sync-фабрики
  validateAsync(model.$.email, [checkEmailUnique]); // async-правило
});

// Прогон по требованию (submit / шаг):
const ok = await validateModel(model, schema); // Promise<boolean>
```

### Как это исполняется

1. `validateModel(model, schema)` открывает ambient-окно и **синхронно** прогоняет схему:
   `validate`/`validateAsync`/`cross` регистрируют правила своих полей.
2. Sync-правила выполняются сразу; async-правила из `validateAsync` собираются и после закрытия
   ambient-окна дожидаются параллельно (`Promise.all`) с прокинутым `AbortSignal`.
3. Ошибки роутятся в ноды формы (`getNodeForSignal(sig).setErrors(...)`), UI подсвечивает поле;
   поля, ставшие валидными, гасятся (`setErrors([])`).
4. Возвращает `Promise<boolean>` — `true`, если нет блокирующих ошибок (`severity:'warning'`
   не блокирует). Устаревший (отменённый) прогон возвращает `false` — ему нельзя доверять для submit.

Синхронного варианта у нового контракта нет: раннер один — `validateModel`, и он всегда `async`.

### Sync и async — два оператора

Разделение sync/async делается не полем схемы, а разными операторами на одном сигнале:
`validate(sig, [syncRules])` и `validateAsync(sig, [asyncRules])`. Раннер прогоняет sync-правила
инлайн, а async — дожидается. Держи async-правило дешёвым: ранний `if (!value) return null`
пропускает сетевой вызов, пока `required()`/формат ещё не пройдены.

```ts
validate(model.$.inn, [required(), pattern(/^\d{12}$/)]); // формат — sync, мгновенно
validateAsync(model.$.inn, [checkInnInRegistry]); // обращение к API — отдельным оператором
```

### UI integration

`validateModel(...)` возвращает `Promise<boolean>` — индикатор проверки держи вокруг этого
`await`. Раннер схемы **не** выставляет per-field `pending` на ноде (он роутит только ошибки через
`setErrors`), поэтому спиннер async-валидации — это собственный флаг (обычно form-level, как
`ui.pending` в submit-флоу, или локальный state компонента):

```tsx
const [checking, setChecking] = useState(false);

const runValidation = async (): Promise<boolean> => {
  setChecking(true);
  try {
    return await validateModel(model, schema);
  } finally {
    setChecking(false);
  }
};

return checking ? <Spinner /> : errors.length ? <Error errors={errors} /> : null;
```

### Debounce и отмена

- **Отмена устаревших — раннером, бесплатно.** Быстрый повторный `validateModel(model, schema)`
  той же пары `(model, schema)` отменяет предыдущий in-flight прогон через `AbortController`;
  его `AbortSignal` прокинут в `validateAsync`-правила, поэтому `fetch(url, { signal })` рвётся
  сам. Ручной debounce для КОРРЕКТНОСТИ не нужен — держи схему стабильным `const`
  (`defineValidationSchema`), иначе отмена не сматчит прогоны по идентичности.
- Валидация запускается on-demand (submit / шаг / через `revalidateWhen`), а не на каждый
  keystroke — отдельный `debounce` в правиле обычно не нужен.
- Если нужно дебаунсить дорогой async-валидатор относительно частых изменений — триггерь прогон
  из поведения через `onChange`, который даёт debounce из коробки:

  ```ts
  import { defineFormBehavior, onChange } from '@reformer/core/behaviors';
  import { validateModel } from '@reformer/core/validation';

  export const behavior = defineFormBehavior<{ username: string }>(({ model }) => {
    onChange(model.$.username, () => void validateModel(model, schema), { debounce: 300 });
  });
  ```

  Либо оборачивай в свой debounce колбэк `revalidateWhen([...], () => void validateModel(...))`.
- **Async cross-field** — инлайн `validateAsync`-правило, замыкающее `model` и читающее снапшот
  соседей `model.get()` до первого `await` (у `AsyncRule` нет `root`, только `value` + `signal`;
  `cross(...)` — синхронный):

  ```ts
  validateAsync(model.$.email, [
    async (email, { signal }) => {
      const { username } = model.get(); // снапшот соседних полей до await
      const res = await fetch(`/api/check?email=${email}&user=${username}`, { signal });
      return (await res.json()).ok ? null : { code: 'conflict', message: 'Пара занята' };
    },
  ]);
  ```

### See also

- [27-revalidate-when.md](27-revalidate-when.md) — перезапуск `validateModel` по триггерам
- [29-async-preload.md](29-async-preload.md) — async preload данных при init формы
- [32-async-options-loading.md](32-async-options-loading.md) — `onChange` с debounce + AbortSignal

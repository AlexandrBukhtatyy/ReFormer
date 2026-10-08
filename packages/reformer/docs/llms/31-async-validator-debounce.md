## 31. ASYNC VALIDATOR

Для проверок типа «уникальность email», «валидация ИНН через API», «проверка адреса» —
async-правило это `AsyncRule<T>` = `(value, { signal }) => Promise<ValidationError | null>`.
Оно регистрируется оператором `validateAsync(sig, [asyncRules])` внутри схемы валидации
(`@reformer/core/validation`) и исполняется внешним раннером `validateModel` (async-правила
прогоняются параллельно через `Promise.all`, раннер их дожидается).

Слои разделены: схема формы (билдер `createForm` / JSON) правил НЕ несёт — они живут в
отдельной функции-схеме `defineValidationSchema<T>(({ model }) => …)`.

**Сбой async-правила блокирует.** Если правило отклонило промис (сеть, исключение), прогон получает
статус `error`, а поле — ошибку `{ code: 'ruleFailed' }` («Не удалось проверить поле. Повторите
попытку»): форму, которую не удалось проверить, раннер валидной не считает.

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
  // try/catch не нужен: отклонённый запрос раннер запишет сбоем правила (статус `error`,
  // ошибка `ruleFailed` на поле), а отмену устаревшего прогона отличит сам по `signal`.
  const res = await fetch(`/api/check-email?email=${encodeURIComponent(value)}`, { signal });
  const { available } = (await res.json()) as { available: boolean };
  return available ? null : { code: 'email-taken', message: 'Email уже зарегистрирован' };
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
3. Пока async-правила поля не завершились, его нода в состоянии `pending`
   (`form.email.pending.value`, `useFormControl(form.email).pending`).
4. Ошибки разносятся по нодам формы, UI подсвечивает поле; поля, ставшие валидными, гасятся.
   Отклонённое правило даёт на своём поле ошибку `ruleFailed`.
5. Возвращает `Promise<boolean>` — `true` только при статусе `valid` (`severity:'warning'`
   не блокирует). Ошибки (`invalid`), сбой правила (`error`) и устаревший отменённый прогон
   (`cancelled`) дают `false`.

Синхронного варианта у контракта нет: раннер всегда `async`.

### Результат прогона и сбой правила

`validateModel` отвечает `boolean`. Когда нужно отличить «в форме ошибки» от «проверить не
удалось», бери полный результат — `runValidation(model, schema)` либо `validation.runAll()` /
`validation.runStep(step)` сборки формы:

```ts
import { applyValidationResult, runValidation } from '@reformer/core/validation';

const result = await runValidation(model, schema); // только сбор: ни ошибок, ни pending на нодах
if (result.status === 'cancelled') return; // вытеснен более новым прогоном — не разносится
applyValidationResult(result, { touch: true }); // ошибки (и ruleFailed) — на поля

if (result.status === 'error') {
  // result.failures: [{ handle, error }] — какое правило и почему не вернуло результат
  showToast('Не удалось проверить форму. Повторите попытку');
} else if (result.status === 'valid') {
  await submit(model.get());
}
```

Если сбой сети НЕ должен блокировать отправку (проверка необязательна), перехвати его в самом
правиле и верни `null` — это явное решение автора правила, а не поведение по умолчанию:

```ts
const softCheck: AsyncRule<string> = async (value, { signal }) => {
  try {
    const res = await fetch(`/api/check?value=${encodeURIComponent(value)}`, { signal });
    return (await res.json()).ok ? null : { code: 'rejected', message: 'Значение отклонено' };
  } catch {
    return null; // осознанно: недоступность сервиса проверку не проваливает
  }
};
```

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

Пока идут async-правила поля, раннер держит его ноду в `pending` — индикатор проверки поля
берётся из состояния ноды, свой флаг не нужен:

```tsx
const { errors, pending, shouldShowError } = useFormControl(form.email);

return pending ? <Spinner /> : shouldShowError ? <Error errors={errors} /> : null;
```

Индикатор прогона всей формы — сигнал `validation.validating` сборки (`createForm`): он истинен,
пока идёт полный прогон либо прогон шага.

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
- **Async cross-field** — инлайн `validateAsync`-правило, замыкающее `model` и читающее снимок
  соседей `model.get()` до первого `await` (`AsyncRule` получает только `value` и `signal`;
  `cross` — синхронный):

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

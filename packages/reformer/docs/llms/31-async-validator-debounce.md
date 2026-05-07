## 31. ASYNC VALIDATOR WITH DEBOUNCE

Для проверок типа «уникальность email», «валидация INN через API», «проверка
адреса по DaData» используй `asyncValidators` в `FieldConfig`:

```ts
import { type FieldConfig, type FormSchema } from '@reformer/core';
import { required, email, type AsyncValidatorFn } from '@reformer/core/validators';

const checkEmailUnique: AsyncValidatorFn<string> = async (value) => {
  if (!value) return null; // empty = valid (sync `required` separately)

  try {
    const res = await fetch(`/api/check-email?email=${encodeURIComponent(value)}`);
    const { available } = (await res.json()) as { available: boolean };
    return available
      ? null
      : { code: 'email-taken', message: 'Email уже зарегистрирован' };
  } catch {
    return { code: 'check-failed', message: 'Не удалось проверить email' };
  }
};

const schema: FormSchema<{ email: string }> = {
  email: {
    value: '',
    component: Input,
    validators: [required(), email()], // sync first
    asyncValidators: [checkEmailUnique], // async after sync passed
    debounce: 500, // debounce input → API (поле `debounce`, не `asyncDebounceMs`)
  },
};
```

### Lifecycle

1. На каждое `setValue` запускается sync `validators` (`required`, `email`)
2. Если sync passed — стартует таймер `debounce`
3. По истечении debounce и стабильном value — вызывается каждый `asyncValidator`
4. Во время async-проверки `useFormControl(...).pending === true` — UI может показать спиннер
5. Результат записывается в `errors` поля

### UI integration

`FormField` из `@reformer/ui-kit` автоматически рендерит `<span>Проверка...</span>`
когда `pending === true`. Если рендеришь сам — используй:

```tsx
const { pending, errors } = useFormControl(form.email);
return pending ? <Spinner /> : errors.length ? <Error errors={errors} /> : null;
```

### Common patterns

- **Debounce 500ms** — баланс между UX и API rate-limit. Для дорогих API увеличивай
  до 1000-2000ms.
- **Cancellation** — если `setValue` приходит во время выполнения предыдущего async,
  ReFormer автоматически отбрасывает результат старого вызова. Не нужно вручную
  abort'ить fetch (но reasonable practice — поддержать `AbortSignal` через
  `ctx.signal` если есть).
- **Cross-field async** — для валидаций типа «дата начала > дата окончания» используй
  sync `validators` с `applyWhen`, а не `asyncValidators`.

### See also

- [11-async-watchfield.md](11-async-watchfield.md) — async для `watchField`, не валидаторов
- [29-async-preload.md](29-async-preload.md) — async preload данных в init формы
- API: `validateAsync(field): Promise<boolean>` — manual trigger, обычно не нужен

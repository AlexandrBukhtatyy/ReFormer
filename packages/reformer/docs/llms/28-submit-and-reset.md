# Submit и Reset — Жизненный цикл отправки формы

## Purpose

Раздел описывает канонический submit-флоу `@reformer/core`: «отметить все поля как `touched` → запустить полную валидацию → проверить `valid` → достать `getValue()` → сделать запрос → `reset()`». Внутри submit-handler-а доступны `form.pending` (включая async-валидаторы), `form.invalid` (для блокировки кнопки), `form.errors` (для итогового вывода). Использование вне React-компонента — те же шаги, без разницы. `form.reset()` возвращает все поля к initial values + чистит `dirty/touched/errors`.

## API

```typescript
// Прокидывается всеми FormProxy и GroupNode:

interface FormLifecycleAPI<T> {
  /** Помечает каждое поле как touched (показ ошибок в UI). */
  markAsTouched(): void;

  /** Запускает все валидаторы (включая async). Возвращает Promise<boolean> — итоговый valid. */
  validate(): Promise<boolean>;

  /** Реактивные сигналы. */
  valid: Signal<boolean>;
  invalid: Signal<boolean>;
  pending: Signal<boolean>;   // true пока крутятся async-валидаторы
  dirty: Signal<boolean>;
  touched: Signal<boolean>;
  errors: Signal<ValidationError[]>;

  /** Снимает все значения формы (deep). Возвращает T. */
  getValue(): T;

  /** Возвращает ВСЕ поля к initial values + чистит dirty/touched/errors/disabled. */
  reset(): void;
}
```

`form.valid.value` сразу после `markAsTouched()` без `await validate()` может вернуть устаревшее значение — обязательно **`await form.validate()`** перед чтением `valid`.

## Examples

### Базовый submit-handler

```tsx
import { useMemo } from 'react';
import { createForm, type FormProxy } from '@reformer/core';

interface RegistrationFormData {
  username: string;
  email: string;
  password: string;
}

function RegistrationForm() {
  const form = useMemo(() => createForm<RegistrationFormData>({
    form: { /* schema */ },
    validation: /* validation */,
    behavior: /* behavior */,
  }), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Шаг 1: показать ошибки на всех полях
    form.markAsTouched();

    // Шаг 2: дождаться async валидации
    await form.validate();

    // Шаг 3: проверить итог
    if (!form.valid.value) {
      return;
    }

    // Шаг 4: достать чистые данные и отправить
    const payload = form.getValue();
    const response = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      form.reset(); // Шаг 5: чистый старт после успеха
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* поля */}
      <button
        type="submit"
        disabled={form.invalid.value || form.pending.value}
      >
        {form.pending.value ? 'Проверка...' : 'Отправить'}
      </button>
    </form>
  );
}
```

Source: [RegistrationForm.tsx:122-150](../../../../projects/react-playground/src/pages/examples/simple-form/RegistrationForm.tsx).

### Submit с error-handling и сохранением значений при ошибке

```tsx
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

  form.markAsTouched();
  const isValid = await form.validate();

  if (!isValid) {
    return;
  }

  try {
    const payload = form.getValue();
    const response = await api.register(payload);

    if (response.success) {
      // Сбрасываем только при успехе
      form.reset();
      navigate('/welcome');
    } else {
      // Сервер вернул бизнес-ошибку — НЕ сбрасываем форму, показываем ошибку
      // Также не сбрасываем при сетевой ошибке.
      form.username.setErrors([{ code: 'taken', message: response.message }]);
    }
  } catch (error) {
    // Сеть/неожиданная ошибка — оставляем значения, чтобы пользователь не вводил заново
    showToast(`Ошибка сети: ${(error as Error).message}`);
  }
}
```

### Reset с подтверждением + ручная очистка одного поля

```tsx
function ActionButtons({ form }: { form: FormProxy<RegistrationFormData> }) {
  const handleReset = () => {
    if (!form.dirty.value) {
      return; // нечего сбрасывать
    }
    if (confirm('Очистить форму? Несохранённые изменения будут потеряны.')) {
      form.reset();
    }
  };

  const clearJustPassword = () => {
    // Сброс одного поля (без затрагивания остальных)
    form.password.setValue('');
    form.password.markAsPristine();
    form.password.markAsUntouched();
  };

  return (
    <>
      <button type="button" onClick={handleReset} disabled={!form.dirty.value}>
        Очистить
      </button>
      <button type="button" onClick={clearJustPassword}>
        Очистить только пароль
      </button>
    </>
  );
}
```

### Использование вне React (server action / Node)

```typescript
import { createForm } from '@reformer/core';

async function processFormPayload(rawData: Partial<MyForm>) {
  const form = createForm<MyForm>({
    form: schema,
    validation,
    behavior,
  });

  // Загружаем данные через patchValue (как initial state)
  form.patchValue(rawData);

  form.markAsTouched();
  const isValid = await form.validate();

  if (!isValid) {
    return { ok: false, errors: form.errors.value };
  }

  return { ok: true, data: form.getValue() };
}
```

## Anti-patterns

```typescript
// ❌ Чтение form.valid без await form.validate()
const handleSubmit = (e) => {
  e.preventDefault();
  form.markAsTouched();
  if (form.valid.value) { // async-валидаторы ещё не завершились!
    submit();
  }
};

// ✅ Дождаться validate()
const handleSubmit = async (e) => {
  e.preventDefault();
  form.markAsTouched();
  await form.validate();
  if (form.valid.value) submit();
};
```

```typescript
// ❌ form.reset() в onSubmit ДО ответа сервера — потеря данных при ошибке
const handleSubmit = async (e) => {
  e.preventDefault();
  await api.send(form.getValue());
  form.reset(); // Если api.send бросит, юзер потеряет ввод
};

// ✅ Reset только после успеха
const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    await api.send(form.getValue());
    form.reset();
  } catch (err) {
    showError(err);
  }
};
```

```typescript
// ❌ Disabled только по invalid (без pending) — кнопка кликабельна во время async
<button disabled={form.invalid.value}>Submit</button>
// пользователь может нажать пока async-валидатор крутится

// ✅ Disabled = invalid OR pending
<button disabled={form.invalid.value || form.pending.value}>
  {form.pending.value ? 'Проверка…' : 'Submit'}
</button>
```

```typescript
// ❌ Двойная отправка — отсутствие guard'а isSubmitting
const handleSubmit = async () => {
  await form.validate();
  if (form.valid.value) await api.send(form.getValue());
};

// ✅ Локальный флаг + disabled
const [isSubmitting, setSubmitting] = useState(false);
const handleSubmit = async () => {
  if (isSubmitting) return;
  setSubmitting(true);
  try {
    await form.validate();
    if (form.valid.value) await api.send(form.getValue());
  } finally {
    setSubmitting(false);
  }
};
```

```typescript
// ❌ Сброс через setValue полей по очереди — дорого и теряет dirty/touched
form.username.setValue('');
form.email.setValue('');
form.password.setValue('');
// errors остаются, dirty флаги не очищены

// ✅ form.reset() делает всё одним вызовом
form.reset();
```

## Troubleshooting

**Q: `form.valid.value` всегда `false` сразу после `markAsTouched()`.**
A: Без `await form.validate()` async-валидаторы возвращают `pending`. Структура: `markAsTouched()` (sync) → `await form.validate()` (ждём) → `form.valid.value` (актуально).

**Q: После `reset()` поля сбросились, но в UI остались старые ошибки.**
A: Проверьте, что компонент подписан на `errors`/`touched` через `useFormControl(field)` — он сам перерисуется. Если используете кастомный hook, не забудьте подписаться на `field.errors.value`.

**Q: `form.pending.value` залип в `true`.**
A: Один из async-валидаторов выкинул исключение без `try/catch` — реактивный счётчик pending не уменьшился. Оборачивайте `validator: async (value) => { try { … } catch { return null; } }`. Также проверьте: не запускаете ли `form.validate()` параллельно (несколько одновременных вызовов).

**Q: Хочу submit без markAsTouched — оставить «зелёную» форму.**
A: Можно. `markAsTouched` нужен только чтобы UI **показал** ошибки. Если вы рендерите ошибки сами (через `form.errors.value`), достаточно `await form.validate(); if (form.valid.value) …`.

**Q: Reset не возвращает initial values — поля очищаются в null.**
A: Initial values в схеме задаются через `value: …`. Если вы передавали `value: undefined`, reset вернёт `undefined`/`null`. Также `patchValue(...)` НЕ меняет initial values — только текущие; reset вернёт к тем, что были в схеме.

**Q: Disabled-поля участвуют в submit-данных?**
A: `getValue()` возвращает значения **всех** полей, включая disabled, в том виде, в котором они есть. Если хотите вырезать disabled — фильтруйте вручную после `getValue()` или используйте `enableWhen({ resetOnDisable: true })`, чтобы при disable в поле возвращалось initial.

## See also

- [29-async-preload.md](./29-async-preload.md) — initial values и preload через external hook
- [11-async-watchfield.md](./11-async-watchfield.md) — async-валидация и `pending`
- [03-api-signatures.md](./03-api-signatures.md) — полные сигнатуры FormProxy/GroupNode
- [05-common-mistakes.md](./05-common-mistakes.md) — типичные ошибки в submit-флоу

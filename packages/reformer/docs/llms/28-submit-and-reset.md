# Submit и Reset — Жизненный цикл отправки формы

## Purpose

Канонический submit-флоу под M1: «запустить полную валидацию данных (`validateFormModel`) →
проверить `result.valid` → достать снимок (`model.get()`) → сделать запрос → `model.reset()`».
Валидация — чистая функция ДАННЫХ (модели), она же роутит ошибки в ноды формы, поэтому UI
подсветит проблемные поля. `model.reset()` возвращает значения к initial-снимку.

## API

```typescript
// Модель (источник истины значений):
interface ModelApi<T> {
  get(): T;                         // снимок значений — для submit
  set(value: T): void;              // полная установка (все ключи T)
  patch(value: Partial<T>): void;   // частичное слияние
  isDirty(): boolean;               // отличаются ли значения от initial-снимка
  reset(): void;                    // вернуть к initial-снимку
  captureInitial(): void;           // зафиксировать текущие как новый initial
}

// Валидация данных (headless, роутит ошибки в ноды формы):
validateFormModel<T>(model, schema): Promise<{ valid: boolean; errors: Record<string, ValidationError[]> }>

// Нода поля (для точечной работы с UI-состоянием):
form.<field>.setErrors([{ code, message }]);
form.<field>.markAsTouched();
form.<field>.reset();
```

## Examples

### Базовый submit-handler

```tsx
import { useMemo } from 'react';
import { createModel, createForm, validateFormModel } from '@reformer/core';

type RegistrationFormData = { username: string; email: string; password: string };

function RegistrationForm() {
  const { model, form, schema } = useMemo(() => {
    const m = createModel<RegistrationFormData>({ username: '', email: '', password: '' });
    const s = buildSchema(m);
    return { model: m, form: createForm({ model: m, schema: s }), schema: s };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Шаг 1: валидация данных (ошибки автоматически проставятся в ноды → UI подсветит)
    const result = await validateFormModel(model, schema);
    if (!result.valid) return;

    // Шаг 2: достать чистые данные и отправить
    const payload = model.get();
    const response = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Шаг 3: чистый старт после успеха
    if (response.ok) model.reset();
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField control={form.username} testId="username" />
      <FormField control={form.email} testId="email" />
      <FormField control={form.password} testId="password" />
      <button type="submit">Отправить</button>
    </form>
  );
}
```

### Submit с error-handling и серверными ошибками

```tsx
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

  const result = await validateFormModel(model, schema);
  if (!result.valid) return;

  try {
    const response = await api.register(model.get());
    if (response.success) {
      model.reset();
      navigate('/welcome');
    } else {
      // Серверная бизнес-ошибка — НЕ сбрасываем форму, кладём ошибку в поле
      form.username.setErrors([{ code: 'taken', message: response.message }]);
    }
  } catch (error) {
    // Сеть/неожиданная ошибка — оставляем значения
    showToast(`Ошибка сети: ${(error as Error).message}`);
  }
}
```

### Reset с подтверждением

```tsx
function ActionButtons({ model }: { model: FormModel<RegistrationFormData> }) {
  const handleReset = () => {
    if (!model.isDirty()) return; // нечего сбрасывать
    if (confirm('Очистить форму? Несохранённые изменения будут потеряны.')) {
      model.reset();
    }
  };

  const clearJustPassword = () => {
    model.password = ''; // сброс одного поля — прямая запись в модель
  };

  return (
    <>
      <button type="button" onClick={handleReset}>Очистить</button>
      <button type="button" onClick={clearJustPassword}>Очистить только пароль</button>
    </>
  );
}
```

### Использование вне React (server action / Node)

Валидация headless — работает без UI/нод:

```typescript
import { createModel, validateModel } from '@reformer/core';

async function processFormPayload(rawData: Partial<MyForm>) {
  const model = createModel<MyForm>(initialValues);
  model.patch(rawData); // частичный load данных

  const result = await validateModel(model, schema); // без нод — просто данные
  if (!result.valid) return { ok: false, errors: result.errors };
  return { ok: true, data: model.get() };
}
```

## Anti-patterns

```typescript
// ❌ Чтение результата валидации без await
const handleSubmit = (e) => {
  e.preventDefault();
  validateFormModel(model, schema); // не дождались async-валидаторов
  submit(model.get());
};

// ✅ Дождаться и проверить result.valid
const handleSubmit = async (e) => {
  e.preventDefault();
  const result = await validateFormModel(model, schema);
  if (result.valid) submit(model.get());
};
```

```typescript
// ❌ model.reset() до ответа сервера — потеря данных при ошибке
await api.send(model.get());
model.reset();

// ✅ Reset только после успеха
try {
  await api.send(model.get());
  model.reset();
} catch (err) { showError(err); }
```

```typescript
// ❌ Сброс полей по очереди — многословно
model.username = '';
model.email = '';
model.password = '';

// ✅ model.reset() — к initial-снимку одним вызовом
model.reset();
```

## Troubleshooting

**Q: После `reset()` в UI остались старые ошибки.**
A: `model.reset()` меняет значения; ошибки в нодах чистит валидация. Перезапусти
`validateFormModel(model, schema)` после reset, либо очисти точечно `form.field.setErrors([])`.

**Q: `reset()` не возвращает данные, загруженные с сервера.**
A: `reset()` возвращает к initial-снимку (значения на момент `createModel`). `set/patch` НЕ
меняют initial. Чтобы сделать загруженные данные новой «точкой отсчёта» — вызови
`model.captureInitial()` после загрузки.

**Q: Disabled-поля участвуют в submit-данных?**
A: `model.get()` возвращает значения всех полей. Фильтруй вручную после `get()` или используй
`enableWhen({ resetOnDisable: true })`, чтобы при disable поле возвращалось к initial.

## See also

- [29-async-preload.md](./29-async-preload.md) — initial values и preload через `set`/`patch`
- [13-multi-step.md](./13-multi-step.md) — пошаговая валидация через `validateFormModel`
- [03-api-signatures.md](./03-api-signatures.md) — сигнатуры модели и `validateFormModel`
- [05-common-mistakes.md](./05-common-mistakes.md) — типичные ошибки

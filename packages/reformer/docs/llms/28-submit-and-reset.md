# Submit и Reset — Жизненный цикл отправки формы

## Purpose

Канонический submit-флоу под M1: «запустить полную валидацию данных (`validateModel`) →
проверить `boolean`-результат → достать снимок (`model.get()`) → сделать запрос → `model.reset()`».
Валидация — **отдельный слой** (`@reformer/core/validation`, схема через `defineValidationSchema`), она
НЕ входит в layout-дерево, которое получает `createForm`. Раннер `validateModel(model, schema)` сам роутит
ошибки в ноды формы, поэтому UI подсветит проблемные поля, а наружу вернёт лишь `boolean`
(false = есть блокирующая ошибка; `severity:'warning'` показывается, но submit не блокирует).
`model.reset()` возвращает значения к initial-снимку.

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

// Валидация данных — headless-раннер: находит ноды по сигналам модели, роутит в них ошибки,
// отменяет устаревшие прогоны той же (model, schema). Возвращает ТОЛЬКО boolean:
validateModel<T>(model: FormModel<T>, schema: ValidationSchema<T>): Promise<boolean>
// true  = нет блокирующих ошибок (severity:'warning' не блокирует, но показывается).
// false = есть блокирующая ошибка; она уже проставлена в ноду → UI подсветит поле.

// Схема валидации — отдельный слой над моделью (не смешивается с layout):
defineValidationSchema<T>(({ model }) => {
  validate(model.$.field, [rules]);          // синхронные правила поля
  // validateAsync / validateWhen / cross / each / apply — см. contract-spec
}): ValidationSchema<T>

// Нода поля/формы (для точечной работы с UI-состоянием):
form.markAsTouched();                         // тронуть все поля (показать ошибки)
form.clearErrors();                           // снять ошибки со всех нод
form.<field>.setErrors([{ code, message }]);  // серверная/бизнес-ошибка в конкретное поле
form.<field>.clearErrors();
```

## Examples

### Базовый submit-handler

```tsx
import { useMemo } from 'react';
import { createModel, createForm } from '@reformer/core';
import { defineValidationSchema, validate, validateModel } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';

type RegistrationFormData = { username: string; email: string; password: string };

// Валидация — отдельная схема над моделью. НЕ входит в layout, который получает createForm.
// Стабильная module-level `const`-ссылка — чтобы validateModel мог отменять устаревшие прогоны.
const registrationSchema = defineValidationSchema<RegistrationFormData>(({ model }) => {
  validate(model.$.username, [required({ message: 'Имя обязательно' }), minLength(3)]);
  validate(model.$.email, [required({ message: 'Email обязателен' }), email()]);
  validate(model.$.password, [required({ message: 'Пароль обязателен' }), minLength(8)]);
});

function RegistrationForm() {
  const { model, form } = useMemo(() => {
    const m = createModel<RegistrationFormData>({ username: '', email: '', password: '' });
    // schema здесь — layout-дерево нод (компоненты/раскладка), без валидаторов.
    return { model: m, form: createForm({ model: m, schema: buildLayout(m) }) };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    form.markAsTouched(); // показать ошибки на всех полях

    // Шаг 1: прогон валидации данных. Ошибки автоматически проставятся в ноды → UI подсветит.
    const valid = await validateModel(model, registrationSchema);
    if (!valid) return;

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
  form.markAsTouched();

  const valid = await validateModel(model, registrationSchema);
  if (!valid) return;

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

Раннер headless — работает без UI-компонентов, только с моделью и схемой:

```typescript
import { createModel } from '@reformer/core';
import { validateModel } from '@reformer/core/validation';

async function processFormPayload(rawData: Partial<MyForm>) {
  const model = createModel<MyForm>(initialValues);
  model.patch(rawData); // частичный load данных

  // validateModel находит ноды по сигналам модели и роутит в них ошибки, возвращая boolean.
  const valid = await validateModel(model, myFormSchema);
  if (!valid) return { ok: false as const };
  return { ok: true as const, data: model.get() };
}
```

## Anti-patterns

```typescript
// ❌ Обращение к .valid: раннер возвращает boolean, а не { valid, errors }
const result = await validateModel(model, schema);
if (!result.valid) return; // result — boolean, .valid === undefined → guard никогда не сработает

// ✅ Результат — сам boolean
const valid = await validateModel(model, schema);
if (!valid) return;
```

```typescript
// ❌ Чтение результата валидации без await — сабмитим по неполному вердикту
const handleSubmit = (e) => {
  e.preventDefault();
  validateModel(model, schema); // Promise проигнорирован, async-валидаторы не дождались
  submit(model.get());
};

// ✅ Дождаться и проверить boolean
const handleSubmit = async (e) => {
  e.preventDefault();
  if (await validateModel(model, schema)) submit(model.get());
};
```

```typescript
// ❌ Валидаторы в layout-дереве, отдаваемом в createForm — layout не несёт правил
createForm({ model, schema: { username: { value: '', validators: [required()] } } });

// ✅ Валидация — отдельная схема, прогоняется раннером
const schema = defineValidationSchema<T>(({ model }) => {
  validate(model.$.username, [required()]);
});
await validateModel(model, schema);
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
`validateModel(model, schema)` после reset (валидные поля погаснут сами), либо очисти напрямую —
`form.clearErrors()` / `form.<field>.clearErrors()`.

**Q: `validateModel` вернул `true`, но в поле висит ошибка.**
A: Это правило с `severity: 'warning'` — оно показывается, но submit не блокирует, поэтому раннер
и вернул `true`. Блокируют только ошибки без `severity` (default). Чтобы не пускать submit при
warning — проверяй его отдельно, вне `validateModel`.

**Q: `reset()` не возвращает данные, загруженные с сервера.**
A: `reset()` возвращает к initial-снимку (значения на момент `createModel`). `set/patch` НЕ
меняют initial. Чтобы сделать загруженные данные новой «точкой отсчёта» — вызови
`model.captureInitial()` после загрузки.

**Q: Disabled-поля участвуют в submit-данных?**
A: `model.get()` возвращает значения всех полей. Фильтруй вручную после `get()` или используй
`enableWhen({ resetOnDisable: true })`, чтобы при disable поле возвращалось к initial.

## See also

- [29-async-preload.md](./29-async-preload.md) — initial values и preload через `set`/`patch`
- [13-multi-step.md](./13-multi-step.md) — пошаговая валидация через `validateModel` (`validateStep`/`validateAll`)
- [27-revalidate-when.md](./27-revalidate-when.md) — мост «поведение → валидация»: `revalidateWhen([deps], () => void validateModel(model, schema))`
- [03-api-signatures.md](./03-api-signatures.md) — сигнатуры модели и `validateModel`
- [05-common-mistakes.md](./05-common-mistakes.md) — типичные ошибки

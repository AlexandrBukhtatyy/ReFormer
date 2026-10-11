# Submit и Reset — Жизненный цикл отправки формы

## Purpose

Канонический submit-флоу — один вызов уровня формы: `bundle.submit(handler)`. Он прогоняет все
правила один раз, разносит замечания по нодам и зовёт обработчик со значениями модели
(`model.get()`) только при статусе `valid`. Результат — объект `SubmitResult`, по которому
отличают отправку (`submitted`), замечания в форме (`invalid`), сбой проверки (`error`), отмену
(`cancelled`) и исключение обработчика (`failed`). После успеха — `model.reset()` (к initial-снимку)
либо `model.captureInitial()` (сохранённые значения — новая точка отсчёта).

Валидация — **отдельный слой** (`@reformer/core/validation`, схема через `defineValidation`): она
НЕ входит в схему формы и уходит в сборку полем `validation` (шаги — `flow`). Без сборки тот же
результат даёт раннер `validateModel(model, schema)`.

## API

```typescript
// Уровень формы — сборка createForm (см. 38-form-flow.md)
bundle.submit<R>(handler: (values: T) => R | Promise<R>): Promise<SubmitResult<R>>;
type SubmitResult<R> =
  | { status: 'submitted'; result: R } // обработчик отработал
  | { status: 'invalid' | 'error' | 'cancelled'; validation: ValidationResult } // не вызывался
  | { status: 'failed'; error: unknown }; // обработчик бросил исключение
bundle.validate(): Promise<ValidationResult>; // проверить всю форму без отправки
bundle.submitting: ReadonlySignal<boolean>; // работает обработчик
bundle.validating: ReadonlySignal<boolean>; // идёт проверка

// Модель (источник истины значений):
interface ModelApi<T> {
  get(): T;                         // снимок значений — его получает обработчик submit
  set(value: T): void;              // полная установка (все ключи T); при нехватке ключей — dev-предупреждение
  patch(value: DeepPartial<T>): void; // частичное слияние: вложенные группы тоже частично, массив — целиком
  isDirty(): boolean;               // отличаются ли значения от initial-снимка (цели compute не в счёт)
  reset(): void;                    // вернуть к initial-снимку (цели compute не пишет — их пересчитает поведение)
  captureInitial(): void;           // зафиксировать текущие как новый initial
}

// Раннер без сборки — headless: находит ноды по сигналам модели, разносит по ним замечания,
// отменяет устаревшие прогоны той же (model, schema):
validateModel<T>(model: FormModel<T>, schema: ValidationDefinition<T>, options?: { touch?: boolean }): Promise<boolean>
// true  = статус 'valid': блокирующих замечаний нет (severity:'warning' не блокирует, но показывается).
// false = 'invalid', 'error' (правило не удалось проверить — на поле замечание ruleFailed) либо 'cancelled'.
runValidation<T>(model, schema): Promise<ValidationResult>           // только сбор
applyValidationResult(result, options?: { touch?: boolean }): void   // разнос по нодам

// Нода поля/формы (точечная работа с UI-состоянием):
form.markAsTouched();                         // тронуть все поля (показать замечания)
form.clearIssues();                           // снять замечания со всех нод
form.<field>.setIssues([{ code, params }]);   // серверная/бизнес-ошибка в конкретное поле
form.<field>.clearIssues();
form.reset();                                 // ноды: значения создания формы, замечания, touched, dirty
```

## Examples

### Базовый submit-handler

```tsx
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';

interface RegistrationFormData {
  username: string;
  email: string;
  password: string;
}

// Валидация — отдельная схема над моделью; стабильная module-level `const`-ссылка.
const registrationRules = defineValidation<RegistrationFormData>(({ model }) => {
  validate(model.$.username, [required({ code: 'username.required' }), minLength(3)]);
  validate(model.$.email, [required({ code: 'email.required' }), email()]);
  validate(model.$.password, [required({ code: 'password.required' }), minLength(8)]);
});

const createRegistration = () =>
  createForm<RegistrationFormData>({
    initial: { username: '', email: '', password: '' },
    schema: registrationSchema, // (model) => дерево узлов, без правил
    validation: registrationRules,
  });

async function register(values: RegistrationFormData): Promise<Response> {
  return fetch('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
}

function RegistrationForm() {
  const registration = useFormBundle(createRegistration);
  const { form, model } = registration;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Один прогон правил: при замечаниях обработчик не вызывается, поля помечены тронутыми.
    const outcome = await registration.submit(register);
    if (outcome.status === 'submitted' && outcome.result.ok) model.reset(); // чистый старт
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

### Submit с разбором результата и серверными замечаниями

```tsx
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

  const outcome = await registration.submit(async (values) => {
    const response = await api.register(values);
    if (!response.success) {
      // Серверная бизнес-ошибка — НЕ сбрасываем форму, кладём замечание в поле
      registration.form.username.setIssues([{ code: 'username.taken' }]);
    }
    return response;
  });

  switch (outcome.status) {
    case 'submitted':
      if (outcome.result.success) {
        registration.model.reset();
        navigate('/welcome');
      }
      break;
    case 'invalid': // замечания уже на полях
      break;
    case 'error': // async-правило не ответило — outcome.validation.failures
      showToast('Не удалось проверить форму, повторите попытку');
      break;
    case 'cancelled': // форму правили, пока шла проверка, либо отправку сменила следующая
      break; // замечаний нет — пользователь отправит ещё раз
    case 'failed': // обработчик бросил исключение (сеть) — значения остаются
      showToast(`Ошибка сети: ${String(outcome.error)}`);
      break;
  }
}
```

Текст кода `username.taken` — запись в словаре формы (`defineIssueMessages`), см.
`36-issue-messages.md`.

### Значения для сервера

Обработчик получает `model.get()` — все значения модели, включая вычисляемые поля. Поля, которых
сервер не ждёт, отрезает сам обработчик: удобно держать ввод и расчёт разными типами
(`CreditApplication` и `CreditApplicationDerived`, форма — их пересечение) и функцию
`toPayload(values): CreditApplication`, убирающую вычисляемые ключи.

```typescript
const outcome = await credit.submit((values) => api.send(toApplicationPayload(values)));
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

### Без сборки — раннер (server action / Node)

Раннер headless — работает без UI-компонентов, только с моделью и схемой:

```typescript
import { createModel } from '@reformer/core';
import { runValidation } from '@reformer/core/validation';

async function processFormPayload(rawData: Partial<MyForm>) {
  const model = createModel<MyForm>(initialValues);
  model.patch(rawData); // частичный load данных

  // Полный результат: статус и замечания по ручкам полей — без нод формы
  const result = await runValidation(model, myFormRules);
  if (result.status !== 'valid') return { ok: false as const, status: result.status };
  return { ok: true as const, data: model.get() };
}
```

## Anti-patterns

```typescript
// ❌ Отправка в обход проверки — правила не прогнаны, замечания не показаны
await api.send(bundle.model.get());

// ✅ Проверка и отправка одним вызовом
await bundle.submit(api.send);
```

```typescript
// ❌ Результат как boolean — объект всегда truthy
if (await bundle.submit(api.send)) navigate('/done');

// ✅ Статус результата
const outcome = await bundle.submit(api.send);
if (outcome.status === 'submitted') navigate('/done');
```

```typescript
// ❌ Методы проверки и отправки на ноде — удалены
await form.validate();
await form.submit(api.send);

// ✅ Уровень формы — у сборки
await bundle.validate();
await bundle.submit(api.send);
```

```typescript
// ❌ Чтение результата без await — сабмитим по неполному вердикту
const handleSubmit = (e) => {
  e.preventDefault();
  validateModel(model, schema); // Promise проигнорирован, async-правила не дождались
  send(model.get());
};

// ✅ bundle.submit дожидается async-правил сам
const handleSubmit = async (e) => {
  e.preventDefault();
  await bundle.submit(send);
};
```

```typescript
// ❌ Правила в узле схемы формы — ключа validators у узла нет, схема формы правил не несёт
createForm({
  initial,
  schema: (model) => ({ children: [{ model: model.$.username, component: Input, validators: [required()] }] }),
});

// ✅ Валидация — отдельная схема, уходит в сборку полем validation
const rules = defineValidation<T>(({ model }) => {
  validate(model.$.username, [required()]);
});
createForm({ initial, schema, validation: rules });
```

```typescript
// ❌ model.reset() до ответа сервера — потеря данных при ошибке
await api.send(model.get());
model.reset();

// ✅ Reset только после успеха — внутри обработчика либо по статусу 'submitted'
const outcome = await bundle.submit(async (values) => {
  await api.send(values);
  bundle.model.reset();
});
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

**Q: После `reset()` в UI остались старые замечания.**
A: `model.reset()` меняет значения; замечания в нодах чистит валидация. Перезапусти
`bundle.validate()` после reset (валидные поля погаснут сами), очисти напрямую —
`form.clearIssues()` / `form.<field>.clearIssues()`, либо сбрось ноды — `form.reset()`.

**Q: `submit` вызвал обработчик, но в поле висит замечание.**
A: Это правило с `severity: 'warning'` — оно показывается, но отправку не блокирует. Блокируют только
замечания без `severity` (по умолчанию `'error'`). Чтобы не пускать submit при warning — проверь
`(await bundle.validate()).issues` сам до отправки.

**Q: `submit` вернул `status: 'error'`, а замечаний правил в форме нет — на поле «Не удалось проверить поле».**
A: Async-правило не вернуло результат (сеть, исключение). Сбой блокирует: на поле — замечание
`{ code: 'ruleFailed' }`. Причина — в `outcome.validation.failures`. Повторная отправка после
восстановления сети снимет замечание.

**Q: `submit` вернул `status: 'cancelled'`, обработчик не вызван, замечаний нет.**
A: Проверку отправки сменила следующая (вторая отправка, живой прогон стратегии `change`) либо
модель изменилась, пока проверка шла. Пока отвечает async-правило, форма не заперта
(`submitting` ещё `false`): пользователь поправил поле, пришла загрузка, поведение записало
значение после таймера или запроса — правила этих значений не видели, и отправлять их нельзя.
Отправку повторяют: следующий прогон проверит уже новые значения. Чтобы правок не было — запри
форму на время проверки по `bundle.validating`. Отложенные записи поведения того же тика (расчёт
`compute`, сброс `resetOnDisable`) изменением не считаются: отправка сразу после сборки формы
или правки поля проходит.

**Q: `reset()` не возвращает данные, загруженные с сервера.**
A: `reset()` возвращает к initial-снимку (значения на момент `createModel`). `set/patch` НЕ
меняют initial. Чтобы сделать загруженные данные новой «точкой отсчёта» — вызови
`model.captureInitial()` после загрузки.

**Q: Что сброс и `isDirty()` делают с вычисляемыми полями?**
A: Ничего. Цели `compute` / `computeFrom` и поля с `markDerived` (например, номер заявки от
сервера) `model.reset()` и `form.reset()` не пишут — так же, как `set` и `patch`: значение
пересчитает поведение, когда сброс вернёт его источники. В `isDirty()` такие поля не входят,
поэтому форма без единой правки не считается изменённой, даже если поведение уже посчитало ставку.
Явная запись — `model.rate = 0` или `form.rate.reset(0)` — пишет как обычно. Исключение —
`enableWhen(…, { resetOnDisable: true })`: выключенное поле возвращается к значению создания, даже
если оно цель `compute` (её `compute` обязан нести то же условие `when`).

**Q: Чем `form.reset()` отличается от `model.reset()`?**
A: `model.reset()` возвращает значения к точке отсчёта модели — initial-снимку либо последнему
`model.captureInitial()`. `form.reset()` сбрасывает ноды: замечания, флаги touched / dirty и значения
— к тем, с которыми форма создана, то есть к «чистому листу», а не к загруженным данным. После
загрузки данных и `captureInitial()` к ним возвращает `model.reset()`.

**Q: Disabled-поля участвуют в submit-данных?**
A: Обработчик получает `model.get()` — значения всех полей. Фильтруй сам либо используй
`enableWhen({ resetOnDisable: true })`, чтобы при disable поле возвращалось к initial. Замечания
отключённых полей сняты, в проверку они не входят.

## See also

- [38-form-flow.md](./38-form-flow.md) — уровень формы: `validate`, `validateStep`, `submit`, поток шагов
- [29-async-preload.md](./29-async-preload.md) — initial values и preload через `set`/`patch`
- [13-multi-step.md](./13-multi-step.md) — пошаговая форма: поток `flow`, визард
- [27-revalidate-when.md](./27-revalidate-when.md) — мост «поведение → валидация»: `revalidateWhen([deps], () => void validateModel(model, schema))`
- [36-issue-messages.md](./36-issue-messages.md) — тексты замечаний по коду
- [05-common-mistakes.md](./05-common-mistakes.md) — типичные ошибки

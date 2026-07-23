---
sidebar_position: 1
---

# Обзор валидации

Валидация в ReFormer — **декларативная**, **headless** и живёт в **отдельном от разметки слое**.
Layout-схема (дерево `RenderNode` / JSON / привязка компонентов к сигналам) **не несёт валидаторов** —
правила описываются отдельной **схемой валидации** (обычной функцией над моделью). Сама проверка —
прогон **по требованию**: внешний раннер обходит модель по схеме, прогоняет правила и раскладывает
ошибки по полям. UI подсвечивает их автоматически.

## Как это устроено

Схема валидации — обычная функция `({ model }) => void`, обёрнутая в `defineValidationSchema<T>`.
Внутри вызываются свободные операторы из `@reformer/core/validation`; значение поля проверяет
`validate(sig, [rules])`. Правила — это чистые **фабрики** (`required()`, `email()`, `min(18)`, …)
из `@reformer/core/validators`, возвращающие функцию `(value) => ValidationError | null`.

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineValidationSchema, validate, validateModel } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

type ContactForm = { name: string; email: string };

const model = createModel<ContactForm>({ name: '', email: '' });

// Layout-схема несёт только компоновку — привязку сигналов к компонентам, без валидаторов.
const schema = {
  name: { value: model.$.name, component: Input },
  email: { value: model.$.email, component: Input },
};

const form = createForm<ContactForm>({ model, schema });

// Валидация — отдельная схема: обычная функция над моделью, обёрнутая в defineValidationSchema.
const contactValidation = defineValidationSchema<ContactForm>(({ model }) => {
  validate(model.$.name, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
});
```

Операторы из `@reformer/core/validation` (вызываются только внутри схемы, во время прогона):

- `validate(sig, [rules])` — синхронные правила поля;
- `validateAsync(sig, [asyncRules])` — асинхронные правила (правило получает `AbortSignal`);
- `validateWhen(cond, cb)` — условная валидация (см. ниже);
- `cross(sig, fn)` — cross-field: `fn` получает снапшот модели (`model.get()`);
- `each(arr, itemFn)` — правила для каждого элемента массива модели;
- `apply(...schemas)` — композиция под-схем над той же моделью.

:::info Правила — чистые фабрики
`required()`, `min(50000)`, `email()` возвращают функцию-правило и **вызываются со скобками** прямо
в массиве оператора: `validate(model.$.amount, [required(), min(50000)])`. Прогон запускает не поле,
а внешний раннер.
:::

## Запуск валидации

Валидация выполняется **по требованию** — обычно на submit или при переходе на следующий шаг — через
внешний раннер `validateModel(model, schema)`. Он обходит модель по схеме, дожидается async-правил,
**роутит ошибки в ноды формы** (`getNodeForSignal(sig).setErrors(...)`), поэтому поля с ошибками
подсветятся в UI, и возвращает `Promise<boolean>`.

```typescript
const ok = await validateModel(model, contactValidation);
// ok: boolean — false, если есть блокирующие ошибки (severity: 'warning' не блокирует)
// ошибки уже разнесены по нодам: form.name.errors, form.email.errors — UI подсветит поля
```

Канонический submit-флоу — «валидировать → проверить `ok` → взять снимок `model.get()`»:

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  form.markAsTouched(); // раскрыть все ошибки в UI

  const ok = await validateModel(model, contactValidation);
  if (ok) {
    await api.save(model.get());
  }
};
```

:::warning `form.validate()` / `submit()` больше не валидируют по схеме
Прогон схемы вынесен из формы: узлы больше не хранят валидаторы, поэтому `form.validate()` и
`submit()` **не запускают правила схемы**. Валидацию инициирует приложение — вызовом
`validateModel(model, schema)` (напрямую или через конфиг wizard'а).
:::

:::tip Один раннер — разные точки вызова
`validateModel(model, schema)` — единственный вход. Он работает и на клиенте (ошибки доезжают до нод,
UI подсвечивает), и headless (server action, юнит-тест — тот же вызов, результат `boolean`).
Пошаговые формы оборачивают его в конфиг: `makeValidationConfig(model)` → `{ validateStep, validateAll }`
для `FormWizard`. Реактивный мост «поведение инициирует валидацию» — оператор поведения
`revalidateWhen([deps], () => void validateModel(model, schema))`.
:::

## Чтение состояния поля

В компонентах реактивное состояние поля читают через `useFormControl`:

```tsx
import { useFormControl } from '@reformer/core';

function NameField() {
  const { value, errors, valid, shouldShowError } = useFormControl(form.name);
  // errors: ValidationError[] — пустой [] когда поле валидно
  // valid: boolean
  // shouldShowError: invalid && (touched || dirty) — показывать ошибку только после взаимодействия

  return (
    <div>
      <input value={value} onChange={(e) => form.name.setValue(e.target.value)} />
      {shouldShowError && errors[0] && <span className="error">{errors[0].message}</span>}
    </div>
  );
}
```

| Поле состояния      | Тип                 | Назначение                                              |
| ------------------- | ------------------- | ------------------------------------------------------- | --- | ----------------------------- |
| `value`             | `T`                 | текущее значение поля                                   |
| `errors`            | `ValidationError[]` | ошибки поля; `[]` когда валидно                         |
| `valid` / `invalid` | `boolean`           | прошло ли поле проверку                                 |
| `touched` / `dirty` | `boolean`           | взаимодействовал ли пользователь / менялось ли значение |
| `shouldShowError`   | `boolean`           | `invalid && (touched                                    |     | dirty)` — удобный флаг для UI |
| `pending`           | `boolean`           | идёт асинхронная валидация                              |

:::info `@reformer/ui-kit`
Универсальный `FormField` из `@reformer/ui-kit` уже подписан на `useFormControl` — он сам покажет
ошибку и индикатор `pending`. Свои обёртки нужны, только если вы не используете ui-kit.
:::

## Объект ошибки

Каждая ошибка — это `ValidationError`:

```typescript
interface ValidationError {
  code: string; // машинный код: 'required', 'email', 'minLength', …
  message: string; // текст для пользователя
  params?: Record<string, FormValue>; // данные ошибки: { minLength: 2, actualLength: 1 }
  severity?: 'error' | 'warning'; // 'error' (по умолчанию) блокирует submit; 'warning' — нет
}
```

```typescript
// Пример содержимого form.name.errors (валидаторам передан свой { message }):
[]; // — когда валидно
[{ code: 'required', message: 'Укажите имя' }]; // — required не пройден
[{ code: 'minLength', message: 'Минимум 2 символа', params: { minLength: 2, actualLength: 1 } }];
```

:::tip Пустое сообщение = резолв по коду
Если валидатору не передать `{ message }`, в `message` попадёт пустая строка (или `'invalid'`), а
человекочитаемый текст резолвится из `code` в слое отображения (`@reformer/ui-kit`). Свой текст
задаётся опцией: `required({ message: 'Укажите имя' })`.
:::

## Условная валидация

Правила, действующие только в части формы, оборачиваются оператором `validateWhen(cond, cb)`. Пока
`cond()` возвращает `false`, правила внутри `cb` не выполняются, а поля, которых они касаются,
**гасятся** — их ошибки очищаются.

```typescript
const orderValidation = defineValidationSchema<OrderForm>(({ model }) => {
  validate(model.$.contactMethod, [required()]);
  // Телефон обязателен, только если выбран контакт по телефону:
  validateWhen(
    () => model.contactMethod === 'phone',
    () => validate(model.$.phone, [required()])
  );
});

const ok = await validateModel(model, orderValidation);
```

Условие `cond` читает значения напрямую из модели (`model.contactMethod`), а не из сигнала
(`model.$.contactMethod`) — раннер вычисляет его во время прогона. `validateWhen` управляет только
активностью правил; включение/сброс самого поля — это уже [поведение](/docs/behaviors/overview)
(`enableWhen`), отдельный слой.

## Дальше

- [Встроенные валидаторы](/docs/validation/built-in) — полный список фабрик с сигнатурами.
- [Кастомные валидаторы](/docs/validation/custom) — свои правила и кросс-полевые проверки.
- [Асинхронная валидация](/docs/validation/async) — проверки через сервер.
- [Стратегии валидации](/docs/validation/validation-strategies) — `updateOn`, debounce, пошаговые формы.
- [Обработка ошибок](/docs/validation/error-handling) — чтение, фильтрация и отображение ошибок.

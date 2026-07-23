# Контракты схем формы — канонический spec (freeze)

Источник истины для миграции. Отражает **реализованный** код: валидация — `@reformer/core/validation`
([validation-schema.ts](../../packages/reformer/src/form/validation-schema.ts)); поведение — `@reformer/core/behaviors`.
План миграции: [migration-validation-behavior-contract.md](migration-validation-behavior-contract.md).
Подробные листинги-примеры: [валидация](schema-contract-validation-apply.md) · [обе схемы](schema-contract-two-ambient-listing.md).

Два **раздельных** ambient-контракта одинакового стиля: валидация (прогон по требованию, снапшот) и поведение
(реактивно, живые подписки). Кормятся в форму по разным каналам.

---

## 1. Валидация — `@reformer/core/validation`

### Типы

```ts
// Синхронное правило. scope/root = never — чтобы value-only фабрики (required()/min() = ModelValidator
// (value,model,root)) И inline (value)=>err присваивались в Rule[], сохраняя проверку типа поля.
type Rule<T> = (value: T, scope: never, root: never) => ValidationError | null;

// Асинхронное правило. Получает AbortSignal (отмена устаревших ответов). Сбой сети → верните null.
type AsyncRule<T> = (value: T, ctx: { signal: AbortSignal }) => Promise<ValidationError | null>;

// Схема — обычная функция над (под)моделью. First-class: apply / прямой вызов к под-модели / юнит-тест.
type ValidationSchema<T> = (ctx: { model: FormModel<T> }) => void;
```

> ⚠️ **`Rule<T>` несёт `never`-параметры намеренно.** Автор-facing ментальная модель — `(value) => error`, но тип
> carries `scope:never, root:never`, иначе 3-параметровые фабрики не присвоятся в `Rule[]`. Раннер вызывает правило
> через каст `(rule as ModelValidator)(value, model, model)`. Так `validate(model.$.age, [email()])` подсветится ошибкой.

### Операторы (ambient — только внутри прогона `validateModel`)

| Оператор | Назначение |
|---|---|
| `validate(sig, rules[])` | синхронные правила поля |
| `validateAsync(sig, asyncRules[])` | асинхронные правила (раннер дожидается, прокидывает `AbortSignal`) |
| `validateWhen(cond, cb)` | условная валидация: правила внутри активны/гасятся по `cond` (не трогает enable — это поведение) |
| `cross(sig, fn)` | cross-field; `fn` получает снапшот модели ТЕКУЩЕГО scope (`model.get()`) |
| `each(arr, itemFn)` | per-item по элементам массива модели |
| `apply(...schemas)` | композиция под-схем над той же моделью (заменяет пошаговую группировку) |

Переиспользование под-модели (адрес и т.п.) — **прямой вызов**: `addressValidation({ model: model.registrationAddress })`
(схема — обычная функция). Для cross над элементом массива/под-моделью захватывайте `im.get()` в замыкание.

### `defineValidationSchema` + раннер

```ts
defineValidationSchema<T>(fn: ValidationSchema<T>): ValidationSchema<T>   // тонкая identity-обёртка
validateModel<T>(model: FormModel<T>, schema: ValidationSchema<T>): Promise<boolean>   // внешний раннер
```

### Семантика (реализована и покрыта тестами)

- Ambient-окно живёт только на время **синхронного** прогона `schema` внутри `validateModel`; операторы вне окна бросают.
- Ошибки роутятся в ноды через `getNodeForSignal(sig).setErrors(...)` (тот же реестр, что у форм/поведения).
- **Гашение** — накопительный `owned` на пару **(model, schema)**: поле, ставшее валидным (или в выключенной `validateWhen`-ветке),
  получает `setErrors([])`. Разные (model, schema) не мешают друг другу.
- **`severity:'warning'`** не блокирует submit (`validateModel` возвращает `true`, ошибка при этом показывается).
- **Устаревший прогон** той же (model, schema) отменяется через `AbortController` (abort предыдущего; после `await`
  роутинг применяется только если не `aborted`); `AbortSignal` прокидывается в `validateAsync` для отмены fetch.

### Конфиг wizard'а (инвариант, слой потребления не меняется)

```ts
function makeValidationConfig(model: M) {
  return {
    validateStep: (n: number) => validateModel(model, STEP_SCHEMAS[n - 1]),
    validateAll: () => validateModel(model, formValidation),   // formValidation = apply(...STEP_SCHEMAS, formExtras)
  };
}
```

---

## 2. Поведение — `@reformer/core/behaviors` (канон, без изменений)

```ts
defineFormBehavior<T>(({ model, form }) => { … })   // → createForm({ behavior })
```

Операторы: `compute/computeFrom/copyFrom/onChange/watchField/enableWhen/disableWhen/resetWhen/syncFields/
transformValue/apply/applyEach/revalidateWhen` (ambient, самрегистрация через `getScope`; lifecycle — у формы).

Граница ответственности: поведение **не владеет** валидацией (отдельный слой). Мост «поведение инициирует валидацию»:

```ts
revalidateWhen([model.$.dep], () => void validateModel(model, schema));
```

---

## 3. Симметрия контрактов

| | Валидация | Поведение |
|---|---|---|
| Контракт | `defineValidationSchema(({model})=>…)` | `defineFormBehavior(({model,form})=>…)` |
| Стиль | ambient, голые операторы | ambient, голые операторы |
| Семантика | снапшот, по требованию (submit/шаг) | реактивно, живые подписки |
| Раннер / lifecycle | `validateModel(model, schema)` | `createForm({ behavior })` |
| Ambient-окно | на время `validateModel`-прогона | на время построения формы |
| Экспорт | `@reformer/core/validation` | `@reformer/core/behaviors` |

Замороженные решения (см. план, раздел «Зафиксированные решения»): раннер `validateModel`; сабпат `@reformer/core/validation`;
identity-обёртка `defineValidationSchema`; старый движок — deprecated → удаление в Ф6; async — `(value, {signal})` + generation/abort.

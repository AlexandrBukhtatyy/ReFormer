## 1. API Reference

### Imports (CRITICALLY IMPORTANT)

Значения живут в **модели** (`createModel`), а форма (`createForm`) строит ноды поверх сигналов модели. Схема, правила и поведение привязываются к ручкам модели (`model.$.field`), а не к строковым путям.

| What                                                                                                   | Where                       |
| ------------------------------------------------------------------------------------------------------ | --------------------------- |
| `createModel`, `createForm`, `createFormFromModel`, `arrayOf`, `modelOf`                              | `@reformer/core`            |
| `defineValidationSchema`, `validate`, `validateAsync`, `validateWhen`, `apply`, `applyEach`          | `@reformer/core/validation` |
| `validateModel`, `runValidation`, `applyValidationResult` (раннер)                                    | `@reformer/core/validation` |
| `Rule`, `AsyncRule`, `ValidationSchema`, `ValidationScope`, `ValidationResult` (типы)                | `@reformer/core/validation` |
| `useFormBundle`, `useFormControl`, `useFormControlValue`, `useArrayLength`                            | `@reformer/core`            |
| `FormModel`, `FormProxy`, `FormBundle`, `FieldNode`, `GroupNode`, `ModelArrayNode`                   | `@reformer/core`            |
| `ModelSignals`, `ModelArray`, `ModelValue`, `ModelObject`, `PathAwareSignal`                          | `@reformer/core`            |
| `ValidationError`, `FormSchemaNode`, `FormValidation`, `FieldControlState`                            | `@reformer/core`            |
| `computeFrom`, `copyFrom`, `watchField`, `transformValue`, `resetWhen`, `syncFields`, `revalidateWhen` | `@reformer/core/model` (примитивы над сигналами) |
| `required`, `min`, `max`, `minLength`, `maxLength`, `email`, `pattern`, `url`, `phone`                | `@reformer/core/validators` |
| `isNumber`, `integer`, `multipleOf`, `nonNegative`, `nonZero`                                          | `@reformer/core/validators` |
| `isDate`, `minDate`, `maxDate`, `pastDate`, `futureDate`, `minAge`, `maxAge`                           | `@reformer/core/validators` |
| `defineFormBehavior`, `compute`, `computeFrom`, `copyFrom`, `onChange`, `enableWhen`, `disableWhen`   | `@reformer/core/behaviors`  |
| `transformValue`, `resetWhen`, `syncFields`, `revalidateWhen`, `apply`, `applyEach`, `aggregateInto`  | `@reformer/core/behaviors`  |
| `exclusiveFlag`, `onDispose`, `getScope`, `effect`, `defer`                                            | `@reformer/core/behaviors`  |

> **Поведение формы — `@reformer/core/behaviors`.** Декларативный DSL (`defineFormBehavior` +
> операторы) регистрирует cleanup сам и передаётся в `createForm({ behavior })`. Примитивы над
> сигналами (`computeFrom`, `copyFrom`, `watchField`, …) в корень `@reformer/core` не входят: они
> лежат в сабпате `@reformer/core/model`, принимают **сигналы** (`model.$.x`), возвращают
> **cleanup-функцию** и нужны вне формы. `enableWhen` / `disableWhen` существуют только как
> операторы поведения. См. `20-compute-vs-watch.md`.

> **Валидация — отдельный слой.** Схема формы правил НЕ несёт. Правила живут в
> `defineValidationSchema<T>(({ model, cross }) => { validate(model.$.x, [required(), min(50000)]); ... })`
> из `@reformer/core/validation`; фабрики `required()`, `min(50000)`, `email()` возвращают
> `Rule<T> = (value: T) => ValidationError | null` и передаются массивом в `validate(sig, [...])`.
> Запуск — раннером: `validation.validateAll()` сборки либо `await validateModel(model, schema)`
> (`Promise<boolean>`, ошибки сам разносит по нодам). Полный результат со статусом
> (`valid` / `invalid` / `error` / `cancelled`) — `runValidation`, `validation.runAll()`.
> `form.validate()` / `form.submit()` правил не запускают — отражают уже разнесённые ошибки.

### Type Values

- Опциональные числа: `number | null` (конвенция «пользователь очистил поле»)
- Опциональные строки: `string` (по умолчанию пустая строка) или `string | null`
- Form-shape тип объявляй как `type`-alias — см. `30-type-safety-recipes.md`

### React Hooks Comparison (CRITICALLY IMPORTANT)

| Hook | Return Type | Subscribes To | Use Case |
|------|-------------|---------------|----------|
| `useFormControl(field)` | `{ value, errors, disabled, touched, valid, invalid, pending, shouldShowError, componentProps }` | Все сигналы поля | Полное состояние поля, инпуты |
| `useFormControlValue(field)` | `T` (значение напрямую) | Только сигнал value | Условный рендеринг |
| `useArrayLength(array)` | `number` | Только длина массива | Реактивная длина массива |

**CRITICAL**: Не деструктурируй `useFormControlValue`! Он возвращает `T` напрямую, НЕ `{ value: T }`.

```typescript
// WRONG - will always be undefined!
const { value: loanType } = useFormControlValue(control.loanType);

// CORRECT
const loanType = useFormControlValue(control.loanType);

// CORRECT - useFormControl returns object, destructuring OK
const { value, errors, disabled } = useFormControl(control.loanType);
```

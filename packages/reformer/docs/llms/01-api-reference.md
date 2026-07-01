## 1. API Reference

### Imports (CRITICALLY IMPORTANT)

Архитектура M1: значения живут в **модели** (`createModel`), а форма (`createForm`) строит ноды поверх сигналов модели. Behaviors работают на сигналах (`model.$.field`), а не на строковых путях.

| What                                                                                                   | Where                       |
| ------------------------------------------------------------------------------------------------------ | --------------------------- |
| `createModel`, `createForm`                                                                            | `@reformer/core`            |
| `validateModel`, `validateModelSync`, `validateFormModel`                                              | `@reformer/core`            |
| `useFormControl`, `useFormControlValue`, `useArrayLength`                                              | `@reformer/core`            |
| `FormModel`, `FormProxy`, `FieldNode`, `GroupNode`, `ArrayNode`, `ModelArrayNode`                     | `@reformer/core`            |
| `ModelSignals`, `ModelArray`, `ModelValue`, `ModelObject`, `PathAwareSignal`                          | `@reformer/core`            |
| `ModelValidator`, `ValidationError`, `FieldConfig`, `FormSchema`, `FieldControlState`                 | `@reformer/core`            |
| `computeFrom`, `copyFrom`, `watchField`, `enableWhen`, `disableWhen`                                   | `@reformer/core` (примитивы) |
| `transformValue`, `resetWhen`, `syncFields`, `revalidateWhen`                                          | `@reformer/core` (примитивы) |
| `required`, `min`, `max`, `minLength`, `maxLength`, `email`, `pattern`, `url`, `phone`                | `@reformer/core/validators` |
| `isNumber`, `integer`, `multipleOf`, `nonNegative`, `nonZero`                                          | `@reformer/core/validators` |
| `isDate`, `minDate`, `maxDate`, `pastDate`, `futureDate`, `minAge`, `maxAge`                           | `@reformer/core/validators` |
| `defineFormBehavior`, `compute`, `computeFrom`, `copyFrom`, `onChange`, `enableWhen`, `disableWhen`   | `@reformer/core/behaviors`  |
| `transformValue`, `resetWhen`, `syncFields`, `revalidateWhen`, `apply`, `applyEach`, `aggregateInto`  | `@reformer/core/behaviors`  |
| `exclusiveFlag`, `onDispose`, `getScope`, `effect`, `defer`                                            | `@reformer/core/behaviors`  |

> **Два способа писать behaviors.** Низкоуровневые примитивы (`computeFrom`, `copyFrom`, `watchField`,
> `enableWhen`, …) экспортируются из `@reformer/core`, принимают **сигналы** (`model.$.x`), возвращают
> **cleanup-функцию** и вызываются императивно (например, в `useEffect`). Декларативный DSL
> (`defineFormBehavior` + операторы) экспортируется из `@reformer/core/behaviors`, регистрирует cleanup
> сам и передаётся в `createForm({ behavior })`. См. `20-compute-vs-watch.md`.

> **Валидаторы — чистые фабрики.** `required()`, `min(50000)`, `email()` возвращают функцию
> `(value) => ValidationError | null` и кладутся в поле схемы как `validators: [required(), min(50000)]`.
> Валидация запускается через `validateFormModel(model, schema)` / `validateModel(model, schema)`.

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

## 1. API Reference

### Imports (CRITICALLY IMPORTANT)

Значения живут в **модели** (`createModel`), а форма (`createForm`) строит ноды поверх сигналов модели. Схема, правила и поведение привязываются к ручкам модели (`model.$.field`), а не к строковым путям.

| What                                                                                                   | Where                       |
| ------------------------------------------------------------------------------------------------------ | --------------------------- |
| `createModel`, `createForm`, `createFormFromModel`, `arrayOf`, `modelOf`                               | `@reformer/core`            |
| `compileSchema`, `createFormFlow`, `createFormLevel`, `getNodeForSignal`                               | `@reformer/core`            |
| `isFormNode`, `isFormControl`, `isFormGroup`, `isFormArray` (гарды нод)                                | `@reformer/core`            |
| `FormModel`, `FormBundle`, `FormNode`, `FormControl`, `FormGroup`, `FormArray`, `FormFields`           | `@reformer/core`            |
| `ModelSignals`, `ModelArray`, `ModelValue`, `ModelObject`, `PathAwareSignal`                           | `@reformer/core`            |
| `ValidationIssue`, `RuleOptions`, `FormSchemaNode`, `ComponentRef`, `CompiledSchema`                   | `@reformer/core`            |
| `FormValidation`, `FormFlowConfig`, `FormFlow`, `FlowTransition`, `SubmitResult`                       | `@reformer/core`            |
| `defineValidation`, `validate`, `validateAsync`, `validateWhen`, `apply`, `applyEach`                  | `@reformer/core/validation` |
| `validateModel`, `runValidation`, `applyValidationResult` (раннер), `createFormValidation`             | `@reformer/core/validation` |
| `Rule`, `AsyncRule`, `ValidationDefinition`, `ValidationScope`, `ValidationResult` (типы)              | `@reformer/core/validation` |
| `useFormBundle`, `useFormControl`, `useFormControlValue`, `useArrayLength`, `useFormValidation`        | `@reformer/core/react`      |
| `useFormFlow`, `FormBundleContext`, `useFormBundleContext`                                             | `@reformer/core/react`      |
| `bindFieldProps`, `getFieldAdapter`, `FieldAdapter`, `FieldHandle`, `FieldControlState` (связка поля)  | `@reformer/core/react`      |
| `I18nProvider`, `useI18n`, `useMessages`, `useIssueMessage`                                            | `@reformer/core/react`      |
| `defineIssueMessages`, `resolveIssueMessage`, `createI18n`, `extendLocale`, `createLocaleLoader`       | `@reformer/core/i18n`       |
| `computeFrom`, `copyFrom`, `watchField`, `transformValue`, `resetWhen`, `syncFields`, `revalidateWhen` | `@reformer/core/model` (примитивы над сигналами) |
| `required`, `min`, `max`, `minLength`, `maxLength`, `email`, `pattern`, `url`, `phone`                 | `@reformer/core/validators` |
| `isNumber`, `integer`, `multipleOf`, `nonNegative`, `nonZero`                                          | `@reformer/core/validators` |
| `isDate`, `minDate`, `maxDate`, `pastDate`, `futureDate`, `minAge`, `maxAge`                           | `@reformer/core/validators` |
| `defineFormBehavior`, `compute`, `computeFrom`, `copyFrom`, `onChange`, `enableWhen`, `disableWhen`    | `@reformer/core/behaviors`  |
| `transformValue`, `resetWhen`, `syncFields`, `revalidateWhen`, `apply`, `applyEach`, `aggregateInto`   | `@reformer/core/behaviors`  |
| `exclusiveFlag`, `onDispose`, `getScope`, `effect`, `defer`                                            | `@reformer/core/behaviors`  |
| `hideWhen`, `onComponentEvent`, `renderEffect`, `onInit`, `onMount`, `onUnmount` (узлы схемы)          | `@reformer/core/behaviors`  |

> **Корень `@reformer/core` без React.** Хуки, контекст сборки, связка поля с контролом и
> провайдер локали — только из `@reformer/core/react`. Корень работает на сервере и с любым слоем
> представления.

> **Поведение формы — `@reformer/core/behaviors`.** Декларативный DSL (`defineFormBehavior` +
> операторы) регистрирует cleanup сам и передаётся в `createForm({ behavior })`. Примитивы над
> сигналами (`computeFrom`, `copyFrom`, `watchField`, …) в корень `@reformer/core` не входят: они
> лежат в сабпате `@reformer/core/model`, принимают **сигналы** (`model.$.x`), возвращают
> **cleanup-функцию** и нужны вне формы. `enableWhen` / `disableWhen` существуют только как
> операторы поведения. См. `20-compute-vs-watch.md`.

> **Валидация — отдельный слой.** Схема формы правил НЕ несёт. Правила живут в
> `defineValidation<T>(({ model, cross }) => { validate(model.$.x, [required(), min(50000)]); ... })`
> из `@reformer/core/validation`; фабрики `required()`, `min(50000)`, `email()` возвращают
> `Rule<T> = (value: T) => ValidationIssue | null` и передаются массивом в `validate(sig, [...])`.
> Правила отдают сборке: `createForm({ validation, flow })`. Запуск — уровнем формы:
> `bundle.validate()` (`ValidationResult` со статусом `valid` / `invalid` / `error` / `cancelled`),
> `bundle.validateStep(id)`, `bundle.submit(handler)` (`SubmitResult`). Без сборки — раннер
> `validateModel(model, rules)` (`Promise<boolean>`) либо `runValidation` (полный результат).
> См. `38-form-flow.md`.

> **Текста у замечания нет.** `ValidationIssue = { code, params?, severity? }`; строку по коду
> даёт словарь формы (`defineIssueMessages`) поверх словаря локали. Опции правил —
> `RuleOptions = { code?, params? }`. См. `36-issue-messages.md`.

### Type Values

- Опциональные числа: `number | null` (конвенция «пользователь очистил поле»)
- Опциональные строки: `string` (по умолчанию пустая строка) или `string | null`
- Форму данных объявляй через `interface` или `type` — оба варианта работают, см.
  `30-type-safety-recipes.md`

### React Hooks Comparison (CRITICALLY IMPORTANT)

| Hook | Return Type | Subscribes To | Use Case |
|------|-------------|---------------|----------|
| `useFormControl(field)` | `{ value, issues, disabled, touched, dirty, valid, invalid, pending, shouldShowError, shouldShowIssues, componentProps }` | Все сигналы поля | Полное состояние поля, инпуты |
| `useFormControlValue(field)` | `T` (значение напрямую) | Только сигнал value | Условный рендеринг |
| `useArrayLength(array)` | `number` | Только длина массива | Реактивная длина массива |
| `useFormFlow(bundle.flow)` | `{ current, index, completed, isFirst, isLast, validating }` | Сигналы потока шагов | Свои кнопки и индикатор шагов |
| `useIssueMessage(messages?)` | `(issue) => string` | Локаль | Текст замечания в своём компоненте |

**CRITICAL**: Не деструктурируй `useFormControlValue`! Он возвращает `T` напрямую, НЕ `{ value: T }`.

```typescript
// WRONG - will always be undefined!
const { value: loanType } = useFormControlValue(control.loanType);

// CORRECT
const loanType = useFormControlValue(control.loanType);

// CORRECT - useFormControl returns object, destructuring OK
const { value, issues, disabled } = useFormControl(control.loanType);
```

## 15. NON-EXISTENT API (DO NOT USE)

**Следующего API НЕТ в @reformer/core** (наследие старой path-based архитектуры,
удалено при переходе на M1 и при разделении валидации/поведения):

> ⚠️ Операторы валидации `validate`/`validateAsync`/`validateWhen`/`cross`/`each`/`apply`
> **существуют** — но живут в сабпути `@reformer/core/validation` (ambient-схема
> `defineValidationSchema(({ model }) => …)`, раннер `validateModel`), а НЕ в корне и НЕ
> в `@reformer/core/validators`. Ниже перечислено то, чего действительно нет.

| Wrong                            | Correct                                          | Notes                                          |
| -------------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| `useForm`                        | `createModel` + `createForm`                     | Хука useForm нет                               |
| `validateForm`, `validateFormModel` | `validateModel(model, schema)` из `@reformer/core/validation` | Legacy-движок дерева `{ value, validators }` удалён; внешний раннер — `validateModel` |
| `validateModelSync`              | `await validateModel(model, schema)`             | Синхронного раннера нет — прогон асинхронный (`Promise<boolean>`) |
| `applyWhen`                      | `validateWhen(() => cond, () => { … })`          | Условная валидация — оператором `validateWhen`, не узлом `{ when, children }` |
| `validateItems`, `validateGroup`, `validateTree` | `each(model.arr, (im) => { … })` | Per-item — оператором `each`; под-схема — прямой вызов `sub({ model: model.child })` |
| `ValidationSchemaFn`, `BehaviorSchemaFn` | `ValidationSchema<T>` (`defineValidationSchema`) / `defineFormBehavior` | Типы path-схем удалены |
| `equalTo`, `custom`, `notEmpty` (validators) | inline `Rule<T>` `(value) => err \| null` в `validate(sig, [...])`; сравнение полей — `cross(sig, fn)` | Таких фабрик нет; кастомное правило — обычная функция значения, cross-field — `cross` |
| `form.submit()` / `form.validate()` прогоняют схему | `await validateModel(model, schema)` перед submit/шагом | submit/validate НЕ запускают ambient-схему валидации |
| `FieldPath`, `FieldPathNode`     | `model.$.field` (`PathAwareSignal`)              | Пути заменены сигналами                         |
| `ctx.form.x.value.value`         | `model.x` / `model.$.x.value`                    | В behaviors читаем модель напрямую              |
| `ctx.setFieldValue(name, value)` | `model.x = value` / `compute(...)`               | Не существует                                   |
| `transformers`, `createTransformer` | `transformValue(signal, fn)`                  | Готового набора трансформеров нет               |
| `useHiddenCondition`             | `useFormControlValue` + условный рендер в JSX    | Хука нет                                        |
| `FormProvider`, `control` prop, `register()` | `<Component form={form} />`, `useFormControl(form.field)` | Форма передаётся через props |
| `getFieldValue()`                | `model.field` / `useFormControlValue(form.field)`| Не существует                                   |

### Common Import Errors

```typescript
// WRONG - этих символов / путей НЕ существует
import { useForm, validateForm, validateFormModel } from '@reformer/core';        // NO!
import { validate, applyWhen, equalTo } from '@reformer/core/validators';         // NO! операторов тут нет
import { transformers } from '@reformer/core/behaviors';                          // NO!
import type { FieldPath, ValidationSchemaFn } from '@reformer/core';              // NO!

// CORRECT
import { createModel, createForm, useFormControl } from '@reformer/core';
import type { FormModel, ValidationError, FieldConfig } from '@reformer/core';
// Операторы валидации + раннер + defineValidationSchema — отдельный сабпуть:
import {
  validate, validateAsync, validateWhen, cross, each, apply,
  defineValidationSchema, validateModel,
  type Rule, type AsyncRule, type ValidationSchema,
} from '@reformer/core/validation';
// Фабрики-валидаторы (value-only, принимают nullable):
import { required, email, min, minLength, pattern } from '@reformer/core/validators';
// Поведение (отдельный слой, контракт не менялся):
import { defineFormBehavior, compute, onChange, revalidateWhen } from '@reformer/core/behaviors';
```

### Schema Common Mistakes

Валидация и layout — **разные** контракты. Layout-узел привязывает поле к сигналу и
НЕ несёт `validators`; правила живут в отдельной `defineValidationSchema`.

```typescript
// WRONG - примитив/литерал вместо сигнала, и validators прямо в layout-узле
const schema = {
  name:  '',                                       // нет привязки к сигналу
  email: { value: '', validators: [required()] },  // value — литерал, а validators в layout больше нет
};

// CORRECT - layout только связывает поле с сигналом модели...
const layout = {
  name:  { value: model.$.name,  component: Input, componentProps: { label: 'Name' } },
  email: { value: model.$.email, component: Input, componentProps: { label: 'Email' } },
};

// ...а правила — отдельная ambient-схема (прогоняется раннером validateModel):
const validation = defineValidationSchema<Form>(({ model }) => {
  validate(model.$.email, [required({ message: 'Email обязателен' }), email()]);
});
```

### Behaviors Common Mistakes

```typescript
// WRONG - строковые пути и (form) => ... — старый API
enableWhen(path.city, (form) => Boolean(form.country));

// CORRECT - сигналы модели, условие читает model
enableWhen(model.$.city, () => Boolean(model.country), { resetOnDisable: true });
```

Поведение **не владеет** валидацией. Чтобы поведение инициировало прогон схемы — мост
`revalidateWhen` (validate/submit сами схему не запускают):

```typescript
// CORRECT - поведение дёргает внешний раннер валидации при изменении зависимости
revalidateWhen([model.$.password], () => void validateModel(model, validation));
```

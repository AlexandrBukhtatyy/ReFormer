## 15. NON-EXISTENT API (DO NOT USE)

**Следующего API НЕТ в @reformer/core** (наследие старой path-based архитектуры,
удалено при переходе на M1 и при разделении валидации/поведения):

> ⚠️ Операторы валидации `validate`/`validateAsync`/`validateWhen`/`apply`/`applyEach`
> **существуют** — но живут в сабпути `@reformer/core/validation` (схема
> `defineValidationSchema(({ model, cross }) => …)`, раннер `validateModel`), а НЕ в корне и НЕ
> в `@reformer/core/validators`. Ниже перечислено то, чего действительно нет.

| Wrong                            | Correct                                          | Notes                                          |
| -------------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| `useForm`                        | `createModel` + `createForm`                     | Хука useForm нет                               |
| `validateForm`, `validateFormModel` | `validateModel(model, schema)` из `@reformer/core/validation` | Legacy-движок дерева `{ value, validators }` удалён; внешний раннер — `validateModel` |
| `validateModelSync`              | `await validateModel(model, schema)`             | Синхронного раннера нет — прогон асинхронный (`Promise<boolean>`) |
| `applyWhen`                      | `validateWhen(() => cond, () => { … })`          | Условная валидация — оператором `validateWhen`, не узлом `{ when, children }` |
| `validateItems`, `validateGroup`, `validateTree` | `applyEach(model.$.arr, rowRules)` / `apply(model.$.group, groupRules)` | Правила строк и подформы — отдельные схемы, подключённые привязкой |
| `ValidationSchemaFn`, `BehaviorSchemaFn` | `ValidationSchema<T>` (`defineValidationSchema`) / `defineFormBehavior` | Типы path-схем удалены |
| `equalTo`, `custom`, `notEmpty` (validators) | inline `Rule<T>` `(value) => err \| null` в `validate(sig, [...])`; сравнение полей — `cross(sig, fn)` | Таких фабрик нет; кастомное правило — обычная функция значения, cross-field — `cross` |
| `form.submit()` / `form.validate()` прогоняют схему | `await validateModel(model, schema)` перед submit/шагом | `validate()` и `submit()` правил не запускают: они отражают ошибки, которые разнёс раннер, и ничего не стирают |
| `FieldPath`, `FieldPathNode`     | `model.$.field` (`PathAwareSignal`)              | Пути заменены сигналами                         |
| `ctx.form.x.value.value`         | `model.x` / `model.$.x.value`                    | В behaviors читаем модель напрямую              |
| `ctx.setFieldValue(name, value)` | `model.x = value` / `compute(...)`               | Не существует                                   |
| `transformers`, `createTransformer` | `transformValue(signal, fn)`                  | Готового набора трансформеров нет               |
| `useHiddenCondition`             | `useFormControlValue` + условный рендер в JSX    | Хука нет                                        |
| `FormProvider`, `control` prop, `register()` | `<Component form={form} />`, `useFormControl(form.field)` | Форма передаётся через props |
| `getFieldValue()`                | `model.field` / `useFormControlValue(form.field)`| Не существует                                   |

### Удалено вместе со старым путём сборки формы

Форма собирается только из модели: `createForm({ initial | model, schema })`. Ноды строятся по
виду узла модели, правила живут в схеме валидации.

| Wrong                            | Correct                                          | Notes                                          |
| -------------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| `createLegacyForm(schema)`       | `createForm({ initial, schema })`                | Формы без модели нет                            |
| `new GroupNode({ email: { value, component } })` | `createFormFromModel({ model, schema })` | `GroupNode` принимает готовые ноды детей, а не конфиг |
| `new FieldNode({ value: '' })`   | `new FieldNode({ valueSignal: model.$.email })`  | Нода значением не владеет — только сигнал модели |
| `FieldConfig.validators` / `asyncValidators` | `validate` / `validateAsync` в `defineValidationSchema` | Собственных валидаторов у ноды нет |
| `updateOn`, `debounce` узла поля; `field.setUpdateOn()` / `getUpdateOn()` | `validation: { strategy, debounce }` в `createForm` | Когда запускать проверку, решает стратегия валидации формы |
| `field.setValue(value, { emitEvent: false })` | `field.setValue(value)`                | Опций у `setValue` нет                          |
| `ArrayNode`                      | `ModelArrayNode`                                 | Узел массива один — над массивом модели         |
| `NodeFactory`                    | —                                                | Сборка по ключам конфига удалена                |
| `FormErrorHandler`, `ErrorStrategy` | —                                           | Обслуживали валидаторы ноды                     |
| `FormSchema<T>`, `GroupNodeConfig<T>` | `FormSchemaNode`                          | Схема — дерево узлов, а не запись по полям      |
| `ValidatorFn`, `AsyncValidatorFn`, `Validator<TForm, TField>` | `Rule<T>`, `AsyncRule<T>` из `@reformer/core/validation` | Правило — функция одного аргумента |

### Прежние ключи узла схемы

| Wrong                            | Correct                                          | Notes                                          |
| -------------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| `{ value: model.$.email, component }` | `{ model: model.$.email, component }`     | Привязка поля — ключ `model`                   |
| `{ array: model.items, item }`   | `{ model: model.$.items, item }`                 | Привязка массива под-форм — ручка, а не фасад   |
| `{ email: { model, component } }` (запись «имя → узел») | `{ children: [{ model, component }] }` | Вложенные узлы читаются только из `children` |
| узел внутри `componentProps`     | узел в `children`                                | В пропсы обход схемы не заглядывает            |
| `testId` ключом узла             | `componentProps: { testId }`                     | Ключа узла `testId` нет                        |

### Операторы над сигналами — не в корне

`computeFrom`, `copyFrom`, `watchField`, `transformValue`, `resetWhen`, `syncFields`,
`revalidateWhen`, `enableWhen`, `disableWhen` из `@reformer/core` не импортируются.

| Wrong                            | Correct                                          |
| -------------------------------- | ------------------------------------------------ |
| `import { enableWhen, copyFrom } from '@reformer/core'` | `import { enableWhen, copyFrom } from '@reformer/core/behaviors'` — внутри `defineFormBehavior` |
| `import { watchField } from '@reformer/core'` | `onChange` из `@reformer/core/behaviors`; сам примитив — `@reformer/core/model` |
| `import { computeFrom } from '@reformer/core'` | `compute` / `computeFrom` из `@reformer/core/behaviors` |

### UI: удалённые field-версии компонентов (`@reformer/ui-kit`)

Отдельных «field-версий» у компонентов кита больше нет: в `component` поля кладётся сам
компонент, диалект он объявляет статикой `reformerAdapter`, связывает поле обёртка
(`FormField.Control` / рендерер).

| Wrong                                          | Correct                                                   |
| ---------------------------------------------- | --------------------------------------------------------- |
| `InputField`, `SelectField`, `CheckboxField`, … (любой `*Field`) | `Input`, `SelectAsync`, `CheckboxWithLabel`, … — таблица в ui-kit `01-overview.md` |
| `InputField` + `type: 'number'`                | `InputNumber`                                             |
| `InputField` + `suggestions`                   | `InputSuggest`                                            |
| `FileUploadField` + `variant: 'dropzone' \| 'input'` | `FileUploadDropzone` / `FileUploadInput` (без `variant`) |
| `withFormControl(MyControl, adapter)`          | `defineFieldControl(MyControl, { adapter })` из `@reformer/ui-kit/fields` |

### Common Import Errors

```typescript
// WRONG - этих символов / путей НЕ существует
import { useForm, validateForm, validateFormModel } from '@reformer/core';        // NO!
import { validate, applyWhen, equalTo } from '@reformer/core/validators';         // NO! операторов тут нет
import { transformers } from '@reformer/core/behaviors';                          // NO!
import type { FieldPath, ValidationSchemaFn } from '@reformer/core';              // NO!

// CORRECT
import { createModel, createForm, useFormControl } from '@reformer/core';
import type { FormModel, FormSchemaNode, ValidationError } from '@reformer/core';
// Операторы валидации + раннер + defineValidationSchema — отдельный сабпуть:
import {
  validate, validateAsync, validateWhen, apply, applyEach,
  defineValidationSchema, validateModel, runValidation, applyValidationResult,
  type Rule, type AsyncRule, type ValidationSchema, type ValidationResult,
} from '@reformer/core/validation';
// Фабрики-валидаторы — правила значения `Rule<T>`, пустое значение пропускают:
import { required, email, min, minLength, pattern } from '@reformer/core/validators';
// Поведение (отдельный слой, контракт не менялся):
import { defineFormBehavior, compute, onChange, revalidateWhen } from '@reformer/core/behaviors';
```

### Schema Common Mistakes

Валидация и разметка — **разные** контракты. Узел схемы привязывает поле к ручке модели и
правил не несёт; правила живут в отдельной `defineValidationSchema`.

```typescript
// WRONG - запись «имя → узел», литерал вместо ручки и validators прямо в узле
const schema = {
  name:  '',                                       // нет привязки к модели
  email: { value: '', validators: [required()] },  // ни ключа value, ни validators у узла нет
};

// CORRECT - схема только связывает поле с ручкой модели...
const schema: FormSchemaNode = {
  children: [
    { model: model.$.name, component: Input, componentProps: { label: 'Name' } },
    { model: model.$.email, component: Input, componentProps: { label: 'Email' } },
  ],
};

// ...а правила — отдельная схема (прогоняется раннером validateModel):
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

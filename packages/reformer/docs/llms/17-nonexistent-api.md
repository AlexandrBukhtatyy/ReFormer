## 15. NON-EXISTENT API (DO NOT USE)

**Следующего API НЕТ в @reformer/core** (наследие старой path-based архитектуры и прежних
контрактов модели, валидации, схемы, визарда и нод):

> ⚠️ Операторы валидации `validate`/`validateAsync`/`validateWhen`/`apply`/`applyEach`
> **существуют** — но живут в сабпути `@reformer/core/validation` (схема
> `defineValidation(({ model, cross }) => …)`, раннер `validateModel`), а НЕ в корне и НЕ
> в `@reformer/core/validators`. Ниже перечислено то, чего действительно нет.

| Wrong                            | Correct                                          | Notes                                          |
| -------------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| `useForm`                        | `createForm` + `useFormBundle`                   | Хука useForm нет                               |
| `FormValue`                      | тип значения самого поля либо `unknown`          | Тип удалён: модель обобщённая (`createModel<T>`), параметры замечания — `Record<string, unknown>` |
| `value instanceof Signal`        | `isSignal(value)` из `@reformer/core/signals`    | Проверка по классу не узнаёт сигнал другой копии рантайма; ручку поля проверяет `isValueSignal` |
| `import { useFormControl, useFormBundle, … } from '@reformer/core'` | те же имена из `@reformer/core/react` | Корень ядра без React: хуки (`useFormControl`, `useFormControlValue`, `useArrayLength`, `useFormValidation`, `useFormBundle`, `useFormFlow`), `FormBundleContext`, связка поля (`bindFieldProps`, `getFieldAdapter`, `FieldAdapter`, `FieldHandle`) и типы снимков (`FieldControlState`, `ArrayControlState`) отдаёт только сабпат `/react` |
| `import { I18nProvider, useI18n, … } from '@reformer/core/i18n'` | те же имена из `@reformer/core/react` | `/i18n` — локаль, перевод и тексты замечаний без React; провайдер и хуки (`I18nProvider`, `useI18n`, `useMessages`, `useIssueMessage`) — в `/react` |
| `ElementType` / `ComponentType` в типе узла схемы | `ComponentRef` из `@reformer/core` | Типы схемы и ноды не импортируют типы React: `component` — непрозрачная ссылка (`string | object`), к типу своего UI-слоя её приводит рендерер |
| `validateForm`, `validateFormModel` | `validateModel(model, schema)` из `@reformer/core/validation` | Legacy-движок дерева `{ value, validators }` удалён; внешний раннер — `validateModel` |
| `validateModelSync`              | `await validateModel(model, schema)`             | Синхронного раннера нет — прогон асинхронный (`Promise<boolean>`) |
| `applyWhen`                      | `validateWhen(() => cond, () => { … })`          | Условная валидация — оператором `validateWhen`, не узлом `{ when, children }` |
| `validateItems`, `validateGroup`, `validateTree` | `applyEach(model.$.arr, rowRules)` / `apply(model.$.group, groupRules)` | Правила строк и подформы — отдельные схемы, подключённые привязкой |
| `ValidationSchemaFn`, `BehaviorSchemaFn` | `ValidationDefinition<T>` (`defineValidation`) / `defineFormBehavior` | Типы path-схем удалены |
| `equalTo`, `custom`, `notEmpty` (validators) | inline `Rule<T>` `(value) => issue \| null` в `validate(sig, [...])`; сравнение полей — `cross(sig, fn)` | Таких фабрик нет; кастомное правило — обычная функция значения, cross-field — `cross` |
| `FieldPath`, `FieldPathNode`     | `model.$.field` (`PathAwareSignal`)              | Пути заменены сигналами                         |
| `ctx.form.x.value.value`         | `model.x` / `model.$.x.value`                    | В behaviors читаем модель напрямую              |
| `ctx.setFieldValue(name, value)` | `model.x = value` / `compute(...)`               | Не существует                                   |
| `transformers`, `createTransformer` | `transformValue(signal, fn)`                  | Готового набора трансформеров нет               |
| `useHiddenCondition`             | `useFormControlValue` + условный рендер в JSX    | Хука нет                                        |
| `FormProvider`, `control` prop, `register()` | `<Component form={form} />`, `useFormControl(form.field)` | Форма передаётся через props |
| `getFieldValue()`                | `model.field` / `useFormControlValue(form.field)`| Не существует                                   |

### Удалено: модель (этап 1)

| Wrong                                  | Correct                                              | Notes                                   |
| -------------------------------------- | ---------------------------------------------------- | --------------------------------------- |
| `model.set(partial)` для части полей   | `model.patch(partial)`                               | `set` — полная установка: недостающие ключи в dev дают предупреждение и не меняются; `patch` сливает переданные ключи, вложенные группы — тоже частично, массив — целиком |
| `FormValue`, `T extends FormValue`     | `T` без ограничения / `Record<string, unknown>`       | Тип удалён                              |

### Удалено: компонент массива (этап 2)

Имя `FormArray` теперь занято **типом ноды** массива под-форм в `@reformer/core`; компонент массива
в cdk и ui-kit называется `FieldArray`.

| Wrong                                             | Correct                                            | Notes                                  |
| ------------------------------------------------- | -------------------------------------------------- | -------------------------------------- |
| компонент `FormArray` (`@reformer/cdk`, `@reformer/ui-kit`) | `FieldArray`                             | `{ model: model.$.items, component: FieldArray, item }` |
| `FormArraySection`                                | `FieldArraySection`                                | ui-kit                                 |
| `useFormArray`                                    | `useFieldArray`                                    | cdk                                    |
| `@reformer/cdk/form-array`, `@reformer/ui-kit/form-array` | `@reformer/cdk/field-array`, `@reformer/ui-kit/field-array` | сабпаты                     |
| ключи локали `kit.formArray.*`                    | `kit.fieldArray.*`                                 | ui-kit                                 |

JSON-документ схемы со старыми именами `FormArray` / `FormArraySection` реестр renderer-json ещё
принимает как псевдонимы (dev-предупреждение).

### Удалено: замечание валидации без текста (этап 4)

Замечание несёт код и параметры; текст по коду даёт словарь формы — см. `36-issue-messages.md`.

| Wrong                                             | Correct                                            | Notes                                  |
| ------------------------------------------------- | -------------------------------------------------- | -------------------------------------- |
| `required({ message: '…' })`, `{ messageKey }`    | `required({ code: 'phone.required' })` + `defineIssueMessages({ 'phone.required': '…' })` | У `RuleOptions` только `code` и `params` |
| `ValidationError` (`{ code, message, … }`)        | `ValidationIssue` (`{ code, params?, severity? }`) | Поля `message` нет — текст через резолвер |
| `ValidateOptions`                                 | `RuleOptions`                                      | `{ code?, params? }`                    |
| `ValidationSchema`, `defineValidationSchema`      | `ValidationDefinition`, `defineValidation`         | `@reformer/core/validation`             |
| `resolveValidationError`                          | `resolveIssueMessage(issue, i18n, messages?)`      | `@reformer/core/i18n`                   |
| `useValidationMessage`                            | `useIssueMessage(messages?)`                       | `@reformer/core/react`                  |
| `node.errors`, `setErrors`, `clearErrors`          | `node.issues`, `setIssues`, `clearIssues`          | И в снимке `useFormControl` — `issues`  |
| `result.errors` у `ValidationResult`              | `result.issues`                                    | Замечания по ручке поля                 |
| `getErrors(filter)`, `ErrorFilterOptions`         | `node.issues.value.filter(…)`                      | Фильтр — обычный `filter`               |
| `errors[0].message` в разметке                    | `useIssueMessage(messages)(issues[0])`             | Строку даёт резолвер при показе         |
| cdk `createMessageResolver`, `defaultErrorResolver`, `ValidationMessageTable` | `<ValidationMessagesProvider messages={defineIssueMessages({…})}>` | Словарь формы поверх локали |
| cdk `ValidationErrorResolver`, `useValidationErrorResolver` | `IssueMessageResolver`, `useIssueMessageResolver` | `@reformer/cdk`              |

### Удалено: схема (этап 5)

| Wrong                                             | Correct                                            | Notes                                  |
| ------------------------------------------------- | -------------------------------------------------- | -------------------------------------- |
| `bundle.render.tree` как авторское дерево         | `bundle.render.tree` — `CompiledSchema`; авторское дерево — `bundle.render.tree.root.source` | См. `37-compiled-schema.md` |
| повтор `selector` в одной области «с предупреждением» | разные селекторы                               | Повтор — исключение при сборке          |
| свой разбор ключей `model` / `item` / `part` у узла | `compileSchema(tree, model)` — `kind` узла       | `field \| array \| part \| container \| text` |

### Удалено: уровень формы, поток шагов, визард (этап 6)

| Wrong                                             | Correct                                            | Notes                                  |
| ------------------------------------------------- | -------------------------------------------------- | -------------------------------------- |
| `bundle.validation.validateAll()` / `.runAll()`   | `bundle.validate()` → `ValidationResult`           | Поле `bundle.validation` осталось служебным (`{ rules, controller }` для `useFormBundle`) — методов проверки на нём нет |
| `bundle.validation.validateStep(n)` / `.runStep(n)` | `bundle.validateStep(id)` → `ValidationResult`   | Идентификатор шага — `selector`, не номер |
| `createForm({ validation: { steps: { loan: rules } } })` | `createForm({ flow: { steps: [{ id: 'loan', rules }] } })` | Правила вне шагов — `validation: { extras }` |
| `buildValidation`, `FormValidationBundle`         | `createForm({ validation, flow })` / `createFormLevel` | Уровень формы собирает сборка       |
| `form.submit(handler)`, `SubmitOptions`, `form.submitting` | `bundle.submit(handler)` → `SubmitResult`, `bundle.submitting` | Один прогон правил; обработчик — только при `valid` |
| `form.validate()`                                 | `bundle.validate()`                                | У нод методов проверки нет              |
| `<FormWizard config={…}>`, `FormWizardConfig`     | `<FormWizard flow={bundle.flow}>`                  | Без `flow` и сборки в контексте — позиционный поток без правил |
| `<FormWizard ref={…}>`, `FormWizardHandle`, `ref.current.goToStep(n)` | `bundle.flow.goTo(id)` / `next()` / `previous()` | Навигация — методами потока |
| `defineSteps(model, { steps, extras, strategy })` | `createForm({ validation: { extras, strategy }, flow })` | Живая проверка — стратегия формы |
| `useWizardStepValidation(config)`                 | `validation: { strategy }` сборки                  | Стратегию армирует `useFormBundle`      |
| `makeValidationConfig(model)` (`validateStep(n)` / `validateAll()`) | `flow` сборки                    | Визард берёт поток, а не конфиг         |

### Удалено: ноды формы — контракты вместо классов (этап 7)

| Wrong                                             | Correct                                            | Notes                                  |
| ------------------------------------------------- | -------------------------------------------------- | -------------------------------------- |
| классы `FormNode`, `FieldNode`, `GroupNode`, `ModelArrayNode` | интерфейсы `FormNode`, `FormControl`, `FormGroup`, `FormArray` | Классы реализации внутренние; ноды строит сборка |
| `FormProxy<T>`                                    | `FormGroup<T>`                                     | Тип группы                              |
| `isFieldNode`, `isGroupNode`, `isArrayNode`       | `isFormControl`, `isFormGroup`, `isFormArray`       | Гарды по метке вида; `isFormNode` остался |
| `node instanceof FieldNode`                       | `isFormControl(node)`                              | `instanceof` по интерфейсу невозможен   |
| `node.status.value`, `FieldStatus`                | `node.valid` / `invalid` / `pending` / `disabled`  | Отдельного статуса нет                  |
| `node.patchValue(v)`                              | `node.setValue(v)` / `model.patch(partial)`        | Частичное обновление — у модели         |
| `markAsDirty()`, `markAsPristine()`               | `dirty` ставит `setValue(v)`, снимает `reset()`    | Изменились ли значения модели — `model.isDirty()` |
| `node.validate()`                                 | `bundle.validate()` / `bundle.validateStep(id)`    |                                         |
| `group.fields` (Map), `group.getProxy()`          | `form.<поле>`, `form.$` (все поля), `Object.values(form.$)` | `fields` теперь обычное поле данных |
| `node.id`                                         | ключ строки — `array.keyAt(index)`                  | `id` теперь обычное поле данных         |
| `array.items`                                     | `array.at(i)` / `map` / `forEach`                  |                                         |
| `array.length.value`                              | `array.length` (число; в эффекте подписывает)      | Не сигнал                               |
| `key={row.id}` / `key={index}` у строк массива    | `key={array.keyAt(index)}`                         | Ключ не меняется при `move` / `swap`    |

Затеняют поле группы только члены `FormNode` (`value`, `issues`, `reset`, …): такое поле берут через
`form.$.value`. Имена `id`, `status`, `fields`, `submit` — обычные поля данных.

### Удалено вместе со старым путём сборки формы

Форма собирается только из модели: `createForm({ initial | model, schema })`. Ноды строятся по
виду узла модели, правила живут в схеме валидации.

| Wrong                            | Correct                                          | Notes                                          |
| -------------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| `createLegacyForm(schema)`       | `createForm({ initial, schema })`                | Формы без модели нет                            |
| `new FormGroup({ email: { value, component } })` | `createFormFromModel({ model, schema })` | `FormGroup` — тип, ноды строит сборка   |
| `new FormControl({ value: '' })` | `createForm({ initial: { email: '' } }).form.email` | `FormControl` — тип; значение принадлежит модели |
| `FieldConfig.validators` / `asyncValidators` | `validate` / `validateAsync` в `defineValidation` | Собственных валидаторов у ноды нет |
| `updateOn`, `debounce` узла поля; `field.setUpdateOn()` / `getUpdateOn()` | `validation: { strategy, debounce }` в `createForm` | Когда запускать проверку, решает стратегия валидации формы |
| `field.setValue(value, { emitEvent: false })` | `field.setValue(value)`                | Опций у `setValue` нет                          |
| `ArrayNode`                      | `FormArray`                                      | Нода массива одна — над массивом модели         |
| `NodeFactory`                    | —                                                | Сборка по ключам конфига удалена                |
| `FormErrorHandler`, `ErrorStrategy` | —                                           | Обслуживали валидаторы ноды                     |
| `FormSchema<T>`, `GroupNodeConfig<T>` | `FormSchemaNode`                          | Схема — дерево узлов, а не запись по полям      |
| `ValidatorFn`, `AsyncValidatorFn`, `Validator<TForm, TField>` | `Rule<T>`, `AsyncRule<T>` из `@reformer/core/validation` | Правило — функция одного аргумента |

### Удалено: подписки на нодах, доступ по строковому пути, псевдонимы

Реакции живут на слое модели (`defineFormBehavior`), поле берётся через форму, у каждой
операции одно имя.

| Wrong                            | Correct                                          | Notes                                          |
| -------------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| `field.watch(cb)`, `form.watchField('email', cb)`, `form.watchFieldByPath(path, cb)` | `onChange(model.$.email, cb)` в `defineFormBehavior`; вне поведения — `watchField(model.$.email, cb)` из `@reformer/core/model` | Подписок на ноде нет |
| `field.computeFrom(sources, fn)`, `form.linkFields('a', 'b', fn)` | `compute(model.$.b, () => fn(model.a))` в `defineFormBehavior` | Вычисляемое значение — оператор поведения |
| `field.dispose()`                | —                                                | В контракте нод `dispose` нет                   |
| `form.getFieldByPath('address.city')`, `form.getField('email')` | `form.address.city`, `form.email`; имя, занятое членом ноды, — `form.$.value` | Строковых путей к нодам нет |
| `form.getAllFields()`            | `Object.values(form.$)`                          | `form.$` — ноды всех полей группы по имени      |
| `form.touchAll()`                | `form.markAsTouched()`                           | Отметка каскадная: уходит во все вложенные поля |
| `form.resetToInitial()`, `field.resetToInitial()` | `form.reset()` — к значениям создания формы; `model.reset()` — к точке отсчёта модели | См. `28-submit-and-reset.md` |
| `form.submitWithResult(handler)` | `bundle.submit(handler)` → `SubmitResult`        | Проверка и отправка одним вызовом               |
| `getNodeType(node)`              | `isFormControl` / `isFormGroup` / `isFormArray`  | Вид ноды — гардами                              |
| `each(model.items, (item) => …)` | `applyEach(model.$.items, itemRules)`            | Правила строки — отдельная схема над элементом |
| `import { cross } from '@reformer/core/validation'` | `defineValidation(({ model, cross }) => …)` | `cross` — только из аргумента схемы |
| `createCoreForm`, `CreateCoreFormConfig` | `createForm`, `CreateFormConfig`         | Сборка одна                                    |
| `FormArrayProxy<T>`              | `FormArray<T>`                                   | Псевдоним типа удалён                          |
| `FormSubmitter`, `SubmittableForm`, `SubscriptionManager`, `createSchemaOverrideMaps`, `ModelArrayControl`, `FormControlsProxy` | — | Внутренние детали, из пакета не экспортируются |

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
import { useFormControl, useFormBundle } from '@reformer/core';                   // NO! хуки — из /react
import { validate, applyWhen, equalTo } from '@reformer/core/validators';         // NO! операторов тут нет
import { defineValidationSchema, type ValidationSchema } from '@reformer/core/validation'; // NO!
import { resolveValidationError, useValidationMessage } from '@reformer/core/i18n';       // NO!
import { FieldNode, GroupNode, isFieldNode, type FormProxy } from '@reformer/core';      // NO!
import { defineSteps, useWizardStepValidation } from '@reformer/cdk/form-wizard';  // NO!
import { FormArray, useFormArray } from '@reformer/cdk/form-array';                // NO! — field-array
import { transformers } from '@reformer/core/behaviors';                          // NO!
import type { FieldPath, ValidationSchemaFn, ValidationError } from '@reformer/core'; // NO!

// CORRECT
import { createModel, createForm, isFormControl } from '@reformer/core';
import { useFormBundle, useFormControl, useIssueMessage } from '@reformer/core/react';
import type { FormModel, FormGroup, FormSchemaNode, ValidationIssue } from '@reformer/core';
// Операторы валидации + раннер + defineValidation — отдельный сабпуть:
import {
  validate, validateAsync, validateWhen, apply, applyEach,
  defineValidation, validateModel, runValidation, applyValidationResult,
  type Rule, type AsyncRule, type ValidationDefinition, type ValidationResult,
} from '@reformer/core/validation';
// Фабрики-валидаторы — правила значения `Rule<T>`, пустое значение пропускают:
import { required, email, min, minLength, pattern } from '@reformer/core/validators';
// Тексты замечаний — словарь формы:
import { defineIssueMessages } from '@reformer/core/i18n';
// Поведение (отдельный слой):
import { defineFormBehavior, compute, onChange, revalidateWhen } from '@reformer/core/behaviors';
// Компонент массива — FieldArray:
import { FieldArray, useFieldArray } from '@reformer/cdk/field-array';
```

### Schema Common Mistakes

Валидация и разметка — **разные** контракты. Узел схемы привязывает поле к ручке модели и
правил не несёт; правила живут в отдельной `defineValidation`.

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

// ...а правила — отдельная схема (уходит в createForm({ validation }) либо в validateModel):
const validation = defineValidation<Form>(({ model }) => {
  validate(model.$.email, [required({ code: 'email.required' }), email()]);
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
`revalidateWhen` (или живая стратегия сборки `validation: { strategy: 'change' }`):

```typescript
// CORRECT - поведение дёргает внешний раннер валидации при изменении зависимости
revalidateWhen([model.$.password], () => void validateModel(model, validation));
```

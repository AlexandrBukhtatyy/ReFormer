---
sidebar_position: 2
---

# Переход с прежних API

Здесь собрано, что изменилось в API ReFormer и чем заменить прежний код. Удобнее всего искать
по странице имя, которое перестало компилироваться (Ctrl+F). Руководства описывают только текущий
API, история изменений — здесь.

Изменения разложены по областям: импорты, модель, схема, сборка формы, ноды, валидация, поведение,
отправка, мастер, компоненты cdk и ui-kit, рендереры. В каждой — таблица «было → стало» и пример
замены.

:::tip ИИ-ассистент знает прежние имена
Инструмент `validate_form` сервера `@reformer/mcp` находит в коде формы удалённые имена прежнего
контракта (фабрики `createReactForm`, `createJsonForm`, ключи узла `value:` и `array:` и другие) и
называет замену. См. [MCP](/docs/mcp/overview).
:::

## Импорты и входы пакета

Корень `@reformer/core` работает без React. Хуки, провайдер языка и операторы живут в отдельных
входах пакета.

| Было                                                                | Стало                                                                           |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| хуки (`useFormBundle`, `useFormControl`, …) из `@reformer/core`     | из `@reformer/core/react`                                                       |
| `I18nProvider`, `useI18n`, `useMessages` из `@reformer/core/i18n`   | из `@reformer/core/react`                                                       |
| вход `@reformer/core/state`                                         | `@reformer/core/model` — те же экспорты                                         |
| `enableWhen`, `copyFrom`, `computeFrom` и другие операторы из корня | в схеме поведения — из `@reformer/core/behaviors`                               |
| `watchField` из корня                                               | `onChange` из `@reformer/core/behaviors`; сам примитив — `@reformer/core/model` |
| `validate`, `applyWhen` из `@reformer/core/validators`              | операторы — из `@reformer/core/validation`, правила — из `/validators`          |
| `import { cross } from '@reformer/core/validation'`                 | `cross` из аргумента схемы: `defineValidation(({ model, cross }) => …)`         |

```typescript
// было
import { createForm, useFormBundle, useFormControl } from '@reformer/core';

// стало
import { createForm } from '@reformer/core';
import { useFormBundle, useFormControl } from '@reformer/core/react';
```

## Модель

| Было                                                            | Стало                                                                         |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `model.set(часть)` для части полей                              | `model.patch(часть)`; `set` — полная установка всех ключей                    |
| `patch({ поле: undefined })` очищал поле                        | ключ со значением `undefined` не трогается — пишите пустое значение явно      |
| тип `FormValue`, `T extends FormValue`                          | `T` без ограничения; параметры замечания — `Record<string, unknown>`          |
| `insertAt` / `move` за концом массива                           | бросают `RangeError`                                                          |
| поле-группа или массив с `null` в типе давали вложенные сигналы | значение отдаётся как есть: проверьте `null` и работайте со значением целиком |

```typescript
// было
model.set({ city: 'Казань' });

// стало
model.patch({ city: 'Казань' });
```

## Схема формы

| Было                                               | Стало                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `{ value: model.$.email, component }`              | `{ model: model.$.email, component }`                                                |
| `{ array: model.items, item }`                     | `{ model: model.$.items, item }`                                                     |
| запись «имя → узел»: `{ email: { … } }`            | `{ children: [{ model: model.$.email, … }] }`                                        |
| узел внутри `componentProps`                       | узел в `children`                                                                    |
| ключ узла `testId`                                 | `componentProps: { testId }`                                                         |
| поле `text` у узла                                 | содержимое — в `children`: `children: ['Итого']`                                     |
| типы `FormSchema<T>`, `GroupNodeConfig<T>`         | `FormSchemaNode`                                                                     |
| `ElementType` / `ComponentType` в типе узла        | `ComponentRef` из `@reformer/core`                                                   |
| повтор `selector` в одной области — предупреждение | исключение при сборке                                                                |
| `disabled: true` в узле снималось `enable()` формы | постоянная блокировка: снимает только `enable()` самого поля или `enableWhen` на нём |

```typescript
// было
const schema = {
  email: { value: model.$.email, component: Input, testId: 'email' },
};

// стало
const schema = (model: FormModel<Signup>): FormSchemaNode => ({
  children: [{ model: model.$.email, component: Input, componentProps: { testId: 'email' } }],
});
```

## Сборка формы

Форма собирается одним вызовом `createForm` из модели (или `initial`) и схемы. Фабрик слоёв больше
нет.

| Было                                               | Стало                                                                                    |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `createLegacyForm(schema)`, `new FormGroup({ … })` | `createForm({ initial, schema })`; без сборки — `createFormFromModel({ model, schema })` |
| `new FormControl({ value })`                       | нода из сборки: `createForm({ initial }).form.email`                                     |
| `createCoreForm`, `CreateCoreFormConfig`           | `createForm`, `CreateFormConfig`                                                         |
| `createReactForm`, `useReactForm` (renderer-react) | `createForm` + `useFormBundle`                                                           |
| `createJsonForm`, `useJsonForm` (renderer-json)    | `createForm({ schema: документ, registry })`                                             |
| типы `CoreForm`, `CreateFormConfigBase`            | `FormBundle`, `CreateFormConfig`                                                         |
| `field.dispose()`                                  | `bundle.dispose()`; форму без сборки — `disposeForm(form)`                               |

```tsx
// вместо createReactForm / useReactForm и createJsonForm / useJsonForm
const bundle = useFormBundle(() => createForm({ model, schema })); // документ JSON: + registry
<FormRenderer form={bundle} />;
```

## Ноды

Ноды — интерфейсы `FormNode`, `FormControl`, `FormGroup`, `FormArray`; классы реализации внутренние.

| Было                                                            | Стало                                              |
| --------------------------------------------------------------- | -------------------------------------------------- |
| классы `FieldNode`, `GroupNode`, `ModelArrayNode`, `ArrayNode`  | интерфейсы `FormControl`, `FormGroup`, `FormArray` |
| `FormProxy<T>`, `FormArrayProxy<T>`                             | `FormGroup<T>`, `FormArray<T>`                     |
| `isFieldNode`, `isGroupNode`, `isArrayNode`, `getNodeType`      | `isFormControl`, `isFormGroup`, `isFormArray`      |
| `node instanceof FieldNode`                                     | `isFormControl(node)`                              |
| `node.status.value`, `FieldStatus`                              | `valid`, `invalid`, `pending`, `disabled`          |
| `node.patchValue(v)`                                            | `node.setValue(v)` или `model.patch(часть)`        |
| `field.setValue(v, { emitEvent: false })`                       | `field.setValue(v)` — опций нет                    |
| `markAsDirty()`, `markAsPristine()`                             | `dirty` ставит `setValue`, снимает `reset()`       |
| `errors`, `setErrors`, `clearErrors`                            | `issues`, `setIssues`, `clearIssues`               |
| `getErrors(filter)`, `ErrorFilterOptions`                       | `node.issues.value.filter(…)`                      |
| `group.fields`, `group.getProxy()`, `form.getAllFields()`       | `form.<поле>`, `form.$`, `Object.values(form.$)`   |
| `form.getFieldByPath('address.city')`, `form.getField('email')` | `form.address.city`, `form.email`                  |
| `node.id`, `key={row.id}`                                       | ключ строки — `array.keyAt(index)`                 |
| `array.items`                                                   | `array.at(i)`, `array.map(…)`, `array.forEach(…)`  |
| `array.length.value`                                            | `array.length` — число                             |
| `form.touchAll()`                                               | `form.markAsTouched()`                             |
| `form.resetToInitial()`, `field.resetToInitial()`               | `form.reset()`                                     |
| `field.watch(cb)`, `form.watchField('email', cb)`               | `onChange(model.$.email, cb)` в схеме поведения    |
| `field.computeFrom(…)`, `form.linkFields(…)`                    | `compute(model.$.b, () => …)` в схеме поведения    |

Выключенные группа, массив и вся форма теперь ни `valid`, ни `invalid`, как выключенное поле:
`form.valid` после `form.disable()` — `false`.

```tsx
// было
{
  rows.items.map((row) => <Row key={row.id} control={row} />);
}

// стало
{
  rows.map((row, index) => <Row key={rows.keyAt(index)} control={row} />);
}
```

## Валидация

Правила живут отдельно от схемы — в `defineValidation`. Замечание несёт код и параметры, текст
даёт словарь.

| Было                                                               | Стало                                                                                     |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `validators` / `asyncValidators` у поля или узла                   | `validate` / `validateAsync` в `defineValidation`                                         |
| `ValidationSchema`, `defineValidationSchema`, `ValidationSchemaFn` | `ValidationDefinition`, `defineValidation`                                                |
| `ValidatorFn`, `AsyncValidatorFn`, `Validator<TForm, TField>`      | `Rule<T>`, `AsyncRule<T>` из `@reformer/core/validation`                                  |
| `validateForm`, `validateFormModel`                                | `await validateModel(model, rules)`                                                       |
| `applyWhen`                                                        | `validateWhen(() => условие, () => { … })`                                                |
| `validateItems`, `validateGroup`, `validateTree`, `each`           | `applyEach(model.$.items, rowRules)`, `apply(model.$.group, groupRules)`                  |
| фабрика `number()`                                                 | `isNumber()`, `integer()`, `multipleOf()`, `nonNegative()`, `nonZero()`, `min()`, `max()` |
| `required({ message: '…' })`, `messageKey`                         | `required({ code: '…' })` и запись в `defineIssueMessages`                                |
| `ValidationError` с полем `message`                                | `ValidationIssue` — `{ code, params?, severity? }`                                        |
| `ValidateOptions`                                                  | `RuleOptions` — `{ code?, params? }`                                                      |
| `resolveValidationError`                                           | `resolveIssueMessage(issue, i18n, messages?)`                                             |
| `useValidationMessage`                                             | `useIssueMessage(messages?)` из `@reformer/core/react`                                    |
| `result.errors`                                                    | `result.issues`                                                                           |
| `FormErrorHandler`, `ErrorStrategy`                                | статус прогона `error`, `result.failures`, замечание `ruleFailed`                         |
| `updateOn`, `debounce` у поля, `setUpdateOn()`                     | `createForm({ validation: { strategy, debounce } })`                                      |

```typescript
// было
required({ message: 'Укажите телефон' });

// стало
required({ code: 'phone.required' });
const phoneMessages = defineIssueMessages({ 'phone.required': 'Укажите телефон' });
```

Изменилось и поведение встроенных правил:

- **Даты** — `Date` или строка `YYYY-MM-DD`. Другую строку `isDate()` отклоняет кодом
  `date_invalid`, остальные правила дат её пропускают. `minAge` на дате рождения в будущем даёт
  `date_future`.
- **`url()`** принимает `localhost`, IP-адрес, порт и кириллические домены, отклоняет пробелы в
  пути; протокол не `http`/`https` даёт код `url_protocol`.
- **`required()`** отклоняет `NaN`, **`minFiles(n)`** — пустой массив, **`multipleOf(0)`** бросает
  исключение при создании правила.

## Поведение

| Было                                                       | Стало                                                                      |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| строковые пути и `(form) => …`: `enableWhen(path.city, …)` | сигналы модели: `enableWhen(model.$.city, () => …)`                        |
| `ctx.form.x.value.value`, `ctx.setFieldValue(name, value)` | `model.x`, `model.x = value` или `compute(…)`                              |
| `transformers`, `createTransformer`                        | `transformValue(model.$.поле, fn)`                                         |
| `renderBehavior`, `RenderBehaviorFn` (renderer-react)      | одно поведение: `defineFormBehavior(({ model, form, schema, flow }) => …)` |
| `resetWhen` по полю без `null` в типе — без `resetValue`   | `{ resetValue }` обязателен: `''` для строки, `0` для числа                |
| второй `hideWhen` на тот же узел заменял первый            | условия объединяются по «или»                                              |
| `copyFrom` групп стирал поля цели, которых нет в источнике | такие поля цели остаются                                                   |

```typescript
// было
enableWhen(path.city, (form) => Boolean(form.country));

// стало
enableWhen(model.$.city, () => Boolean(model.country), { resetOnDisable: true });
```

## Отправка и проверка формы

Проверка и отправка — у сборки, а не у нод. Отправка — отдельный объект `bundle.submission`.

| Было                                                     | Стало                                                                       |
| -------------------------------------------------------- | --------------------------------------------------------------------------- |
| `form.submit(handler)`, `form.submitWithResult(handler)` | `bundle.submission.submit(handler)` → `SubmitResult`                        |
| `bundle.submit(handler)`, `bundle.submitting`            | `bundle.submission.submit(handler)`, `bundle.submission.submitting`         |
| `form.submitting`                                        | `bundle.submission.submitting`                                              |
| `SubmitOptions` (`skipValidation`, `skipTouch`)          | без проверки — `createSubmission({ check: undefined, values })`             |
| `form.validate()`, `node.validate()`                     | `bundle.validate()` → `ValidationResult`                                    |
| `bundle.validation.validateAll()`, `.runAll()`           | `bundle.validate()`                                                         |
| `bundle.validation.validateStep(n)`, `.runStep(n)`       | `bundle.validateStep(id)` — идентификатор шага, не номер                    |
| `buildValidation`, `FormValidationBundle`                | `createForm({ validation, flow })`                                          |
| `validation: { steps: { loan: rules } }`                 | `flow: { steps: [{ id: 'loan', rules }] }`, вне шагов — `validation.extras` |
| результат проверки и отправки — `boolean`                | объект со `status`                                                          |

Ещё три изменения поведения:

- `bundle.validate()` не включает живую фазу стратегии `afterFirstSubmit` — её включает только
  попытка отправки.
- Отменённая отправка (`cancelled`) не помечает форму тронутой.
- Точка отсчёта сброса одна. `form.reset()` возвращает значения к точке отсчёта модели — к начальным
  либо к последнему `model.captureInitial()` — и чистит ноды. `model.reset()` возвращает только
  значения.

```typescript
// было
const ok = await form.submit(api.send);

// стало
const outcome = await bundle.submission.submit(api.send);
if (outcome.status === 'submitted') form.reset();
```

## Мастер (cdk и ui-kit)

Шаги и их правила держит поток сборки, мастер его только рисует.

| Было                                                                          | Стало                                                               |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `<FormWizard config={…}>`, `FormWizardConfig` (`validateStep`, `validateAll`) | `createForm({ flow })` и `<FormWizard flow={bundle.flow}>`          |
| `<FormWizard ref={…}>`, `FormWizardHandle`, `ref.current.goToStep(n)`         | `bundle.flow.next()`, `previous()`, `goTo(id)`                      |
| `schema.node('wizard').getRef<FormWizardHandle>()` в поведении                | `flow` из области: `defineFormBehavior(({ flow }) => …)`            |
| `defineSteps(model, { steps, extras, strategy })`                             | `createForm({ validation: { extras, strategy }, flow })`            |
| `useWizardStepValidation(config)`                                             | `validation: { strategy }` сборки                                   |
| шаги в `componentProps.steps` узла мастера                                    | шаги — дети узла мастера: `{ selector, component: Step, children }` |
| обёртки `wizard.tsx`, `renderer.wizard.tsx`                                   | библиотечный `FormWizard` прямо в схеме                             |
| `onSubmit` мастера без аргументов                                             | `onSubmit(values)` — внутри сборки через `bundle.submission.submit` |

```tsx
// было
<FormWizard ref={wizardRef} config={wizardConfig} steps={STEPS} />;
wizardRef.current?.goToStep(1);

// стало
const bundle = useFormBundle(() =>
  createForm({ initial, flow: { steps: [{ id: 'loan', rules: loanRules }, { id: 'confirm' }] } })
);
<FormWizard form={bundle.form} flow={bundle.flow} steps={STEPS} />;
bundle.flow?.goTo('loan');
```

Подробнее — [Многошаговые формы](/docs/guides/multi-step-forms).

## Компоненты cdk и ui-kit

| Было                                                                                 | Стало                                                                      |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| компонент `FormArray` (cdk, ui-kit)                                                  | `FieldArray`; имя `FormArray` — тип ноды массива в ядре                    |
| `FormArraySection`                                                                   | `FieldArraySection`                                                        |
| `useFormArray`                                                                       | `useFieldArray`                                                            |
| входы `@reformer/cdk/form-array`, `@reformer/ui-kit/form-array`                      | `@reformer/cdk/field-array`, `@reformer/ui-kit/field-array`                |
| ключи локали `kit.formArray.*`                                                       | `kit.fieldArray.*`                                                         |
| `InputField`, `SelectField`, `CheckboxField` и другие `*Field`                       | сам компонент: `Input`, `SelectAsync`, `CheckboxWithLabel`, …              |
| `Input` с `type: 'number'`                                                           | `InputNumber`                                                              |
| `InputField` с `suggestions`                                                         | `InputSuggest`                                                             |
| `FileUploadField` с `variant: 'dropzone' \| 'input'`                                 | `FileUploadDropzone`, `FileUploadInput`                                    |
| `Select`, `Checkbox`, `RadioGroup` как поля формы                                    | `SelectAsync`, `CheckboxWithLabel`, `RadioGroupOptions`                    |
| `withFormControl(MyControl, adapter)`                                                | `defineFieldControl(MyControl, { adapter })` из `@reformer/ui-kit/fields`  |
| `chart`, `table`, `calendar` и другие тяжёлые компоненты из корня `@reformer/ui-kit` | только через свой вход: `@reformer/ui-kit/chart`, `/table`, `/calendar`, … |
| cdk `createMessageResolver`, `defaultErrorResolver`, `ValidationMessageTable`        | `<ValidationMessagesProvider messages={defineIssueMessages({ … })}>`       |
| cdk `ValidationErrorResolver`, `useValidationErrorResolver`                          | `IssueMessageResolver`, `useIssueMessageResolver`                          |

```typescript
// было
import { FormArray } from '@reformer/ui-kit/form-array';
{ model: model.$.amount, component: Input, componentProps: { type: 'number' } }

// стало
import { FieldArray } from '@reformer/ui-kit/field-array';
{ model: model.$.amount, component: InputNumber }
```

## renderer-react

| Было                                  | Стало                                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `createReactForm`, `useReactForm`     | `createForm` + `useFormBundle`; `FormRenderer` принимает только сборку                             |
| `renderBehavior`, `RenderBehaviorFn`  | `defineFormBehavior` — одно поведение формы                                                        |
| контрол получал проп `control` всегда | только по запросу: `Component.reformerNeedsControl = true` или `passControl: true` в адаптере поля |
| поле `text` у узла                    | `children`                                                                                         |

Обёртки поля (`fieldWrapper`, `FormField`) и контейнеры проп `control` получают, как раньше. Своему
контролу, который сам вызывает `useFormControl(control)`, нужен явный запрос:

```tsx
function RatingControl({ control }: { control: FormControl<number | null> }) {
  const { value } = useFormControl(control);
  /* … */
}
RatingControl.reformerNeedsControl = true;
```

## renderer-json

Рантайм читает только документ формата 2. Документ прежнего формата переводит
`migrateJsonSchema(document)`; реестр форм и билдер делают это сами при чтении документа.

| Было                                                    | Стало                                                                                                       |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| ключ `value` у поля                                     | `"model": "$model(email)"`                                                                                  |
| ключ `array` у массива                                  | `"model": "$model(items)"` и `"item"`                                                                       |
| шаги мастера в `componentProps.steps`                   | шаги — дети узла мастера (`$component(Step)`)                                                               |
| поле `text`                                             | `children`: `["Платёж: ", "$model(x)"]`                                                                     |
| `createJsonForm`, `useJsonForm`                         | `createForm({ schema: document, registry })` + `useFormBundle`                                              |
| `JsonFormRenderer`, `JsonRendererProvider`              | `<FormRenderer form={bundle} />` из `@reformer/renderer-react`                                              |
| `reg.field(…)`, `reg.container(…)`                      | `reg.component(…)`                                                                                          |
| `reg.source(…)`, `getSource()`, `getSourceNames()`      | `reg.dataSource(…)`, `getDataSource()`, `getDataSourceNames()`                                              |
| опция `sourceNames` у `validateFormSchema`              | `dataSourceNames`                                                                                           |
| `$component(FormArray)`, `$component(FormArraySection)` | `$component(FieldArray)`, `$component(FieldArraySection)`; прежние имена пока принимаются с предупреждением |

```tsx
// вместо JsonRendererProvider и JsonFormRenderer: реестр уходит в сборку
const bundle = useFormBundle(() => createForm({ model, schema: document, registry }));
<FormRenderer form={bundle} />;
```

## См. также

- [Частые проблемы](./faq.md)
- [Глоссарий](./glossary.md)
- [TypeScript-рецепты](./typescript.md)

# Validation

Как валидировать **значения** формы, собранной из JSON-схемы (`@reformer/renderer-json`, M1). Всё сверено с рабочим кодом: типы узла — [json-schema.ts](../../src/types/json-schema.ts), структурная валидация — [validate.ts](../../src/validate.ts), исполнение над моделью — `validateModel` из `@reformer/core/validation` (рабочий пример — [registration-form-renderer-json/validation.ts](../../../../projects/react-playground/src/pages/examples/registration-form-renderer-json/validation.ts)).

## Mental model — почему валидаторов нет в JSON { #mental-model }

Одна ключевая мысль: **JSON-DSL несёт только layout, а не правила валидации.**

- `JsonFieldNode` — это `{ selector?, value, component?, componentProps?, wrapper? }` и **ничего больше**. Поля `validators` в нём нет (см. [json-schema.ts](../../src/types/json-schema.ts) — интерфейс `JsonFieldNode`).
- Операторы DSL — только `$model(...)`, `$component(...)`, `$dataSource(...)` (см. [operators.ts](../../src/operators.ts)). Оператора `$validator(...)` **не существует**.
- `JsonFormRenderer` с пропом `validate` (и функция `validateFormSchema`) проверяют **структуру** схемы через ajv: корректность узлов + синтаксис операторов + известность имён `$component`/`$dataSource` + допустимость тегов `$html(...)`. Это НЕ валидация введённых пользователем значений (см. [validate.ts](../../src/validate.ts)).
- Теги `$html(...)` проверяются **всегда**, даже без реестра: whitelist статичен, поэтому `$html(script)` отклоняется независимо от того, переданы ли `componentNames`. Тот же whitelist применяет конвертер — битый тег не «просочится» в рантайм при отключённой валидации.
- Значит, валидацию значений выражают **отдельной TS-схемой над МОДЕЛЬЮ** (`FormModel`), а не в JSON. Схема — обычная функция `ValidationSchema<T> = (ctx: { model }) => void` (обёрнута `defineValidationSchema`); её исполняет внешний раннер `validateModel(model, schema)` — тот же контракт `@reformer/core/validation`, что и в TS-варианте формы. Одна валидация на все варианты рендера.

Ключевой тезис для рендереров: **layout (JSON) и валидация — два раздельных артефакта**. JSON можно менять/получать с сервера, не трогая правила, и наоборот. Валидация инъектируется в рантайме (render-behavior), а не «зашита» в схему.

Дальше — три шага: (1) построить схему над моделью, (2) обернуть её в `{ validateStep, validateAll }`, (3) инъектировать в wizard через render-behavior.

## Шаг 1 — построить схему валидации над моделью { #build-schema }

Схема валидации — обычная функция `({ model }) => void`, обёрнутая `defineValidationSchema<T>(...)`. Внутри вызываются свободные (ambient) операторы из `@reformer/core/validation`: `validate(sig, [rules])` для синхронных правил (массив правил на поле). `sig` — сигнал модели (`model.$.path`), НЕ строка-оператор `$model(...)` (операторы — только для layout-JSON; схема валидации это обычный TS-код). Фабрики правил импортируются из `@reformer/core/validators`.

```typescript
import { type FormModel } from '@reformer/core';
import { validate, defineValidationSchema } from '@reformer/core/validation';
import { required, min, max, minLength, email } from '@reformer/core/validators';

type M = FormModel<CreditForm>;

// Под-схема одного шага — функция ({ model }) => void; поля адресуются сигналами model.$.*.
const step1 = defineValidationSchema<CreditForm>(({ model }) => {
  validate(model.$.loanType, [required({ message: 'Выберите тип кредита' })]);
  validate(model.$.loanAmount, [
    required(),
    min(50000, { message: 'Минимум 50 000 ₽' }),
    max(10000000),
  ]);
});

const step2 = defineValidationSchema<CreditForm>(({ model }) => {
  validate(model.$.personalData.firstName, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
});

// Карта шагов (композиция для submit — в шаге 2).
const STEP_SCHEMAS = [step1, step2];
```

Остальные операторы из `@reformer/core/validation` (тот же контракт, что в TS-форме): `validateAsync(sig, [asyncRules])` — асинхронные правила `(value, { signal }) => Promise<...>` (раннер их дожидается и прокидывает `AbortSignal`); `validateWhen(() => cond, () => {...})` — условная валидация (правила внутри активны/гасятся по `cond`); `cross(sig, (f) => err | null)` — cross-field по снапшоту `model.get()`; `each(arr, (im) => {...})` — per-item по элементам массива; `apply(...schemas)` — композиция под-схем над той же моделью. Полное описание операторов схемы и раннера `validateModel` — в `@reformer/core` [13-multi-step.md](../../../reformer/docs/llms/13-multi-step.md) (не дублируем здесь).

## Шаг 2 — исполнить: `{ validateStep, validateAll }` { #execute }

`validateModel(model, schema)` прогоняет схему по текущим значениям модели и **сам роутит ошибки в ноды формы** (UI подсветит проблемные поля через `getNodeForSignal(sig).setErrors(...)`). Возвращает `Promise<boolean>` — `true`, если нет блокирующих ошибок (`severity:'warning'` не блокирует, но показывается); поля, ставшие валидными, гасятся; устаревшие прогоны той же `(model, schema)` отменяются. Оборачиваем в две функции — контракт `FormWizardConfig` из `@reformer/cdk` (см. [form-wizard/types.ts](../../../reformer-cdk/src/components/form-wizard/types.ts): `validateStep?(step): boolean | Promise<boolean>`, `validateAll?(): boolean | Promise<boolean>`).

```typescript
import {
  apply,
  validateModel,
  defineValidationSchema,
  type ValidationSchema,
} from '@reformer/core/validation';

// Полная схема для submit — композиция всех шагов через apply(...).
const fullSchema = defineValidationSchema<CreditForm>(() => apply(...STEP_SCHEMAS));
// Пустая схема для шага вне диапазона: гасит ранее тронутые поля, возвращает valid.
const emptySchema: ValidationSchema<CreditForm> = () => {};

export function makeValidationConfig(model: M) {
  return {
    validateStep: (step: number): Promise<boolean> =>
      validateModel(model, STEP_SCHEMAS[step - 1] ?? emptySchema),
    // ошибки уже проставлены в ноды текущего шага
    validateAll: (): Promise<boolean> => validateModel(model, fullSchema),
  };
}
```

Схемы — стабильные module-level `const` (важно: `validateModel` отменяет устаревший прогон по идентичности схемы). Строятся один раз: они зависят только от ФОРМЫ модели, значения читаются раннером в момент прогона.

## Шаг 3 — инъекция в wizard через render-behavior { #inject }

JSON-схема статична и не знает про `FormProxy`/validation-конфиг — это рантайм-сущности. Инжектируем их в wizard-ноду через `renderBehavior` + `onInit` + `patchProps` до первого рендера (общий приём — см. [05-cookbook.md#inject-runtime](05-cookbook.md#inject-runtime)). Wizard-узел JSON-схемы должен нести `selector: 'wizard'`, чтобы адресоваться через `schema.node('wizard')`.

```typescript
import { onInit, type RenderBehaviorFn } from '@reformer/renderer-react';
import type { FormProxy, FormModel } from '@reformer/core';

export function createJsonRenderBehavior(
  form: FormProxy<CreditForm>,
  model: FormModel<CreditForm>
): RenderBehaviorFn<CreditForm> {
  return (schema) => {
    // JSON не выражает FormProxy/валидацию — инъектим их в wizard до первого рендера.
    onInit(schema.node('wizard'), () => {
      schema.node('wizard').patchProps({ form, ...makeValidationConfig(model) });
    });
    // Остальное поведение (visibility/navigation) — из shared render-behavior.
    createSharedRenderBehavior(form)(schema);
  };
}

// <JsonFormRenderer schema={jsonSchema} renderBehavior={createJsonRenderBehavior(form, model)} />
```

`patchProps({ form, validateStep, validateAll })` кладёт `form` + оба колбэка в `componentProps` wizard-ноды. Wizard-компонент читает их как `FormWizardConfig` и запускает `validateStep` на «Далее», `validateAll` на submit.

## Полный рабочий пример { #full-example }

Зеркалит golden-эталон (`complex-multy-step-form-renderer-json`): валидация — TS-схема над моделью (`@reformer/core/validation`), переиспользуемая всеми вариантами рендера, инъектируется в JSON-wizard. Submit и навигация между шагами приходят **не** отсюда, а из shared render-behavior — JSON-вариант лишь до-инъектит `form`/валидацию и делегирует остальное (см. [07-form-wizard.md](07-form-wizard.md)).

```typescript
// validation.ts — TS-схема над МОДЕЛЬЮ (не JSON), контракт @reformer/core/validation
import { type FormModel } from '@reformer/core';
import {
  validate,
  apply,
  defineValidationSchema,
  validateModel,
  type ValidationSchema,
} from '@reformer/core/validation';
import { required, min, minLength, email } from '@reformer/core/validators';
import type { CreditForm } from './types';

type M = FormModel<CreditForm>;

const step1 = defineValidationSchema<CreditForm>(({ model }) => {
  validate(model.$.loanType, [required({ message: 'Выберите тип кредита' })]);
  validate(model.$.loanAmount, [required(), min(50000, { message: 'Минимум 50 000 ₽' })]);
});
const step2 = defineValidationSchema<CreditForm>(({ model }) => {
  validate(model.$.personalData.firstName, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
});

const STEP_SCHEMAS: readonly ValidationSchema<CreditForm>[] = [step1, step2];
const fullSchema = defineValidationSchema<CreditForm>(() => apply(...STEP_SCHEMAS));
const emptySchema: ValidationSchema<CreditForm> = () => {};

/** Контракт FormWizardConfig: per-step + полная валидация через validateModel. */
export function makeValidationConfig(model: M) {
  return {
    validateStep: (step: number) => validateModel(model, STEP_SCHEMAS[step - 1] ?? emptySchema),
    validateAll: () => validateModel(model, fullSchema),
  };
}
```

```typescript
// render-behavior.ts — инъекция form + валидации в JSON-wizard
import { onInit, type RenderBehaviorFn } from '@reformer/renderer-react';
import type { FormProxy, FormModel } from '@reformer/core';
import type { CreditForm } from './types';
import { makeValidationConfig } from './validation';
// Единый behavior (submit/навигация/visibility) — общий для TS- и JSON-варианта. См. 07-form-wizard.md.
import { createSharedRenderBehavior } from './render-behavior.shared';

export function createJsonRenderBehavior(
  form: FormProxy<CreditForm>,
  model: FormModel<CreditForm>
): RenderBehaviorFn<CreditForm> {
  return (schema) => {
    // (1) Инъекция рантайм-сущностей: form + validation-конфиг в wizard-ноду.
    onInit(schema.node('wizard'), () => {
      schema.node('wizard').patchProps({ form, ...makeValidationConfig(model) });
    });
    // (2) Submit + навигация между шагами + visibility — из shared render-behavior.
    //     БЕЗ этого вызова форма валидирует, но НЕ сабмитит и не навигирует (golden
    //     `complex-multy-step-form-renderer-json/render-behavior.ts` делегирует так же).
    createSharedRenderBehavior(form)(schema);
  };
}
```

> **Мост «поведение инициирует валидацию».** Если правка одного поля должна пере-прогнать валидацию другого (без submit), это делает НЕ схема, а поведение — через `revalidateWhen` в `defineFormBehavior` (контракт `@reformer/core/behaviors`): `revalidateWhen([model.$.dep], () => void validateModel(model, schema))`. Валидация остаётся отдельным слоем; behavior лишь дёргает раннер.

## Anti-patterns

- **Ждать, что `validate={true}` (или `validateFormSchema`) валидирует значения** — этот проп проверяет только СТРУКТУРУ схемы через ajv (узлы + синтаксис операторов + имена компонентов). Введённые пользователем значения он не трогает. Валидацию значений исполняет раннер `validateModel` над моделью.
- **Пытаться добавить `validators` в JSON field-node** — `JsonFieldNode` несёт только layout (`value`/`component`/`componentProps`/`wrapper`). Поля `validators` в нём нет, оператора `$validator(...)` не существует. TypeScript отклонит лишнее поле; даже если протащить через `as`, конвертер его проигнорирует.
- **Инлайнить схему в `validateModel` или пересобирать её на каждый прогон** — схема это обычная функция над формой модели (`validate(model.$.path, [...])` адресует поле сигналом — стабильной ссылкой; значения читаются раннером в момент прогона). Держите схемы стабильными `const` через `defineValidationSchema`: `validateModel` отменяет устаревший прогон по идентичности схемы, а инлайн-стрелка (`validateModel(model, ({ model }) => …)`) каждый раз даёт новый прогон без дедупликации.
- **Забыть `selector: 'wizard'` у wizard-ноды** — без `selector` узел не адресуется через `schema.node('wizard')`, `onInit`/`patchProps` не найдут его и валидация не инъектируется (submit пройдёт без блокировки).

## See also

- [07-form-wizard.md](07-form-wizard.md) — end-to-end wizard в JSON: submit (`onComponentEvent`), навигация (`renderEffect`) и инъекция этой валидации в одном месте.
- [02-json-schema.md](02-json-schema.md) — справочник по узлам `JsonNode` (field-node несёт только layout).
- [05-cookbook.md#inject-runtime](05-cookbook.md#inject-runtime) — общий приём инъекции runtime-сущностей через `onInit`/`patchProps`.
- `@reformer/core` [13-multi-step.md](../../../reformer/docs/llms/13-multi-step.md) — операторы схемы валидации (`validate`/`validateAsync`/`validateWhen`/`cross`/`each`/`apply`), раннер `validateModel`, STEP_SCHEMAS.
- [Типы JsonFormSchema/JsonNode](../../src/types/json-schema.ts) и [validate.ts](../../src/validate.ts) — структурная валидация схемы.

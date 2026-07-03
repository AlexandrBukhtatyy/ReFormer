# Validation

Как валидировать **значения** формы, собранной из JSON-схемы (`@reformer/renderer-json`, M1). Всё сверено с рабочим кодом: типы узла — [json-schema.ts](../../src/types/json-schema.ts), структурная валидация — [validate.ts](../../src/validate.ts), исполнение над моделью — `validateFormModel` из `@reformer/core`.

## Mental model — почему валидаторов нет в JSON { #mental-model }

Одна ключевая мысль: **JSON-DSL несёт только layout, а не правила валидации.**

- `JsonFieldNode` — это `{ selector?, value, component?, componentProps?, wrapper? }` и **ничего больше**. Поля `validators` в нём нет (см. [json-schema.ts](../../src/types/json-schema.ts) — интерфейс `JsonFieldNode`).
- Операторы DSL — только `$model(...)`, `$component(...)`, `$dataSource(...)` (см. [operators.ts](../../src/operators.ts)). Оператора `$validator(...)` **не существует**.
- `JsonFormRenderer` с пропом `validate` (и функция `validateFormSchema`) проверяют **структуру** схемы через ajv: корректность узлов + синтаксис операторов + известность имён `$component`/`$dataSource`. Это НЕ валидация введённых пользователем значений (см. [validate.ts](../../src/validate.ts)).
- Значит, валидацию значений выражают **отдельной TS-схемой над МОДЕЛЬЮ** (`FormModel`), а не в JSON. Схема исполняется `validateFormModel(model, schema)` — тем же движком, что и в TS-варианте формы. Одна валидация на все варианты рендера.

Дальше — три шага: (1) построить схему над моделью, (2) обернуть её в `{ validateStep, validateAll }`, (3) инъектировать в wizard через render-behavior.

## Шаг 1 — построить схему валидации над моделью { #build-schema }

Схема валидации — дерево узлов движка M1: лист `{ value: signal, validators: [...] }`, контейнер `{ children: [...] }`. `value` — сигнал модели (`model.$.path`), НЕ строка-оператор `$model(...)` (операторы — только для layout-JSON; схема валидации это обычный TS-код). Фабрики правил импортируются из `@reformer/core/validators`.

```typescript
import { type FormModel } from '@reformer/core';
import { required, min, max, minLength, email } from '@reformer/core/validators';

type M = FormModel<CreditForm>;

// Под-схема одного шага: дерево field-узлов { value, validators }.
const step1 = (model: M) => ({
  children: [
    { value: model.$.loanType, validators: [required({ message: 'Выберите тип кредита' })] },
    {
      value: model.$.loanAmount,
      validators: [required(), min(50000, { message: 'Минимум 50 000 ₽' }), max(10000000)],
    },
  ],
});

const step2 = (model: M) => ({
  children: [
    { value: model.$.personalData.firstName, validators: [required(), minLength(2)] },
    { value: model.$.email, validators: [required(), email()] },
  ],
});

// Карта шагов + полная схема (объединение для submit).
const STEP_BUILDERS = [step1, step2];
```

Условные группы (`{ when, children }`), cross-field правила, секции массивов — тот же движок, что в TS-форме. Полное описание узлов схемы и `validateFormModel` — в `@reformer/core` [13-multi-step.md](../../../reformer/docs/llms/13-multi-step.md) (не дублируем здесь).

## Шаг 2 — исполнить: `{ validateStep, validateAll }` { #execute }

`validateFormModel(model, schema)` прогоняет схему по текущим значениям модели и **сам роутит ошибки в ноды формы** (UI подсветит проблемные поля). Возвращает `{ valid, errors }`. Оборачиваем в две функции — контракт `FormWizardConfig` из `@reformer/cdk` (см. [form-wizard/types.ts](../../../reformer-cdk/src/components/form-wizard/types.ts): `validateStep?(step): boolean | Promise<boolean>`, `validateAll?(): boolean | Promise<boolean>`).

```typescript
import { validateFormModel } from '@reformer/core';

export function makeValidationConfig(model: M) {
  // Схема зависит только от ФОРМЫ модели, не от значений — строим дерево один раз.
  const stepSchemas = STEP_BUILDERS.map((build) => build(model));
  const fullSchema = { children: stepSchemas };

  return {
    validateStep: async (step: number): Promise<boolean> => {
      const res = await validateFormModel(model, stepSchemas[step - 1] ?? { children: [] });
      return res.valid; // ошибки уже проставлены в ноды текущего шага
    },
    validateAll: async (): Promise<boolean> => {
      const res = await validateFormModel(model, fullSchema);
      return res.valid;
    },
  };
}
```

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

Зеркалит golden-эталон (`complex-multy-step-form-renderer-json`): валидация — TS-схема над моделью, переиспользуемая всеми вариантами рендера, инъектируется в JSON-wizard. Submit и навигация между шагами приходят **не** отсюда, а из shared render-behavior — JSON-вариант лишь до-инъектит `form`/валидацию и делегирует остальное (см. [07-form-wizard.md](07-form-wizard.md)).

```typescript
// validation.ts — TS-схема над МОДЕЛЬЮ (не JSON)
import { validateFormModel, type FormModel } from '@reformer/core';
import { required, min, minLength, email } from '@reformer/core/validators';
import type { CreditForm } from './types';

type M = FormModel<CreditForm>;

const step1 = (model: M) => ({
  children: [
    { value: model.$.loanType, validators: [required({ message: 'Выберите тип кредита' })] },
    { value: model.$.loanAmount, validators: [required(), min(50000, { message: 'Минимум 50 000 ₽' })] },
  ],
});
const step2 = (model: M) => ({
  children: [
    { value: model.$.personalData.firstName, validators: [required(), minLength(2)] },
    { value: model.$.email, validators: [required(), email()] },
  ],
});
const STEP_BUILDERS = [step1, step2];

/** Контракт FormWizardConfig: per-step + полная валидация через validateFormModel. */
export function makeValidationConfig(model: M) {
  const stepSchemas = STEP_BUILDERS.map((build) => build(model));
  const fullSchema = { children: stepSchemas };
  return {
    validateStep: async (step: number) =>
      (await validateFormModel(model, stepSchemas[step - 1] ?? { children: [] })).valid,
    validateAll: async () => (await validateFormModel(model, fullSchema)).valid,
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

## Anti-patterns

- **Ждать, что `validate={true}` (или `validateFormSchema`) валидирует значения** — этот проп проверяет только СТРУКТУРУ схемы через ajv (узлы + синтаксис операторов + имена компонентов). Введённые пользователем значения он не трогает. Валидацию значений исполняет `validateFormModel` над моделью.
- **Пытаться добавить `validators` в JSON field-node** — `JsonFieldNode` несёт только layout (`value`/`component`/`componentProps`/`wrapper`). Поля `validators` в нём нет, оператора `$validator(...)` не существует. TypeScript отклонит лишнее поле; даже если протащить через `as`, конвертер его проигнорирует.
- **Строить схему валидации по значениям, а не по shape модели** — узел это `{ value: model.$.path, validators }`, где `value` — сигнал (стабильная ссылка на форму модели), а не текущее значение поля. Схему собирают один раз на `model`; значения читаются движком в момент прогона `validateFormModel`.
- **Забыть `selector: 'wizard'` у wizard-ноды** — без `selector` узел не адресуется через `schema.node('wizard')`, `onInit`/`patchProps` не найдут его и валидация не инъектируется (submit пройдёт без блокировки).

## See also

- [07-form-wizard.md](07-form-wizard.md) — end-to-end wizard в JSON: submit (`onComponentEvent`), навигация (`renderEffect`) и инъекция этой валидации в одном месте.
- [02-json-schema.md](02-json-schema.md) — справочник по узлам `JsonNode` (field-node несёт только layout).
- [05-cookbook.md#inject-runtime](05-cookbook.md#inject-runtime) — общий приём инъекции runtime-сущностей через `onInit`/`patchProps`.
- `@reformer/core` [13-multi-step.md](../../../reformer/docs/llms/13-multi-step.md) — узлы схемы валидации, `validateFormModel`, STEP_SCHEMAS.
- [Типы JsonFormSchema/JsonNode](../../src/types/json-schema.ts) и [validate.ts](../../src/validate.ts) — структурная валидация схемы.

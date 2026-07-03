# Validation

Как валидировать **значения** формы, собранной из render-схемы (`@reformer/renderer-react`, M1). Всё сверено с рабочим кодом: типы узла — [types.ts](../../src/core/types.ts), исполнение над моделью — `validateFormModel` из `@reformer/core`, golden — `complex-multy-step-form-renderer` (`render-schema.ts` + core-каталог `complex-multy-step-form/schemas/validation.ts`).

## Mental model — почему валидаторов нет в RenderNode { #mental-model }

Одна ключевая мысль: **`RenderNode` несёт только layout, а не правила валидации.**

- `RenderNode<T>` — union из трёх узлов (см. [types.ts](../../src/core/types.ts)): `ModelFieldRenderNode` (`{ selector?, value, component, componentProps? }`), `ArrayRenderNode` (`{ array, item, initialValue?, componentProps? }`), `ContainerRenderNode` (`{ component, children?, componentProps? }`). Поля `validators` нет **ни в одном** из них. Впишете `validators: []` в лист — TypeScript отклонит: `TS2353: 'validators' does not exist in type 'RenderNode<T>'`.
- Лист-поле несёт только `value` (сигнал модели, `model.$.<path>`), `component` (UI-компонент) и `componentProps`. State-нода (errors/disabled) резолвится по сигналу через реестр `getNodeForSignal`, который заполняет `createForm`. Рендерер подсветит ошибки, но **сам значения не валидирует** — он лишь отображает то, что кто-то проставил в ноды.
- Значит, валидацию значений выражают **отдельной TS-схемой над МОДЕЛЬЮ** (`FormModel`), а не в RenderNode. Схема исполняется `validateFormModel(model, schema)` — тем же движком, что и в TS-варианте формы. Одна валидация на все варианты рендера (React / JSON / рукописный JSX).

Дальше — три шага: (1) построить схему над моделью, (2) обернуть её в `{ validateStep, validateAll }`, (3) прокинуть конфиг в wizard-узел.

## Шаг 1 — построить схему валидации над моделью { #build-schema }

Схема валидации — дерево узлов движка M1: лист `{ value: signal, validators: [...] }`, контейнер `{ children: [...] }`. `value` — сигнал модели (`model.$.path`), **не** RenderNode: схема валидации это обычный TS-код в отдельном файле, она не пересекается с render-деревом. Фабрики правил импортируются из `@reformer/core/validators`.

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

const STEP_BUILDERS = [step1, step2];
```

Условные группы (`{ when, children }`), cross-field правила, секции массивов — тот же движок, что в TS-форме. Полное описание узлов схемы и `validateFormModel` — в `@reformer/core` [13-multi-step.md](../../../reformer/docs/llms/13-multi-step.md) (не дублируем здесь).

## Шаг 2 — исполнить: `{ validateStep, validateAll }` { #execute }

`validateFormModel(model, schema)` прогоняет схему по текущим значениям модели и **сам роутит ошибки в ноды формы по сигналу** (рендерер подсветит проблемные поля). Возвращает `{ valid, errors }`. Оборачиваем в две функции — контракт `FormWizardConfig` из `@reformer/cdk/form-wizard` (`validateStep?(step): boolean | Promise<boolean>`, `validateAll?(): boolean | Promise<boolean>`).

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

## Шаг 3 — прокинуть конфиг в wizard-узел { #inject }

В отличие от JSON-варианта (JSON не умеет носить рантайм-функции, поэтому там инъекция идёт через render-behavior `patchProps`), render-схема — это **обычный TS-код**, поэтому валидацию вкладывают **инлайн**, в `componentProps` wizard-узла при построении дерева. Канонический `FormWizard` из `@reformer/ui-kit/form-wizard` принимает конфиг под ключом `config: FormWizardConfig` (см. [01-overview.md](01-overview.md)):

```tsx
// render-schema.ts — валидация инъектится ИНЛАЙН в componentProps wizard-узла
import { FormWizard } from '@reformer/ui-kit/form-wizard';
import { makeCreditValidationConfig } from '../complex-multy-step-form/schemas/validation';

export function buildCreditApplicationSchema(
  model: FormModel<CreditForm>,
  form?: FormProxy<CreditForm> // form нужен ТОЛЬКО рендеру; при createForm дерево строится БЕЗ form
): RenderNode<CreditForm> {
  return {
    selector: 'wizard',
    component: FormWizard,
    componentProps: {
      ...(form ? { form } : {}),
      config: makeCreditValidationConfig(model), // { validateStep, validateAll } — контракт FormWizardConfig
      steps: [
        /* ... RenderNode-поддеревья шагов (layout, БЕЗ validators) ... */
      ],
    },
    // ...
  } as RenderNode<CreditForm>;
}
```

> **Golden-нюанс.** Флагман `complex-multy-step-form-renderer` монтирует не сам `FormWizard`, а совместимый shim `RendererFormWizard`, который принимает `validateStep`/`validateAll` **top-level** пропсами и сам заворачивает их в `config`. Поэтому в его `render-schema.ts` конфиг спредится плоско: `...makeCreditValidationConfig(model)`. Для нового кода на каноническом `FormWizard` передавай `config: makeCreditValidationConfig(model)`, как выше.

**Альтернатива — render-behavior.** Если конфиг доступен не в момент построения дерева (или хочется держать layout и рантайм-сущности раздельно, как в JSON-варианте), тот же результат даёт `onInit` + `patchProps` на wizard-узле (узел должен нести `selector: 'wizard'`):

```typescript
import { onInit, type RenderBehaviorFn } from '@reformer/renderer-react';

const behavior: RenderBehaviorFn<CreditForm> = (schema) => {
  onInit(schema.node('wizard'), () => {
    schema.node('wizard').patchProps({ ...makeValidationConfig(model) });
  });
};
```

`onInit` синхронный, срабатывает до первого рендера — конфиг попадёт в стартовые `componentProps`. Подробнее про хелперы — [03-render-behavior.md](03-render-behavior.md).

## Полный рабочий пример { #full-example }

Зеркалит golden (`complex-multy-step-form-renderer`): валидация — TS-схема над моделью, переиспользуемая всеми вариантами рендера, вкладывается инлайн в wizard-узел render-схемы. Submit и навигация между шагами приходят из render-behavior (`onComponentEvent('onSubmit')` / `renderEffect`), а не отсюда — см. [03-render-behavior.md](03-render-behavior.md).

```typescript
// validation.ts — TS-схема над МОДЕЛЬЮ (переиспользуется React/JSON/handwritten вариантами)
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
export function makeCreditValidationConfig(model: M) {
  const stepSchemas = STEP_BUILDERS.map((build) => build(model));
  const fullSchema = { children: stepSchemas };
  return {
    validateStep: async (step: number) =>
      (await validateFormModel(model, stepSchemas[step - 1] ?? { children: [] })).valid,
    validateAll: async () => (await validateFormModel(model, fullSchema)).valid,
  };
}
```

```tsx
// render-schema.ts — layout БЕЗ validators; конфиг валидации инлайн в wizard-узле
import type { FormModel, FormProxy } from '@reformer/core';
import type { RenderNode } from '@reformer/renderer-react';
import { FormWizard } from '@reformer/ui-kit/form-wizard';
import { Input } from '@reformer/ui-kit';
import { makeCreditValidationConfig } from './validation';
import type { CreditForm } from './types';

export function buildSchema(
  model: FormModel<CreditForm>,
  form?: FormProxy<CreditForm>
): RenderNode<CreditForm> {
  const m = model.$;
  return {
    selector: 'wizard',
    component: FormWizard,
    componentProps: {
      ...(form ? { form } : {}),
      config: makeCreditValidationConfig(model), // ← валидация здесь, НЕ на листьях-полях
      steps: [
        {
          number: 1,
          title: 'Кредит',
          body: {
            component: Input, // лист несёт только value/component/componentProps — без validators
            value: m.loanAmount,
            componentProps: { label: 'Сумма' },
          },
        },
      ],
    },
  } as RenderNode<CreditForm>;
}
```

## Anti-patterns

- **Вписывать `validators` в лист RenderNode** (`{ value: m.x, component: Input, validators: [...] }`) — главная ловушка. У `ModelFieldRenderNode` нет поля `validators` (как и у array/container узлов). TypeScript даёт `TS2353: 'validators' does not exist in type 'RenderNode<T>'`. Валидация значений живёт в отдельной model-схеме (Шаг 1), а не в render-дереве.
- **Ждать, что рендерер сам провалидирует значения** — `FormRenderer` только отображает ошибки, уже проставленные в ноды. Значения проверяет `validateFormModel(model, schema)`; без её вызова (обычно из `validateStep`/`validateAll` wizard-а) поля не подсветятся.
- **Строить схему валидации по значениям, а не по shape модели** — узел это `{ value: model.$.path, validators }`, где `value` — сигнал (стабильная ссылка на форму модели), а не текущее значение поля. Схему собирают один раз на `model`; значения читаются движком в момент прогона.
- **Забыть `selector: 'wizard'` при инъекции через render-behavior** — без `selector` узел не адресуется через `schema.node('wizard')`, `onInit`/`patchProps` не найдут его и валидация не прокинется. (При инлайн-инъекции в `componentProps` это не нужно.)
- **`array` на array-узле + строгая типизация листа = `TS2741`.** Привязка массива это `array: model.<path>` (value-доступ, напр. `model.coBorrowers`), НЕ `model.$.coBorrowers`. Тип `ModelArray<U>` рантайм-совместим с требуемым `RenderModelArrayControl`, но в публичном типе у него **не объявлен** `__path`, поэтому под строгим контекстом узла TS ругается `Property '__path' is missing in type 'ModelArray<T>' but required in 'RenderModelArrayControl'`. Golden обходит это кастом всего дерева `as unknown as RenderNode<T>` в конце билдера (`render-schema.ts`) — это канон для схемы с array-узлами; привязка при этом остаётся `array: model.<path>` (см. [02-render-schema.md](02-render-schema.md#array)).

## See also

- [02-render-schema.md](02-render-schema.md) — структура `RenderNode`: лист-поле несёт только layout, массивы (`array: model.<path>`).
- [03-render-behavior.md](03-render-behavior.md) — `onInit`/`patchProps` для инъекции конфига в wizard-узел.
- [01-overview.md](01-overview.md) — wizard-узел, `FormWizardConfig` (`{ validateStep?, validateAll? }`), передача `form` через `componentProps`.
- `@reformer/core` [13-multi-step.md](../../../reformer/docs/llms/13-multi-step.md) — узлы схемы валидации, `validateFormModel`, `STEP_SCHEMAS`, cross-field/условные группы.
- `@reformer/renderer-json` [06-validation.md](../../../reformer-renderer-json/docs/llms/06-validation.md) — родственный паттерн для JSON-схемы (та же model-валидация, инъекция через render-behavior).

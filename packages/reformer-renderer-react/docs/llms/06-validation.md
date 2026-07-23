# Validation

Как валидировать **значения** формы, собранной из render-схемы (`@reformer/renderer-react`, M1). Всё сверено с рабочим кодом: типы узла — [types.ts](../../src/core/types.ts), исполнение над моделью — `validateModel` из `@reformer/core/validation`, golden — `complex-multy-step-form-renderer` (`render-schema.ts` + core-каталог `complex-multy-step-form/schemas/validation.ts`).

## Mental model — почему валидаторов нет в RenderNode { #mental-model }

Одна ключевая мысль: **`RenderNode` несёт только layout, а не правила валидации.**

- `RenderNode<T>` — union из трёх узлов (см. [types.ts](../../src/core/types.ts)): `ModelFieldRenderNode` (`{ selector?, value, component, componentProps? }`), `ArrayRenderNode` (`{ array, item, initialValue?, componentProps? }`), `ContainerRenderNode` (`{ component, children?, componentProps? }`). Поля `validators` нет **ни в одном** из них. Впишете `validators: []` в лист — TypeScript отклонит: `TS2353: 'validators' does not exist in type 'RenderNode<T>'`.
- Лист-поле несёт только `value` (сигнал модели, `model.$.<path>`), `component` (UI-компонент) и `componentProps`. State-нода (errors/disabled) резолвится по сигналу через реестр `getNodeForSignal`, который заполняет `createForm`. Рендерер подсветит ошибки, но **сам значения не валидирует** — он лишь отображает то, что кто-то проставил в ноды.
- Значит, валидацию значений выражают **отдельной функцией-схемой над МОДЕЛЬЮ** (`ValidationSchema<T> = ({ model }) => void`), а не в RenderNode. Схему прогоняет внешний раннер `validateModel(model, schema)` — тем же контрактом, что и в TS-варианте формы. Одна валидация на все варианты рендера (React / JSON / рукописный JSX): layout и правила разъезжаются по разным каналам и не пересекаются.

Дальше — три шага: (1) построить схему над моделью, (2) обернуть её в `{ validateStep, validateAll }`, (3) прокинуть конфиг в wizard-узел.

## Шаг 1 — построить схему валидации над моделью { #build-schema }

Схема валидации — обычная функция над (под)моделью, обёрнутая `defineValidationSchema<T>(({ model }) => { … })`. Внутри — голые **операторы** из `@reformer/core/validation`: `validate(sig, [rules])` (синхронные правила поля, **массив**), `validateAsync(sig, [asyncRules])` (async-правила), `validateWhen(() => cond, () => …)` (условные ветки), `cross(sig, fn)` (cross-field по снапшоту `model.get()`), `each(arr, itemFn)` (per-item массивы), `apply(...schemas)` (композиция под-схем). `sig` — сигнал модели (`model.$.path`), **не** RenderNode: схема валидации это отдельный TS-файл, она не пересекается с render-деревом. Встроенные фабрики правил импортируются из `@reformer/core/validators`.

```typescript
import { type FormModel } from '@reformer/core';
import {
  validate,
  defineValidationSchema,
  type ValidationSchema,
} from '@reformer/core/validation';
import { required, min, max, minLength, email } from '@reformer/core/validators';
import type { CreditForm } from './types';

type Root = CreditForm;

// Схема одного шага — обычная функция ({ model }) => void; правила поля — validate(sig, [rules]).
const step1 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.loanType, [required({ message: 'Выберите тип кредита' })]);
  validate(model.$.loanAmount, [
    required(),
    min(50000, { message: 'Минимум 50 000 ₽' }),
    max(10000000),
  ]);
});

const step2 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.personalData.firstName, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
});

// Схемы model-независимы: model инъектируется раннером в момент прогона. Стабильные const.
const STEP_SCHEMAS: readonly ValidationSchema<Root>[] = [step1, step2];
```

Условные ветки (`validateWhen(() => model.loanType === 'mortgage', () => { … })`), cross-field (`cross(sig, fn)`), async (`validateAsync(sig, [rule])`), секции массивов (`each(model.items, im => { … })`) и композиция под-схем (`apply(...schemas)`) — тот же контракт, что в TS-форме. Полное описание операторов `@reformer/core/validation` и раннера `validateModel` — в `@reformer/core` [13-multi-step.md](../../../reformer/docs/llms/13-multi-step.md) (не дублируем здесь).

## Шаг 2 — исполнить: `{ validateStep, validateAll }` { #execute }

`validateModel(model, schema)` прогоняет схему по текущим значениям модели, **сам роутит ошибки в ноды формы по сигналу** (`getNodeForSignal(sig).setErrors(...)` — рендерер подсветит проблемные поля) и гасит поля, ставшие валидными. Возвращает `Promise<boolean>` — `true`, если нет **блокирующих** ошибок (`severity:'warning'` показывается, но не блокирует; устаревшие прогоны той же `(model, schema)` отменяются). Оборачиваем в две функции — контракт `FormWizardConfig` из `@reformer/cdk/form-wizard` (`validateStep?(step): boolean | Promise<boolean>`, `validateAll?(): boolean | Promise<boolean>`).

```typescript
import {
  apply,
  defineValidationSchema,
  validateModel,
  type ValidationSchema,
} from '@reformer/core/validation';

// Полная схема = композиция шагов; пустая — для шага вне диапазона (гасит тронутые поля).
const fullSchema = defineValidationSchema<Root>(() => apply(...STEP_SCHEMAS));
const emptySchema: ValidationSchema<Root> = () => {};

export function makeValidationConfig(model: FormModel<Root>) {
  return {
    validateStep: (step: number): Promise<boolean> =>
      validateModel(model, STEP_SCHEMAS[step - 1] ?? emptySchema),
    validateAll: (): Promise<boolean> => validateModel(model, fullSchema),
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

### Мост «поведение инициирует валидацию» { #revalidate-bridge }

Валидация и поведение (`defineFormBehavior` + `compute/copyFrom/enableWhen/…`) — **раздельные** слои: поведение не владеет валидацией. Если по изменению зависимого поля нужно перепрогнать схему (не дожидаясь submit/перехода шага), мост — оператор `revalidateWhen` из behavior-слоя, который зовёт тот же раннер:

```typescript
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { validateModel } from '@reformer/core/validation';

const behavior = defineFormBehavior<Root>(({ model }) => {
  revalidateWhen([model.$.password], () => void validateModel(model, fullSchema));
});
```

Схема — та же стабильная `const`-ссылка, что и в конфиге wizard'а. Контракт поведения при этом не меняется — см. [03-render-behavior.md](03-render-behavior.md) и `@reformer/core` [27-revalidate-when.md](../../../reformer/docs/llms/27-revalidate-when.md).

## Полный рабочий пример { #full-example }

Зеркалит golden (`complex-multy-step-form-renderer`): валидация — `ValidationSchema` над моделью, переиспользуемая всеми вариантами рендера, вкладывается инлайн в wizard-узел render-схемы. Submit и навигация между шагами приходят из render-behavior (`onComponentEvent('onSubmit')` / `renderEffect`), а не отсюда — см. [03-render-behavior.md](03-render-behavior.md).

```typescript
// validation.ts — ValidationSchema над МОДЕЛЬЮ (переиспользуется React/JSON/handwritten вариантами)
import { type FormModel } from '@reformer/core';
import {
  validate,
  validateWhen,
  cross,
  apply,
  defineValidationSchema,
  validateModel,
  type ValidationSchema,
} from '@reformer/core/validation';
import { required, min, minLength, email } from '@reformer/core/validators';
import type { CreditForm } from './types';

type Root = CreditForm;
type M = FormModel<CreditForm>;

const step1 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.loanType, [required({ message: 'Выберите тип кредита' })]);
  validate(model.$.loanAmount, [required(), min(50000, { message: 'Минимум 50 000 ₽' })]);
  // Условная ветка + cross-field: активна только для ипотеки, читает снапшот формы.
  validateWhen(
    () => model.loanType === 'mortgage',
    () =>
      cross(model.$.loanAmount, (f) =>
        f.loanAmount > f.propertyValue - f.initialPayment
          ? { code: 'loanTooBig', message: 'Сумма превышает стоимость минус взнос' }
          : null
      )
  );
});

const step2 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.personalData.firstName, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
});

const STEP_SCHEMAS: readonly ValidationSchema<Root>[] = [step1, step2];
const fullSchema = defineValidationSchema<Root>(() => apply(...STEP_SCHEMAS));
const emptySchema: ValidationSchema<Root> = () => {};

/** Контракт FormWizardConfig: per-step + полная валидация через validateModel. */
export function makeCreditValidationConfig(model: M) {
  return {
    validateStep: (step: number): Promise<boolean> =>
      validateModel(model, STEP_SCHEMAS[step - 1] ?? emptySchema),
    validateAll: (): Promise<boolean> => validateModel(model, fullSchema),
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
            value: model.$.loanAmount,
            componentProps: { label: 'Сумма' },
          },
        },
      ],
    },
  } as RenderNode<CreditForm>;
}
```

## Anti-patterns

- **Вписывать `validators` в лист RenderNode** (`{ value: model.$.x, component: Input, validators: [...] }`) — главная ловушка. У `ModelFieldRenderNode` нет поля `validators` (как и у array/container узлов). TypeScript даёт `TS2353: 'validators' does not exist in type 'RenderNode<T>'`. Валидация значений живёт в отдельной `ValidationSchema` над моделью (Шаг 1), а не в render-дереве.
- **Ждать, что рендерер сам провалидирует значения** — `FormRenderer` только отображает ошибки, уже проставленные в ноды. Значения проверяет `validateModel(model, schema)`; без её вызова (обычно из `validateStep`/`validateAll` wizard-а) поля не подсветятся.
- **Читать текущее значение вместо сигнала в `validate`** — оператор это `validate(model.$.path, [rules])`, где `model.$.path` — СИГНАЛ (стабильная ссылка на форму модели), а не текущее значение поля. Значения читает раннер в момент прогона; cross-field берёт снапшот через `model.get()` внутри `cross(sig, fn)`. Не передавайте в `validate` результат `model.get()` / `.value`.
- **Пересоздавать схему на каждый вызов конфига** (`validateModel(model, defineValidationSchema(...))` инлайн) — раннер отменяет **устаревший прогон той же `(model, schema)`** по ссылке на схему. Новый объект схемы на каждый вызов ломает отмену и гашение полей. Держите схемы стабильными module-level `const` (`STEP_SCHEMAS`, `fullSchema`).
- **Забыть `selector: 'wizard'` при инъекции через render-behavior** — без `selector` узел не адресуется через `schema.node('wizard')`, `onInit`/`patchProps` не найдут его и валидация не прокинется. (При инлайн-инъекции в `componentProps` это не нужно.)
- **`array` на array-узле + строгая типизация листа = `TS2741`.** Привязка массива это `array: model.<path>` (value-доступ, напр. `model.coBorrowers`), НЕ `model.$.coBorrowers`. Тип `ModelArray<U>` рантайм-совместим с требуемым `RenderModelArrayControl`, но в публичном типе у него **не объявлен** `__path`, поэтому под строгим контекстом узла TS ругается `Property '__path' is missing in type 'ModelArray<T>' but required in 'RenderModelArrayControl'`. Golden обходит это кастом всего дерева `as unknown as RenderNode<T>` в конце билдера (`render-schema.ts`) — это канон для схемы с array-узлами; привязка при этом остаётся `array: model.<path>` (см. [02-render-schema.md](02-render-schema.md#array)). Per-item **валидация** таких массивов — оператор `each(model.<path>, im => { … })` в схеме, не в render-дереве.

## See also

- [02-render-schema.md](02-render-schema.md) — структура `RenderNode`: лист-поле несёт только layout, массивы (`array: model.<path>`).
- [03-render-behavior.md](03-render-behavior.md) — `onInit`/`patchProps` для инъекции конфига в wizard-узел; `revalidateWhen`-мост к `validateModel`.
- [01-overview.md](01-overview.md) — wizard-узел, `FormWizardConfig` (`{ validateStep?, validateAll? }`), передача `form` через `componentProps`.
- `@reformer/core` [13-multi-step.md](../../../reformer/docs/llms/13-multi-step.md) — операторы `ValidationSchema` (`validate`/`validateAsync`/`validateWhen`/`cross`/`each`/`apply`), раннер `validateModel`, `STEP_SCHEMAS`, конфиг wizard'а.
- `@reformer/renderer-json` [06-validation.md](../../../reformer-renderer-json/docs/llms/06-validation.md) — родственный паттерн для JSON-схемы (та же model-валидация, инъекция через render-behavior).

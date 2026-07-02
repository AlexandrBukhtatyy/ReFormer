# FormWizard — multi-step форма

`@reformer/ui-kit/form-wizard` — стилизованный wrapper поверх headless
`@reformer/cdk/form-wizard`. Один компонент покрывает все три флоу:
TS-схема, renderer-react RenderSchema, renderer-json.

## Базовое использование

```tsx
import { useMemo, useRef, type FC } from 'react';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import { FormField, Input, Checkbox } from '@reformer/ui-kit';
import type { FormWizardHandle, FormWizardConfig } from '@reformer/cdk/form-wizard';
import { createModel, createForm, validateFormModel, type FormProxy } from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';

// Используйте `type`, не `interface`, для structural-совместимости с
// constraint `T extends Record<string, any>` внутри FormWizard generic'а.
type MyForm = {
  email: string;
  password: string;
  confirmation: boolean;
};

// M1: модель — источник истины значений; листья схемы ссылаются на её сигналы.
const model = createModel<MyForm>({ email: '', password: '', confirmation: false });
const schema = {
  children: [
    {
      value: model.$.email,
      component: Input,
      componentProps: { label: 'Email', testId: 'email' },
      validators: [required(), email()],
    },
    {
      value: model.$.password,
      component: Input,
      componentProps: { label: 'Пароль', testId: 'password' },
      validators: [required(), minLength(8)],
    },
    {
      value: model.$.confirmation,
      component: Checkbox,
      componentProps: { label: 'Подтверждаю' },
      validators: [required()],
    },
  ],
};
const form = createForm<MyForm>({ model, schema });

const Step1: FC<{ control: FormProxy<MyForm> }> = ({ control }) => (
  <FormField control={control.email} />
);

const Step2: FC<{ control: FormProxy<MyForm> }> = ({ control }) => (
  <FormField control={control.password} />
);

const steps: FormWizardStep<MyForm>[] = [
  { number: 1, title: 'Email', icon: '📧', body: Step1 },
  { number: 2, title: 'Пароль', icon: '🔒', body: Step2 },
  { number: 3, title: 'Готово', icon: '✓', body: <ConfirmationView /> },
];

// ⚠️ КРИТИЧНО: `config` это **FormWizardConfig** — объект с ДВУМЯ колбэками
// (`validateStep`, `validateAll`), НЕ схемы/массивы валидаторов. Каждый колбэк
// возвращает `boolean | Promise<boolean>`: `true` = валидно, идём дальше.
// Если колбэк не задан — соответствующий шаг/submit считается валидным (no-op).
// Канон M1 — валидировать per-step/полностью через validateFormModel(model, ...).
const config: FormWizardConfig = {
  // step 1-based. Провалидируй нужный шаг (собери под-схему шага и прогони
  // validateFormModel), верни boolean.
  validateStep: async (step) => {
    const stepSchema = { children: [schema.children[step - 1]] };
    const res = await validateFormModel(model, stepSchema);
    return res.valid;
  },
  validateAll: async () => (await validateFormModel(model, schema)).valid,
};

// ref типизируется явно типом формы; constraint `T extends Record<string, any>`
// позволяет nullable-поля (`number | null`) внутри MyForm без TS-ошибок.
const navRef = useRef<FormWizardHandle<MyForm>>(null);

// ВАЖНО: prop-level `onSubmit` имеет signature `() => void | Promise<void>` —
// БЕЗ аргумента values. Это by-design (см. FormWizardActionsProps в @reformer/cdk).
// Чтобы получить values — читай их из модели внутри handler:
const handleSubmit = async () => {
  const values = model.get();
  await api.submit(values);
};

<FormWizard
  ref={navRef}
  form={form}
  config={config}
  steps={steps}
  onSubmit={handleSubmit}
/>;
```

> **`config` не привязан к типу формы.** `FormWizardConfig` — это `{ validateStep?, validateAll? }`,
> оба колбэка возвращают `boolean | Promise<boolean>`. Канон M1 — прогонять
> `validateFormModel(model, schema)` (именно он исполняет `validators` листьев;
> `form.validate()` по нодам схемные правила НЕ запустит).

### Альтернатива — imperative submit с values

`navRef.current?.submit(callback)` — отдельный API, ПРИНИМАЕТ `(values: T) =>` callback.
Удобно для save-and-exit flow:

```tsx
// FormWizardHandle.submit<R>(cb: (values: T) => Promise<R> | R): Promise<R | null>
const handleSaveAndExit = async () => {
  const result = await navRef.current?.submit((values) => api.saveDraft(values));
  if (result) router.push('/dashboard');
};
```

Различие — два разных entry point: `<FormWizard onSubmit={...}>` (no-arg, для submit-button click)
и `navRef.current?.submit(values => ...)` (с values, для programmatic submit).

## Полиморфный `step.body`

`body` принимает три формы (runtime-discriminated):

| Форма                                      | Когда использовать                                 |
| ------------------------------------------ | -------------------------------------------------- |
| `ComponentType<{ control: FormProxy<T> }>` | TS-flow; FC получает `control={form}` через ui-kit |
| `ReactNode` (готовый JSX)                  | Статический контент шага без необходимости control |
| `RenderNode<T>` (RenderSchema subtree)     | renderer-react / renderer-json flows               |

Все три варианта работают в одном wizard'е — можно комбинировать.

## RenderNode body (renderer-react / renderer-json)

M1: схема без аргумента `path` — листья ссылаются на сигналы модели
(`value: model.$.x`), а не на `path.x`:

```tsx
import { createRenderSchema } from '@reformer/renderer-react';
import { Box, Input } from '@reformer/ui-kit';

const renderSchema = createRenderSchema<CreditApplication>(() => ({
  selector: 'wizard',
  component: FormWizard,
  componentProps: {
    form,
    config,
    onSubmit: handleSubmit,
    steps: [
      {
        number: 1,
        title: 'Кредит',
        icon: '💰',
        body: {
          component: Box,
          componentProps: { className: 'space-y-4' },
          children: [
            { value: model.$.loanAmount, component: Input },
            { value: model.$.loanTerm, component: Input },
          ],
        },
      },
    ],
  },
}));
```

ui-kit FormWizard детектирует RenderNode (объект с `.component` без React-element-маркера) и оборачивает в `RenderNodeComponent` с `form={form}`.

### ⚠️ RenderNode body требует RenderContextProvider

Когда `step.body` это `RenderNode<T>` (renderer-react / renderer-json flow), **FormWizard ДОЛЖЕН быть обёрнут в `<RenderContextProvider>`** или находиться внутри `<FormRenderer>`. Иначе runtime-ошибка:

```
useRenderContext must be used within RenderContextProvider (FormRenderer)
```

`RenderNodeComponent` (которым FormWizard рендерит body) использует context — без провайдера контекст не найден.

**Canonical mounting** для renderer-react:

```tsx
import { FormRenderer } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';

// FormWizard как root render-node — FormRenderer уже даёт RenderContextProvider:
<FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />;
```

**Если FormWizard рендерится напрямую** (не как root render-node, а внутри обычного React-tree, но с RenderNode bodies) — оберни вручную:

```tsx
import { RenderContextProvider } from '@reformer/renderer-react';

<RenderContextProvider settings={{ fieldWrapper: FormField }}>
  <FormWizard form={form} steps={steps} ... />
</RenderContextProvider>
```

**TS-flow body (FC компоненты) — провайдер НЕ нужен**: ui-kit FormWizard рендерит FC напрямую без render-pipeline.

## JSON

```jsonc
{
  "component": "FormWizard",
  "componentProps": {
    "config": "WIZARD_CONFIG",
    "onSubmit": "handleSubmit",
    "steps": [
      {
        "number": 1,
        "title": "Кредит",
        "icon": "💰",
        "body": {
          "component": "Box",
          "children": [{ "model": "loanAmount" }, { "model": "loanTerm" }],
        },
      },
    ],
  },
}
```

`body` — обычный JsonNode → конвертер renderer-json превращает в RenderNode → ui-kit FormWizard рендерит.

## Compound API

`FormWizard.Indicator/Step/Actions/Progress` — re-export headless слотов из CDK для consumer-ов, которым нужен полностью кастомный layout (например, indicator поверх кастомного header'а).

```tsx
<FormWizard.Indicator steps={...}>
  {(props) => <CustomIndicator {...props} />}
</FormWizard.Indicator>
```

## Ref / handle

```tsx
const wizardRef = useRef<FormWizardHandle<MyForm>>(null);

<FormWizard ref={wizardRef} ... />

// Программная навигация и submit (см. FormWizardHandle<T> в @reformer/cdk):
wizardRef.current?.goToStep(2); // boolean: false, если предыдущий шаг не завершён
await wizardRef.current?.goToNextStep(); // валидирует текущий шаг, затем переходит
wizardRef.current?.goToPreviousStep();
await wizardRef.current?.validateCurrentStep(); // Promise<boolean>

// submit принимает callback (values: T) => R | Promise<R>; возвращает R | null
// (null — не прошла validateAll):
const result = await wizardRef.current?.submit((values) => api.submit(values));
```

Доступные поля/методы `FormWizardHandle<T>`: `form`, `currentStep`,
`completedSteps`, `isFirstStep`, `isLastStep`, `isValidating`,
`validateCurrentStep()`, `goToNextStep()`, `goToPreviousStep()`,
`goToStep(step)`, `submit(cb)`.

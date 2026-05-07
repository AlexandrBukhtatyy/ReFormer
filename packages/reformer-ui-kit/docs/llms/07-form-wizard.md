# FormWizard — multi-step форма

`@reformer/ui-kit/form-wizard` — стилизованный wrapper поверх headless
`@reformer/cdk/form-wizard`. Один компонент покрывает все три флоу:
TS-схема, renderer-react RenderSchema, renderer-json.

## Базовое использование

```tsx
import { useRef } from 'react';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import type { FormProxy, ValidationSchemaFn } from '@reformer/core';

// Используйте `type`, не `interface`, для structural-совместимости с
// FormFields constraint внутри FormWizard generic'а.
type MyForm = {
  email: string;
  password: string;
  confirmation: boolean;
};

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

// ⚠️ КРИТИЧНО: `stepValidations` это **Record<number, ValidationSchemaFn<T>>**,
// НЕ array. Если объявить как array `[step1Fn, step2Fn]` — FormWizard молча
// пропустит валидацию, "Далее" сработает без проверок. Silent no-op, без
// runtime warning.
const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<MyForm>> = {
  1: (path) => {
    required(path.email);
    email(path.email);
  },
  2: (path) => {
    required(path.password);
    minLength(path.password, 8);
  },
};

const fullValidation: ValidationSchemaFn<MyForm> = (path) => {
  STEP_VALIDATIONS[1](path);
  STEP_VALIDATIONS[2](path);
  required(path.confirmation);
};

// ref типизируется явно типом формы; constraint `T extends Record<string, any>`
// позволяет nullable-поля (`number | null`) внутри MyForm без TS-ошибок.
const navRef = useRef<FormWizardHandle<MyForm>>(null);

// ВАЖНО: prop-level `onSubmit` имеет signature `() => void | Promise<void>` —
// БЕЗ аргумента values. Это by-design (см. FormWizardActionsProps в @reformer/cdk).
// Чтобы получить values — читай их из form внутри handler:
const handleSubmit = async () => {
  const values = form.getValue();
  await api.submit(values);
};

<FormWizard
  ref={navRef}
  form={form}
  config={{ stepValidations: STEP_VALIDATIONS, fullValidation }}
  steps={steps}
  onSubmit={handleSubmit}
/>;
```

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

```tsx
const renderSchema = (path) => ({
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
          children: [{ component: path.loanAmount }, { component: path.loanTerm }],
        },
      },
    ],
  },
});
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
<FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
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

// Программная навигация:
wizardRef.current?.goToStep(2);
wizardRef.current?.submit(handleSubmit);
```

# FormWizard — multi-step форма

`@reformer/ui-kit/form-wizard` — стилизованный wrapper поверх headless
`@reformer/cdk/form-wizard`. Один компонент покрывает все три флоу:
TS-схема, renderer-react RenderSchema, renderer-json.

## Базовое использование

```tsx
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormProxy } from '@reformer/core';

interface MyForm {
  email: string;
  password: string;
  confirmation: boolean;
}

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

<FormWizard
  form={form}
  config={{ stepValidations: STEP_VALIDATIONS, fullValidation }}
  steps={steps}
  onSubmit={async (values) => api.submit(values)}
/>
```

## Полиморфный `step.body`

`body` принимает три формы (runtime-discriminated):

| Форма | Когда использовать |
|---|---|
| `ComponentType<{ control: FormProxy<T> }>` | TS-flow; FC получает `control={form}` через ui-kit |
| `ReactNode` (готовый JSX) | Статический контент шага без необходимости control |
| `RenderNode<T>` (RenderSchema subtree) | renderer-react / renderer-json flows |

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
          children: [
            { component: path.loanAmount },
            { component: path.loanTerm },
          ],
        },
      },
    ],
  },
});
```

ui-kit FormWizard детектирует RenderNode (объект с `.component` без React-element-маркера) и оборачивает в `RenderNodeComponent` с `form={form}`.

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
          "children": [
            { "model": "loanAmount" },
            { "model": "loanTerm" }
          ]
        }
      }
    ]
  }
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

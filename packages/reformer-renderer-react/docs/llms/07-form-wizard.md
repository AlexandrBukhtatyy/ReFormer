# FormWizard — многошаговая форма в renderer-react

Wizard-узел RenderSchema: `FormWizard` из `@reformer/ui-kit/form-wizard` (канонический
shipped-компонент, своего визарда рендерер не поставляет). Форма передаётся через
`componentProps.form`, шаги — через `componentProps.steps`, а тело шага рисуется стратегией
`renderStepBody`.

Полный справочник по самому компоненту (полиморфный `step.body`, `FormWizardConfig`,
`FormWizardHandle`, mounting под `RenderContextProvider`) — `@reformer/ui-kit`
`docs/llms/07-form-wizard.md`. Здесь — только то, что специфично для render-схемы.

## Форма wizard-узла

`steps` — массив `{ number, title, icon, body }`, где `body` — это `RenderNode`, поддерево
M1-схемы шага. `body` самостоятелен: оборачивать его в `component: Step` + `children` НЕ нужно.

```tsx
import { FormWizard } from '@reformer/ui-kit/form-wizard';
import { RenderNodeComponent, type RenderNode } from '@reformer/renderer-react';
import { Box, InputField } from '@reformer/ui-kit';

// form нужен ТОЛЬКО рендеру; при createForm дерево строится БЕЗ form.
function buildSchema(model: FormModel<MyForm>, form?: FormProxy<MyForm>): RenderNode<MyForm> {
  return {
    selector: 'wizard',
    component: FormWizard,
    componentProps: {
      ...(form ? { form } : {}),
      config, // FormWizardConfig: { validateStep?, validateAll? }
      // ОБЯЗАТЕЛЬНО для RenderNode-тела: см. раздел ниже.
      renderStepBody: (body: RenderNode<MyForm>, wizardForm: FormProxy<MyForm>) => (
        <RenderNodeComponent node={body} form={wizardForm} />
      ),
      steps: [
        {
          number: 1,
          title: 'Кредит',
          icon: '💰',
          body: {
            component: Box,
            componentProps: { className: 'space-y-4' },
            children: [
              { value: model.$.loanAmount, component: InputField, componentProps: { label: 'Сумма' } },
              { value: model.$.loanTerm, component: InputField, componentProps: { label: 'Срок' } },
            ],
          },
        },
        // ...остальные шаги
      ],
    },
  };
}
```

## `renderStepBody` обязателен

ui-kit намеренно не зависит от `@reformer/renderer-react` — дизайн-система не тянет рендерер.
Поэтому `FormWizard` умеет только два вида `body`: `ReactNode` и `ComponentType`. Третий вид —
`RenderNode` — он отдаёт стратегии из пропа
`renderStepBody: (body: TBody, form: FormProxy<T>) => ReactNode`.

**Без стратегии шаг не отрисуется, а упадёт.** Плоский объект узла уходит React'у как
child, и React бросает `Objects are not valid as a React child (found: object with keys
{component, componentProps, children})`, размонтируя корень: error boundary ни в рендерере, ни
в ui-kit нет. Ни `tsc`, ни `validate_form kind="code"` этого не ловят — тип тела в
`componentProps` не проверяется (`ContainerRenderNodeProps` — индексная сигнатура).

Тип тела расширяется вторым generic-параметром: `FormWizard<T, RenderNode<T>>`.

Из-за JSX в стратегии файл схемы обычно получает расширение `.tsx` — канон раскладки это
допускает (`renderer.schema.tsx`).

## Листья внутри `steps[].body` тоже harvest'ятся

Сборка обходит дерево key-agnostic и доходит до каждого `{ value: signal }`-листа независимо от
вложенности — включая листья внутри `componentProps.steps[].body`. Отсюда двойной проход, и
делает его фабрика:

```tsx
const myForm = useReactForm(() =>
  createReactForm<MyForm>({ model: createMyModel(), schema: buildSchema })
);
// внутри: buildSchema(model) — дерево БЕЗ формы для harvest'а (FormProxy самоссылочен, обход по
// нему упал бы с переполнением стека), затем buildSchema(model, form) — дерево для рендера, из
// которого wizard-узел берёт форму. Писать эту пару руками больше не нужно.
```

## Валидация и submit

`config` — это `FormWizardConfig`, то есть `{ validateStep?, validateAll? }`; оба колбэка
возвращают `boolean | Promise<boolean>`. Канон — прогонять `validateModel(model, schema)` из
`@reformer/core/validation`: валидация живёт отдельным слоем, в layout-схеме валидаторов нет.

Кнопка отправки гейтит вызов через `config.validateAll`: при провале `onSubmit` не вызывается,
а поля помечаются `touched`. Поэтому валидировать руками в обработчике не нужно.
`FormWizardProps.onSubmit` — это `() => void | Promise<void>`, **аргументов у него нет**:
снимок значений берётся из модели (`model.get()`). Типизировать его как
`(values: MyForm) => …` — ошибка компиляции.

Императивный доступ — через `schema.node('wizard').getRef<FormWizardHandle<T>>()`:
`handle.submit(cb)` принимает `(values) => …`, проходит тот же гейт и возвращает `null`, если
валидация не прошла. Компонент под селектором обязан пробрасывать `ref`, иначе handle пуст.

## См. также

- `@reformer/ui-kit` `docs/llms/07-form-wizard.md` — сам компонент целиком.
- `@reformer/cdk` `docs/llms/03-form-navigation.md` — headless-навигация и `FormWizard.Actions`.
- [03-render-behavior.md](03-render-behavior.md) — `onComponentEvent`, `renderEffect`, `hideWhen`.
- [06-validation.md](06-validation.md) — per-step схемы и `defineSteps`.

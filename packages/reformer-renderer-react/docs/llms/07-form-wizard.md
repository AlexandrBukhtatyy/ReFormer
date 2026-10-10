# FormWizard — многошаговая форма в renderer-react

Визард в схеме — обычный узел: `FormWizard` из `@reformer/ui-kit` (канонический компонент, своего
визарда рендерер не поставляет). Шаги — дети узла визарда, правила шагов — поток сборки
`createForm({ flow })`. Форму, поток шагов и отправку визард берёт из сборки сам: `FormRenderer`
ставит контекст сборки, а визард объявляет `__selfManagedChildren` и получает узлы шагов данными
вместе с функцией их отрисовки (`renderNode`).

Полный справочник по самому компоненту (полиморфный `step.body` для JSX-разметки, слоты
`FormWizard.Indicator` / `.Actions` / `.Progress`) — `@reformer/ui-kit` `docs/llms/07-form-wizard.md`.
Здесь — только то, что специфично для схемы.

## Узел визарда и шаги

```tsx
import type { FormModel } from '@reformer/core';
import type { RenderNode } from '@reformer/renderer-react';
import { Step } from '@reformer/cdk/form-wizard';
import { Box, FormWizard, InputNumber } from '@reformer/ui-kit';

export const creditSchema = (model: FormModel<CreditForm>): RenderNode<CreditForm> => ({
  selector: 'wizard',
  component: FormWizard,
  componentProps: { submitLabel: 'Отправить заявку' },
  children: [
    {
      selector: 'loan', // идентификатор шага в потоке сборки
      component: Step,
      componentProps: { title: 'Кредит', icon: '💰' }, // заголовок и значок — в индикатор шагов
      children: [
        {
          component: Box,
          componentProps: { className: 'space-y-4' },
          children: [
            { model: model.$.loanAmount, component: InputNumber, componentProps: { label: 'Сумма' } },
            { model: model.$.loanTerm, component: InputNumber, componentProps: { label: 'Срок' } },
          ],
        },
      ],
    },
    { selector: 'confirm', component: Step, componentProps: { title: 'Подтверждение', icon: '✓' } },
  ],
});
```

- `selector` узла визарда — чтобы адресовать его из поведения (`schema.node('wizard')`).
- `selector` узла шага — идентификатор шага в потоке. Визард рисует шаги **в порядке потока** и
  связывает их с узлами по `selector`.
- `Step` из `@reformer/cdk/form-wizard` — маркер шага: рисует детей, а `title`/`icon` из его
  `componentProps` читает индикатор.
- Ни `form`, ни `flow`, ни `steps` в `componentProps` визарда передавать не нужно.

## Поток шагов

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';

function CreditFormPage() {
  const bundle = useFormBundle(() =>
    createForm<CreditForm>({
      model: createCreditModel(),
      schema: creditSchema,
      behavior: creditBehavior,
      validation: { extras: crossStepRules }, // проверяются только при отправке
      flow: { steps: [{ id: 'loan', rules: loanRules }, { id: 'confirm' }] },
    })
  );
  return <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />;
}
```

- Кнопка «Далее» зовёт `flow.next()`: правила текущего шага; при замечаниях поток остаётся на шаге,
  а поля помечаются `touched`. Шаг без `rules` проходится без проверки.
- Переход на шаг по индикатору — `flow.goTo(id)`: первый шаг доступен всегда, остальные — после
  прохождения предыдущего. «Назад» — `flow.previous()`.
- Расхождение шагов потока и узлов шагов — предупреждение в dev от сборки («в `flow.steps` есть шаги,
  для которых в дереве схемы нет узла с таким `selector`») и от визарда («шаги схемы и шаги потока
  расходятся»).
- Без потока в сборке визард строит позиционный поток по числу шагов — без правил.

Правила шагов — [06-validation.md](06-validation.md).

## Отправка и навигация из поведения

```tsx
import { defineFormBehavior, onComponentEvent, renderEffect } from '@reformer/core/behaviors';

export const creditBehavior = defineFormBehavior<CreditForm>(({ model, schema, flow }) => {
  // Кнопка отправки на последнем шаге зовёт обработчик через `bundle.submit`: только после
  // успешной проверки всей формы; при замечаниях поля помечаются touched.
  onComponentEvent(schema.node('wizard'), 'onSubmit', async (values: CreditForm) => {
    reportOutcome(await sendCreditApplication(values));
  });

  // Навигация — через поток шагов: ипотека возвращает к шагу кредита.
  renderEffect(schema, () => {
    if (model.loanType === 'mortgage') flow?.goTo('loan');
  });
});
```

Снаружи визарда — тот же поток и та же отправка бандла:

```tsx
import { useFormFlow } from '@reformer/core/react';

const { current, index, isLast } = useFormFlow(bundle.flow!); // снимок для рендера
bundle.flow?.goTo('loan'); // FlowTransition: moved | stayed (reason: 'locked', …)
const outcome = await bundle.submit(sendCreditApplication); // SubmitResult
```

## Прежний контракт — удалён

| Было (удалено) | Стало |
|---|---|
| шаги в `componentProps.steps` (`{ number, title, icon, body }`) + `renderStepBody` | шаги — дети узла визарда (`component: Step`) |
| `componentProps.form` визарда | форма из контекста сборки (`FormRenderer form={bundle}`) |
| `config: { validateStep, validateAll }`, `defineSteps` | `createForm({ flow: { steps: [{ id, rules }] } })` |
| `schema.node('wizard').getRef<FormWizardHandle>()`, `goToStep(n)` | `flow.goTo(id)`, `flow.next()`, `flow.previous()` |
| `onSubmit` без аргументов, снимок `model.get()` | `onSubmit(values)` через `bundle.submit` |

Проп `steps` с `body` и `renderStepBody` остаётся у `FormWizard` для разметки в JSX (не в схеме): тело
шага — компонент, ReactNode или узел схемы, который рисует стратегия
`renderStepBody={(body, form) => <RenderNodeComponent node={body} form={form} />}`.

## Прежний путь сборки: `createReactForm`

`createReactForm` рендерит функцию-схему, а не бандл, но уровень формы в нём тот же: `FormRenderer`
с этим бандлом (`form={bundle}` или `render={bundle.render}`) ставит контекст сборки. Визард берёт из
него форму и поток, а отправка идёт через `bundle.submit` — с проверкой, как у `createForm`.
Новому коду этот путь не нужен.

## См. также

- `@reformer/ui-kit` `docs/llms/07-form-wizard.md` — сам компонент целиком.
- `@reformer/cdk` `docs/llms/03-form-navigation.md` — headless-навигация и `FormWizard.Actions`.
- [03-render-behavior.md](03-render-behavior.md) — `onComponentEvent`, `renderEffect`, `hideWhen`.
- [06-validation.md](06-validation.md) — правила шагов, тексты замечаний.

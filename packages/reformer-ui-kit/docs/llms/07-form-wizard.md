# FormWizard — multi-step форма

`@reformer/ui-kit/form-wizard` — стилизованный wrapper поверх headless
`@reformer/cdk/form-wizard`. Один компонент покрывает все три флоу:
TS-схема (renderer-react), JSON (renderer-json) и разметка в JSX («React руками»).

Шаги, их порядок и проверку держит не визард, а **поток шагов** сборки `createForm({ flow })`
(`FormFlow` из `@reformer/core`). Визард — адаптер потока: рисует индикатор, тело текущего шага и
кнопки, а «Далее», «Назад» и переход по индикатору зовут переходы потока. Поток визард берёт из
пропа `flow`, иначе из сборки в контексте (её ставит `FormRenderer`); без того и другого он строит
позиционный поток **без правил** — «Далее» тогда ничего не проверяет.

## Поток шагов

```ts
import { createForm } from '@reformer/core';

createForm<CreditForm>({
  model: createCreditModel(),
  schema: creditSchema,
  validation: { extras: crossStepRules }, // правила вне шагов — проверяются только целиком
  flow: {
    steps: [
      { id: 'loan', rules: loanRules }, // id = selector узла шага в схеме
      { id: 'contacts', rules: contactsRules },
      { id: 'confirm' }, // шаг без правил: без `rules` (или `rules: null`)
    ],
  },
});
```

- **`id` шага** — его идентификатор и одновременно `selector` узла шага в схеме. Повтор `id` —
  исключение при сборке.
- **«Далее»** проверяет правила текущего шага (`flow.next()`): при замечаниях поток остаётся на
  шаге, поля шага помечаются `touched` и показывают ошибки.
- **Отправка** проверяет всё: полный набор собирается из правил шагов и `validation.extras`
  (либо задаётся целиком `validation.rules`).
- **Переход по индикатору** — `flow.goTo(id)`: первый шаг доступен всегда, остальные — после
  прохождения предыдущего (иначе переход остаётся с причиной `locked`).
- Правила — `defineValidation` без текстов: правило несёт `code`, текст — словарь
  `defineIssueMessages` в `ValidationMessagesProvider messages` (`@reformer/cdk`).

## В схеме формы (renderer-react)

Визард — обычный узел схемы. Шаги лежат в его `children`, форму и поток он берёт из сборки
`createForm` сам. Прикладная обёртка, которая подставляла бы `form`, `flow` или `steps`, не нужна.

```tsx
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineFormBehavior, onComponentEvent } from '@reformer/core/behaviors';
import { FormRenderer } from '@reformer/renderer-react';
import { Step } from '@reformer/cdk/form-wizard';
import { FormField, FormWizard, Input, InputNumber } from '@reformer/ui-kit';

const creditSchema = (model: FormModel<CreditForm>): FormSchemaNode => ({
  selector: 'wizard',
  component: FormWizard,
  componentProps: { submitLabel: 'Отправить заявку' },
  children: [
    {
      selector: 'loan', // id шага в потоке сборки
      component: Step,
      componentProps: { title: 'Кредит', icon: '💰' },
      children: [{ model: model.$.loanAmount, component: InputNumber }],
    },
    {
      selector: 'contacts',
      component: Step,
      componentProps: { title: 'Контакты', icon: '📞' },
      children: [{ model: model.$.phone, component: Input }],
    },
  ],
});

const creditBehavior = defineFormBehavior<CreditForm>(({ schema }) => {
  // Обработчик получает значения формы; зовётся только после успешной проверки всей формы.
  onComponentEvent(schema.node('wizard'), 'onSubmit', (values: CreditForm) => api.submit(values));
});

function CreditPage() {
  const credit = useFormBundle(() =>
    createForm<CreditForm>({
      model: createCreditModel(),
      schema: creditSchema,
      behavior: creditBehavior,
      validation: { extras: crossStepRules },
      flow: {
        steps: [
          { id: 'loan', rules: loanRules },
          { id: 'contacts', rules: contactsRules },
        ],
      },
    })
  );

  return <FormRenderer form={credit} settings={{ fieldWrapper: FormField }} />;
}
```

- **Шаг схемы ↔ шаг потока — по `selector`.** Визард рисует шаги в порядке потока
  (`flow.steps`), а не в порядке узлов: перестановка узлов в схеме ничего не сбивает.
- **Расхождение видно в dev.** Шаг потока без узла и узел шага, `selector` которого нет в потоке,
  дают предупреждение (`[ui-kit] FormWizard: шаги схемы и шаги потока расходятся`), а `createForm`
  предупреждает о шагах потока без узла в дереве (когда с деревом совпала только часть шагов).
  Иначе опечатка в селекторе молча оставила бы шаг без разметки.
- Заголовок и иконка шага — `componentProps.title` и `componentProps.icon` узла шага; подпись
  кнопки отправки — `componentProps.submitLabel` визарда.
- **Отправка** — `onComponentEvent(schema.node('wizard'), 'onSubmit', handler)` в поведении формы.
  Внутри сборки кнопка идёт через `bundle.submission.submit`: обработчик получает значения и
  зовётся только после успешной проверки, при замечаниях тронутой помечается вся форма.
- **Навигация из поведения** — поток из области поведения:

  ```ts
  import { defineFormBehavior, renderEffect } from '@reformer/core/behaviors';

  defineFormBehavior<CreditForm>(({ model, schema, flow }) => {
    renderEffect(schema, () => {
      if (model.loanType === 'mortgage') flow?.goTo('loan');
    });
  });
  ```

## JSON (renderer-json)

Тот же узел — в документе формата 2: шаги — дети визарда, `selector` шага совпадает с `id` в
потоке. Поток и поведение остаются в коде сборки, в JSON их нет.

```jsonc
{
  "selector": "wizard",
  "component": "$component(FormWizard)",
  "componentProps": { "submitLabel": "Отправить заявку" },
  "children": [
    {
      "selector": "loan",
      "component": "$component(Step)",
      "componentProps": { "title": "Кредит", "icon": "💰" },
      "children": [
        { "model": "$model(loanAmount)", "component": "$component(InputNumber)" },
        { "model": "$model(loanTerm)", "component": "$component(InputNumber)" },
      ],
    },
    {
      "selector": "contacts",
      "component": "$component(Step)",
      "componentProps": { "title": "Контакты", "icon": "📞" },
      "children": [{ "model": "$model(phone)", "component": "$component(Input)" }],
    },
  ],
}
```

```ts
// registry.ts
import { defineRegistry } from '@reformer/renderer-json';
import { Step } from '@reformer/cdk/form-wizard';
import { FormWizard } from '@reformer/ui-kit';

export const registry = defineRegistry((reg) => {
  reg.component('FormWizard', FormWizard); // библиотечный визард, без обёртки
  reg.component('Step', Step);
});

// сборка: документ + реестр, поток — как в TS-схеме
const credit = useFormBundle(() =>
  createForm<CreditForm>({
    model: createCreditModel(),
    schema: creditJson,
    registry,
    behavior: creditBehavior,
    flow: { steps: [{ id: 'loan', rules: loanRules }, { id: 'contacts', rules: contactsRules }] },
  })
);
return <FormRenderer form={credit} />;
```

Прикладной шим визарда не нужен: файлы `wizard.tsx` / `renderer.wizard.tsx` — прежние имена
раскладки, удаляйте их (`@reformer/mcp`
[06-form-directory-layout.md](../../../reformer-mcp/docs/llms/06-form-directory-layout.md) §7,
диагностика RF013). Документ прежнего формата (ключи `value` / `array`, шаги в
`componentProps.steps`) переводит `migrateJsonSchema` из `@reformer/renderer-json`.

## Разметка в JSX («React руками»)

Без рендерера визарду передают пропсами форму, поток и список шагов:

```tsx
import { createForm, type FormGroup } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';
import { CheckboxWithLabel, FormField, Input, InputPassword } from '@reformer/ui-kit';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';

type SignUp = {
  email: string;
  password: string;
  confirmation: boolean;
};

const emailRules = defineValidation<SignUp>(({ model }) => {
  validate(model.$.email, [required(), email()]);
});
const passwordRules = defineValidation<SignUp>(({ model }) => {
  validate(model.$.password, [required(), minLength(8)]);
});
const confirmRules = defineValidation<SignUp>(({ model }) => {
  validate(model.$.confirmation, [required()]); // для boolean обязательно `true`
});

const createSignUpForm = () =>
  createForm<SignUp>({
    initial: { email: '', password: '', confirmation: false },
    // Схема несёт только компоненты полей; правил в ней нет.
    schema: (model) => ({
      children: [
        { model: model.$.email, component: Input, componentProps: { label: 'Email', testId: 'email' } },
        {
          model: model.$.password,
          component: InputPassword,
          componentProps: { label: 'Пароль', testId: 'password' },
        },
        {
          model: model.$.confirmation,
          component: CheckboxWithLabel,
          componentProps: { label: 'Подтверждаю', testId: 'confirmation' },
        },
      ],
    }),
    flow: {
      steps: [
        { id: 'email', rules: emailRules },
        { id: 'password', rules: passwordRules },
        { id: 'confirm', rules: confirmRules },
      ],
    },
  });

const EmailStep = ({ control }: { control: FormGroup<SignUp> }) => (
  <FormField control={control.email} />
);
const PasswordStep = ({ control }: { control: FormGroup<SignUp> }) => (
  <FormField control={control.password} />
);
const ConfirmStep = ({ control }: { control: FormGroup<SignUp> }) => (
  <FormField control={control.confirmation} />
);

// Порядок = порядок шагов потока: STEPS[i] — шаг flow.steps[i].
const STEPS: FormWizardStep<SignUp>[] = [
  { number: 1, title: 'Email', icon: '📧', body: EmailStep },
  { number: 2, title: 'Пароль', icon: '🔒', body: PasswordStep },
  { number: 3, title: 'Готово', icon: '✓', body: ConfirmStep },
];

function SignUpWizard() {
  const signUp = useFormBundle(createSignUpForm);

  const submit = async () => {
    // Один прогон всех правил: при замечаниях обработчик не зовётся, поля помечены `touched`.
    const outcome = await signUp.submission.submit((values) => api.signUp(values));
    if (outcome.status === 'invalid') showHint('Проверьте заполнение формы');
    if (outcome.status === 'failed') showError(outcome.error);
  };

  return (
    <FormWizard
      form={signUp.form}
      flow={signUp.flow}
      steps={STEPS}
      onSubmit={submit}
      submitLabel="Зарегистрироваться"
    />
  );
}
```

- **`flow={bundle.flow}` обязателен для проверки шагов.** Без него визард строит позиционный
  поток по числу шагов — «Далее» переходит, ничего не проверяя.
- **`steps` сопоставляются с потоком по позиции**: `steps[i]` — шаг `flow.steps[i]`, записей
  столько же, сколько шагов потока; `number` — с единицы. Селекторы здесь не участвуют.
- **`onSubmit` в JSX проверку не делает.** Вне `FormRenderer` сборки в контексте нет, и визард зовёт
  колбэк по нажатию. Проверку и отправку делает `bundle.submission.submit(handler)` внутри
  колбэка, как выше. Если обернуть визард в `FormBundleContext.Provider value={bundle}`
  (`@reformer/core/react`), визард возьмёт форму и поток из контекста и сам пустит
  `onSubmit(values)` через `bundle.submission.submit`.
- **Состояние «Отправка…» вне сборки живое.** Визард зовёт колбэк через свою отправку без проверки
  (`createSubmission`), и кнопка показывает `kit.formWizard.submitting`, пока колбэк работает.
  Поэтому колбэк — `async` и возвращает промис, как `submit` выше.
- Результат отправки — `SubmitResult`: `{ status: 'submitted', result }`,
  `{ status: 'invalid' | 'error' | 'cancelled', validation }` либо `{ status: 'failed', error }`.

## Навигация снаружи визарда

Поток — объект сборки, поэтому навигация не требует ни `ref`, ни доступа к визарду:

```tsx
import { useFormFlow } from '@reformer/core/react';

await bundle.flow?.next(); // FlowTransition: { status: 'moved', from, to } | { status: 'stayed', step, reason }
bundle.flow?.previous();
bundle.flow?.goTo('loan'); // 'stayed' с reason 'locked', если предыдущий шаг не пройден
bundle.flow?.canGoTo('confirm'); // boolean
await bundle.validateStep('loan'); // ValidationResult; неизвестный шаг — исключение

// Состояние потока в рендере (подписка на сигналы потока):
const { current, index, isFirst, isLast, validating, completed } = useFormFlow(bundle.flow!);
```

Визард перерисуется сам — он подписан на тот же поток. `onStepChange` и прокрутка вверх
(`scrollToTop`) срабатывают только на переходы кнопками и индикатором визарда.

## Полиморфный `step.body`

В JSX-режиме `body` принимает три формы (runtime-discriminated):

| Форма                                      | Когда использовать                                                   |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `ComponentType<{ control: FormGroup<T> }>` | Компонент шага; получает `control={form}`                            |
| `ReactNode` (готовый JSX)                  | Статический контент шага без необходимости control                   |
| `TBody` (напр. узел схемы)                 | Тело — узел схемы, который рисует рендерер; **нужен проп `renderStepBody`** |

Все три варианта работают в одном визарде — можно комбинировать.

**Про третью форму.** ui-kit намеренно НЕ зависит от `@reformer/renderer-react` — дизайн-система
не должна тянуть рендерер. Поэтому `FormWizard` сам знает только `ReactNode` и `ComponentType`, а
всё остальное отдаёт стратегии из пропа
`renderStepBody: (body: TBody, form: FormGroup<T>) => ReactNode`. Тип тела расширяется вторым
generic-параметром: `FormWizard<T, RenderNode<T>>`. Без стратегии такое тело — адресная ошибка с
подсказкой, а не «Objects are not valid as a React child».

В схеме формы стратегия не нужна: рендерер передаёт визарду узлы шагов и функцию их отрисовки
(`children` + `renderNode`, маркер `__selfManagedChildren`).

### Узел схемы как тело шага в JSX

```tsx
import { RenderContextProvider, RenderNodeComponent, type RenderNode } from '@reformer/renderer-react';

<RenderContextProvider value={{ settings: { fieldWrapper: FormField } }}>
  <FormWizard<CreditForm, RenderNode<CreditForm>>
    form={bundle.form}
    flow={bundle.flow}
    steps={[{ number: 1, title: 'Кредит', icon: '💰', body: loanStepNode }]}
    renderStepBody={(body, form) => <RenderNodeComponent node={body} form={form} />}
    onSubmit={submit}
  />
</RenderContextProvider>;
```

`RenderNodeComponent` читает контекст рендеринга — вне `FormRenderer` его ставит
`RenderContextProvider` (`value={{ settings }}`). Без провайдера — ошибка
`useRenderContext must be used within RenderContextProvider (FormRenderer)`. Тело-компонент
(`ComponentType`) провайдера не требует: его визард рисует сам.

## Compound API

`FormWizard.Indicator/Step/Actions/Progress` — реэкспорт headless-слотов из CDK. Они читают
контекст визарда (`useFormWizard()`), поэтому работают внутри headless `FormWizard` из
`@reformer/cdk/form-wizard` — для полностью своей раскладки (например, индикатор в собственной
шапке):

```tsx
import { FormWizard } from '@reformer/cdk/form-wizard';

<FormWizard form={bundle.form} flow={bundle.flow}>
  <FormWizard.Indicator steps={indicatorSteps}>
    {(props) => <CustomIndicator {...props} />}
  </FormWizard.Indicator>
  …
</FormWizard>;
```

Готовые презентационные слоты кита — `StepIndicator`, `FormWizardActions`, `FormWizardProgress`
из `@reformer/ui-kit/form-wizard`.

## Прежний контракт → текущий

| Прежде (удалено)                                                            | Сейчас                                                                                  |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| ❌ `config={{ validateStep, validateAll }}`, тип `FormWizardConfig`          | поток сборки: правила шагов — `flow.steps[].rules`, полная проверка — `bundle.submission.submit` |
| ❌ `createForm({ validation: { steps: { loan: rules } } })`                 | `createForm({ flow: { steps: [{ id: 'loan', rules }] } })`, вне шагов — `validation.extras` |
| ❌ `ref` визарда и `FormWizardHandle` (`goToStep`, `goToNextStep`, `submit`) | `bundle.flow.goTo(id)` / `next()` / `previous()`, отправка — `bundle.submission.submit(handler)` |
| ❌ `schema.node('wizard').getRef<FormWizardHandle>()` в поведении            | `flow` из области поведения: `defineFormBehavior(({ flow }) => …)`                      |
| ❌ шим `wizard.tsx` / `renderer.wizard.tsx`, `steps`/`config` в `componentProps` | узел `FormWizard` с шагами-детьми `Step`                                              |
| ❌ `bundle.submit(handler)`, `bundle.submitting`                             | `bundle.submission.submit(handler)`, `bundle.submission.submitting` |

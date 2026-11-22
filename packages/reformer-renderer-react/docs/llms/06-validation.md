# Validation

Как валидировать **значения** формы, собранной из схемы (`@reformer/renderer-react`). Всё сверено с рабочим кодом: типы узла — [types.ts](../../src/core/types.ts), уровень формы — `createForm` из `@reformer/core` (`validate`, `validateStep`, `submission`, поток шагов), эталон — `complex-multy-step-form` (`validation/*.ts`, `flow/credit-application-flow.ts`, `application/create.ts`).

## Mental model — почему валидаторов нет в узле схемы { #mental-model }

Одна ключевая мысль: **узел схемы несёт только layout, а не правила валидации.**

- `RenderNode<T>` — union из четырёх узлов (см. [types.ts](../../src/core/types.ts)): поле (`{ selector?, model, component, componentProps? }`), массив (`{ model, item, component?, componentProps? }`), подформа (`{ model, part }`), контейнер (`{ component, children?, componentProps? }`). Поля `validators` нет **ни в одном** из них. Впишете `validators: []` в лист — TypeScript отклонит: `TS2353: 'validators' does not exist in type 'RenderNode<T>'`.
- Рендерер подсвечивает замечания, но **сам значения не валидирует** — он лишь отображает то, что прогон правил поставил в ноды (`issues`).
- Значит, валидацию значений выражают **отдельной функцией-схемой над МОДЕЛЬЮ** (`ValidationDefinition<T>`), а не в дереве. Правила уходят в сборку `createForm` полями `validation` и `flow.steps[].rules`; запускает их уровень формы (`bundle.validate()`, `bundle.validateStep(id)`, `bundle.submission.submit(handler)`, `flow.next()`). Одна валидация на все варианты рендера (React / JSON / рукописный JSX): layout и правила разъезжаются по разным каналам.
- Правило несёт **код** замечания, а не текст: `required({ code: 'loanAmount.required' })`. Строку по коду даёт словарь формы (`defineIssueMessages`) через `ValidationMessagesProvider messages`.

Дальше — три шага: (1) правила над моделью, (2) подключить их к сборке, (3) тексты замечаний.

## Шаг 1 — правила над моделью { #build-schema }

Схема валидации — обычная функция над (под)моделью, обёрнутая `defineValidation<T>(({ model, cross }) => { … })`. Внутри — **операторы** из `@reformer/core/validation`: `validate(handle, [rules])` (синхронные правила поля, **массив**), `validateAsync(handle, [asyncRules])` (async-правила), `validateWhen(() => cond, () => …)` (условные ветки), `applyEach(model.$.items, rowRules)` (правила строк массива), `apply(...schemas)` (композиция) — и `cross(handle, (snapshot) => issue | null)` из аргумента схемы (правило над несколькими полями по снимку модели). `handle` — ручка модели (`model.$.path`), **не** узел схемы. Фабрики правил — из `@reformer/core/validators`; их опции — `{ code?, params? }`, текста (`message`) у правила нет.

```typescript
import { defineValidation, validate, validateWhen } from '@reformer/core/validation';
import { required, min, max, minLength, email } from '@reformer/core/validators';
import type { CreditForm } from './types';

// Правила шага — стабильные константы модуля.
export const loanRules = defineValidation<CreditForm>(({ model, cross }) => {
  validate(model.$.loanType, [required({ code: 'loanType.required' })]);
  validate(model.$.loanAmount, [
    required({ code: 'loanAmount.required' }),
    min(50000, { code: 'loanAmount.min' }),
    max(10000000),
  ]);
  // Условная ветка + правило над несколькими полями: активна только для ипотеки.
  validateWhen(
    () => model.loanType === 'mortgage',
    () =>
      cross(model.$.loanAmount, (form) =>
        form.loanAmount > form.propertyValue - form.initialPayment ? { code: 'loanTooBig' } : null
      )
  );
});

export const applicantRules = defineValidation<CreditForm>(({ model }) => {
  validate(model.$.personalData.firstName, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
});
```

Без `code` у правила код по умолчанию — имя правила (`required`, `minLength`, …): его текст даёт словарь локали. Полное описание операторов — `@reformer/core` [13-multi-step.md](../../../reformer/docs/llms/13-multi-step.md) (не дублируем здесь).

## Шаг 2 — подключить к сборке { #execute }

Правила шагов уходят в **поток** сборки, правила вне шагов — в `validation`:

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';

const bundle = useFormBundle(() =>
  createForm<CreditForm>({
    model: createCreditModel(),
    schema: creditSchema,
    behavior: creditBehavior,
    // Правила вне шагов — проверяются только целиком (отправка). Либо голая схема: validation: rules.
    validation: { extras: crossStepRules },
    // id шага = selector узла шага в схеме; `rules` — правила шага (без поля — шаг без правил).
    flow: { steps: [{ id: 'loan', rules: loanRules }, { id: 'applicant', rules: applicantRules }, { id: 'confirm' }] },
  })
);
```

Полный набор правил — `validation.rules`, а без него сборка собирает его сама: правила всех шагов плюс `extras`. Дальше всё делает уровень формы:

| Вызов | Что делает | Результат |
|---|---|---|
| `bundle.validate()` | один прогон всех правил, замечания — в ноды | `ValidationResult` (`status: 'valid' \| 'invalid' \| 'cancelled' \| 'error'`, `issues`, `failures`) |
| `bundle.validateStep('loan')` | правила шага, проверенные поля помечаются `touched` | `ValidationResult`; неизвестный шаг — исключение |
| `bundle.flow?.next()` | правила текущего шага; при успехе — переход | `FlowTransition`: `moved` либо `stayed` с причиной |
| `bundle.submission.submit(handler)` | один прогон всех правил; при успехе — `handler(значения)`; при `invalid` / `error` тронутой помечается вся форма | `SubmitResult`: `submitted` / `invalid` / `error` / `cancelled` / `failed` |

Визард сам зовёт `flow.next()` на «Далее» и `bundle.submission.submit` на «Отправить» — проверять руками в обработчиках не нужно. Отправка снаружи визарда:

```tsx
const outcome = await bundle.submission.submit(sendApplication); // значения = model.get()
if (outcome.status === 'invalid') showHint('Проверьте форму'); // вся форма уже помечена touched
```

**Живая проверка.** По умолчанию правила запускаются только явно (отправка, «Далее»). Когда запускать их ещё — поле `strategy` в `validation`: `'blur'`, `'change'` (+ `debounce`), `'afterFirstSubmit'` (+ `liveAfterSubmit: 'change' | 'blur'`). Подписки стратегии армирует `useFormBundle` в эффекте (SSR-safe): `validation: { extras: crossStepRules, strategy: 'afterFirstSubmit' }`. Живую фазу `'afterFirstSubmit'` включает только попытка отправки — `bundle.submission.submit` (и кнопка «Отправить» визарда); `bundle.validate()`, `validateStep` и «Далее» (`flow.next()`) её не включают.

### Мост «поведение инициирует валидацию» { #revalidate-bridge }

Если по изменению зависимого поля нужно перепрогнать правила (не дожидаясь отправки или перехода шага), мост — оператор `revalidateWhen` из слоя поведения, который зовёт раннер `validateModel`:

```typescript
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { validateModel } from '@reformer/core/validation';

const behavior = defineFormBehavior<CreditForm>(({ model }) => {
  revalidateWhen([model.$.password], () => void validateModel(model, applicantRules));
});
```

Схема — та же стабильная `const`-ссылка, что ушла в поток. См. `@reformer/core` [27-revalidate-when.md](../../../reformer/docs/llms/27-revalidate-when.md).

## Шаг 3 — тексты замечаний { #messages }

Замечание (`ValidationIssue`) — `{ code, params?, severity? }`, текста в нём нет. Строки — словарь формы:

```typescript
// validation/messages.ts
import { defineIssueMessages } from '@reformer/core/i18n';

export const creditMessages = defineIssueMessages({
  'loanType.required': 'Выберите тип кредита',
  'loanAmount.required': 'Укажите сумму кредита',
  'loanAmount.min': 'Минимум {min} ₽',
  loanTooBig: 'Сумма кредита больше стоимости за вычетом взноса',
});
```

```tsx
import { ValidationMessagesProvider } from '@reformer/cdk';

<ValidationMessagesProvider messages={creditMessages}>
  <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />
</ValidationMessagesProvider>;
```

Порядок поиска текста: словарь формы → словарь локали (`I18nProvider`) → встроенный английский → сам `code`. Шаблон подставляет `params` правила (`{min}`, `{minLength}`).

## Полный рабочий пример { #full-example }

Зеркалит эталон `complex-multy-step-form`: правила — `ValidationDefinition` над моделью, общие для всех вариантов рендера; шаги схемы и правила шагов связаны идентификатором (`selector` узла = `id` шага потока).

```typescript
// form.validation.ts — правила над МОДЕЛЬЮ (общие для React/JSON/рукописного варианта)
import { defineValidation, validate } from '@reformer/core/validation';
import type { FormValidation } from '@reformer/core';
import { required, min, minLength, email } from '@reformer/core/validators';
import type { CreditForm } from './types';

export const loanRules = defineValidation<CreditForm>(({ model }) => {
  validate(model.$.loanType, [required({ code: 'loanType.required' })]);
  validate(model.$.loanAmount, [required(), min(50000, { code: 'loanAmount.min' })]);
});

export const applicantRules = defineValidation<CreditForm>(({ model }) => {
  validate(model.$.personalData.firstName, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
});

// Правила вне шагов: проверяются только при отправке.
export const creditValidation: FormValidation<CreditForm> = { extras: crossStepRules };
```

```tsx
// form.schema.ts — layout БЕЗ validators; шаги — дети визарда
import type { FormModel } from '@reformer/core';
import type { RenderNode } from '@reformer/renderer-react';
import { Step } from '@reformer/cdk/form-wizard';
import { FormWizard, Input, InputNumber } from '@reformer/ui-kit';
import type { CreditForm } from './types';

export const creditSchema = (model: FormModel<CreditForm>): RenderNode<CreditForm> => ({
  selector: 'wizard',
  component: FormWizard,
  children: [
    {
      selector: 'loan', // = id шага в потоке
      component: Step,
      componentProps: { title: 'Кредит', icon: '💰' },
      children: [
        // лист несёт только model/component/componentProps — без validators
        { model: model.$.loanAmount, component: InputNumber, componentProps: { label: 'Сумма' } },
      ],
    },
    {
      selector: 'applicant',
      component: Step,
      componentProps: { title: 'Заявитель', icon: '👤' },
      children: [{ model: model.$.email, component: Input, componentProps: { label: 'Email' } }],
    },
  ],
});
```

```tsx
// index.tsx — сборка, поток шагов и тексты
const bundle = useFormBundle(() =>
  createForm<CreditForm>({
    model: createCreditModel(),
    schema: creditSchema,
    behavior: creditBehavior,
    validation: creditValidation,
    flow: { steps: [{ id: 'loan', rules: loanRules }, { id: 'applicant', rules: applicantRules }] },
  })
);

return (
  <ValidationMessagesProvider messages={creditMessages}>
    <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />
  </ValidationMessagesProvider>
);
```

Отправка и навигация между шагами приходят из поведения формы (`onComponentEvent(schema.node('wizard'), 'onSubmit', …)`, `flow.goTo(id)`) — см. [07-form-wizard.md](07-form-wizard.md).

## Anti-patterns

- **Вписывать `validators` в лист схемы** (`{ model: model.$.x, component: Input, validators: [...] }`) — главная ловушка. У узла поля нет `validators` (как и у массива, подформы и контейнера). TypeScript даёт `TS2353`. Валидация значений живёт в отдельной `ValidationDefinition` над моделью (Шаг 1).
- **Текст в правиле** — `required({ message: '…' })` больше нет: у `RuleOptions` только `{ code?, params? }`. Текст — словарь `defineIssueMessages` + `ValidationMessagesProvider messages`.
- **`validation: { steps: { loan: rules } }`, `defineSteps`, `config` визарда** — прежний контракт, удалён. Правила шагов — `flow: { steps: [{ id: 'loan', rules }] }`; визард берёт поток из сборки.
- **Правила шагов по индексу** (`STEP_SCHEMAS[step - 1]`) — перестановка шагов молча рассинхронизирует правила. Шаг потока адресуется `id`, равным `selector` узла шага; расхождение ловят сборка и визард (dev-предупреждения).
- **Ждать, что рендерер сам провалидирует значения** — `FormRenderer` только отображает замечания, уже поставленные в ноды. Прогон — `bundle.validate()` / `validateStep` / `submission.submit` / `flow.next()` либо живая стратегия.
- **Передавать в `validate` значение вместо ручки** — оператор это `validate(model.$.path, [rules])`, где `model.$.path` — ручка (стабильная ссылка на поле модели), а не текущее значение. Значения читает раннер в момент прогона; правило над несколькими полями берёт снимок через `cross(handle, fn)`.
- **Пересоздавать схему на каждый прогон** (`validateModel(model, defineValidation(...))` инлайн или новый объект правил в каждом рендере) — отмена устаревших прогонов ключится по паре «модель + правила». Держите схемы стабильными module-level `const`.

## See also

- [02-render-schema.md](02-render-schema.md) — узлы схемы: лист несёт только layout.
- [07-form-wizard.md](07-form-wizard.md) — визард: поток шагов, «Далее», отправка.
- [03-render-behavior.md](03-render-behavior.md) — `onComponentEvent`, `renderEffect`, `flow.goTo`.
- `@reformer/core` [13-multi-step.md](../../../reformer/docs/llms/13-multi-step.md) — операторы `ValidationDefinition` и поток шагов.
- `@reformer/core` [34-i18n.md](../../../reformer/docs/llms/34-i18n.md) — словарь замечаний и локали.
- `@reformer/renderer-json` [06-validation.md](../../../reformer-renderer-json/docs/llms/06-validation.md) — та же модель-валидация для JSON-схемы.

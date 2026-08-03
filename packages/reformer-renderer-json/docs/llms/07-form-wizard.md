# FormWizard

End-to-end многошаговая форма (wizard) в `@reformer/renderer-json` (M1): **layout шагов** живёт в JSON-схеме, а **submit + навигация + условная видимость + инъекция валидации** — в `renderBehavior` (TS-функция `RenderBehaviorFn<T>`). JSON статичен и не выражает рантайм (`FormProxy`, колбэки, эффекты), поэтому wizard собирается из двух половин. Всё сверено с golden-эталоном `complex-multy-step-form-renderer-json` (`json-schema.json`, `render-behavior.ts`) и его shared-поведением из `complex-multy-step-form-renderer/render-behavior.ts`.

## Половина 1 — layout шагов в JSON { #json-shape }

Wizard — обычная container-нода со `selector: 'wizard'` (чтобы адресоваться через `schema.node('wizard')`). Шаги лежат в **`componentProps.steps`** — массив container-нод, а **не** в top-level `children`. Каждый шаг — нода `$component(Step)` с `componentProps: { title, icon }` и собственным `children` (поддерево layout шага).

```json
{
  "selector": "wizard",
  "component": "$component(Wizard)",
  "componentProps": {
    "className": "bg-white p-8 rounded-lg shadow-md",
    "steps": [
      {
        "component": "$component(Step)",
        "componentProps": { "title": "Кредит", "icon": "💰" },
        "children": [
          {
            "selector": "mortgage-section",
            "component": "$component(Section)",
            "componentProps": { "title": "Ипотека" },
            "children": [
              { "value": "$model(loanAmount)", "component": "$component(Input)",
                "componentProps": { "label": "Сумма кредита (₽)", "type": "number" } }
            ]
          }
        ]
      },
      {
        "component": "$component(Step)",
        "componentProps": { "title": "Заявитель", "icon": "🧑" },
        "children": [
          { "value": "$model(personalData.firstName)", "component": "$component(Input)",
            "componentProps": { "label": "Имя" } }
        ]
      }
    ]
  }
}
```

Ground truth: golden `complex-multy-step-form-renderer-json/json-schema.json` (wizard-нода — `selector: 'wizard'`, `steps` внутри `componentProps`, каждый шаг — `$component(Step)` + `componentProps.title/icon` + `children`).

> Отличие от `@reformer/renderer-react`: там шаг — объект `{ number, title, icon, body }`, где `body` — самостоятельный `RenderNode` (см. renderer-react [01-overview.md](../../../reformer-renderer-react/docs/llms/01-overview.md#multi-step-forms)). В JSON-DSL нельзя вписать `RenderNode` как значение пропа, поэтому шаг выражается **container-нодой** `Step` + `children`, а wizard-компонент адаптирует эту форму под `step.body`.

## Регистрируй свой wizard-компонент в реестре { #register }

`$component(Wizard)` — это **запись в реестре**, а не библиотечный экспорт: имя резолвится через registry (`reg.component('Wizard', <твой компонент>)`). Имя произвольное — важно лишь совпадение строки в JSON и ключа в реестре.

Канонический shipped-компонент — `FormWizard` из `@reformer/ui-kit/form-wizard` (см. renderer-react [01-overview.md](../../../reformer-renderer-react/docs/llms/01-overview.md#multi-step-forms)). Он принимает `componentProps.form`, `componentProps.steps` и `FormWizardConfig` (`validateStep`/`validateAll`), а `step.body` полиморфен (`FC | ReactNode | RenderNode<T>`). Твой зарегистрированный компонент должен быть совместим с этим контрактом.

```typescript
import { defineRegistry } from '@reformer/renderer-json';
import { Step } from '@reformer/cdk/form-wizard';
import { MyWizard } from './MyWizard'; // тонкая обёртка над ui-kit FormWizard

const registry = defineRegistry((reg) => {
  reg.component('Wizard', MyWizard); // ← имя из JSON `$component(Wizard)`
  reg.component('Step', Step);       // container-нода шага
  // ...остальные компоненты (Input, Select, Section, ...)
});
```

> В golden-эталоне под `$component(Wizard)` зарегистрирован app-shim `RendererFormWizard`: он снимает `title`/`icon` c `componentProps` Step-ноды, а сам Step-узел кладёт в `step.body` ui-kit `FormWizard`. Shim — деталь приложения, **не** канон библиотеки; регистрируй под этим именем любой совместимый с `FormWizard` компонент.

## Половина 2 — поведение в одном render-behavior { #render-behavior }

Один `RenderBehaviorFn<T>` навешивает всё рантайм-поведение на wizard-ноду. Порядок: (a) инъекция `form` + валидации через `onInit`; (b) submit через `onComponentEvent`; (c) навигация через `renderEffect` + `wizardRef`; (d) условные секции через `hideWhen`. Семантику хелперов см. renderer-react [03-render-behavior.md](../../../reformer-renderer-react/docs/llms/03-render-behavior.md).

```typescript
import {
  onInit,
  onComponentEvent,
  renderEffect,
  hideWhen,
  type RenderBehaviorFn,
} from '@reformer/renderer-react';
import type { FormProxy, FormModel } from '@reformer/core';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import type { CreditForm } from './types';
import { makeValidationConfig } from './validation'; // см. 06-validation.md
import { submitCreditApplication } from './api';

export function createWizardRenderBehavior(
  form: FormProxy<CreditForm>,
  model: FormModel<CreditForm>
): RenderBehaviorFn<CreditForm> {
  return (schema) => {
    const wizard = schema.node('wizard');
    const wizardRef = wizard.getRef<FormWizardHandle<CreditForm>>();

    // (a) Инъекция рантайма: form + validateStep/validateAll в wizard-ноду до первого рендера.
    //     Валидация — TS-схема над МОДЕЛЬЮ (не JSON). Детали — 06-validation.md.
    onInit(wizard, () => {
      wizard.patchProps({ form, ...makeValidationConfig(model) });
    });

    // (b) Submit: onComponentEvent получает те же аргументы, что и оригинальный проп onSubmit.
    onComponentEvent(wizard, 'onSubmit', async (values: CreditForm) => {
      await submitCreditApplication(values);
    });

    // (c) Навигация: реактивный эффект принимает СХЕМУ (не ноду); wizardRef доступен после mount.
    renderEffect(schema, () => {
      if (form.loanType.value.value === 'mortgage') {
        wizardRef.current?.goToStep(1);
      }
    });

    // (d) Условные секции: реактивно по сигналам формы (читай сигнал целиком: `.value.value`).
    hideWhen(schema.node('mortgage-section'), () => form.loanType.value.value !== 'mortgage');
  };
}

// <JsonFormRenderer schema={jsonSchema} renderBehavior={createWizardRenderBehavior(form, model)} />
```

Ground truth: golden `complex-multy-step-form-renderer/render-behavior.ts` — `onComponentEvent(schema.node('wizard'), 'onSubmit', ...)`, `renderEffect(schema, () => wizardRef.current?.goToStep(1))`, `hideWhen(...)`; инъекция `form`+валидации — `complex-multy-step-form-renderer-json/render-behavior.ts`.

## Конфиг валидации через `defineSteps` (адресация по selector) { #define-steps }

`makeValidationConfig(model)` в примерах выше (см. [06-validation.md#execute](06-validation.md#execute)) собирает `FormWizardConfig` вручную — массивом `STEP_SCHEMAS[step - 1]`. Массив привязывает правила к **позиции**: вставил шаг в середину или переставил два — индексы поехали, и `validateStep(2)` молча валидирует уже чужой шаг; шаг без правил приходится просто «не класть» в массив, и он по умолчанию считается валидным — тихая дыра.

**Рекомендуемый способ — `defineSteps`** (из `@reformer/cdk/form-wizard`): правила адресуются по **`selector` шага** — той же строке, что стоит у ноды `$component(Step)` в JSON. Порядок ключей `steps` = порядок шагов; шаг без правил объявляется ЯВНО через `null`; хрупкую индексацию `[step - 1]` инкапсулирует сам хелпер. Внутри `validateStep`/`validateAll` уже стоит `{ touch: true }` (§6) — провалидированные поля метятся `touched`, ошибки видны без ручного `form.markAsTouched()` на поддерево, а следующий шаг не показывается тронутым.

```typescript
import { defineSteps } from '@reformer/cdk/form-wizard';
import type { FormModel } from '@reformer/core';
import type { CreditForm } from './types';
// step1/step2 — под-схемы шагов, crossFieldRules — cross-field/warnings всей формы.
// Все три — ValidationSchema<CreditForm> (см. 06-validation.md#build-schema).
import { step1, step2, crossFieldRules } from './validation';

export function makeWizardConfig(model: FormModel<CreditForm>) {
  return defineSteps<'loan' | 'applicant' | 'confirm', CreditForm>(model, {
    steps: {
      loan: step1, // валидирует шаг с `selector: 'loan'`
      applicant: step2, // → шаг `selector: 'applicant'`
      confirm: null, // шаг без правил — ОБЪЯВЛЕН явно, а не забыт
    },
    extras: crossFieldRules, // cross-field/warnings всей формы — только в validateAll (submit)
  });
}
```

Результат — обычный `FormWizardConfig`, визард потребляет его как раньше. В TS-форме отдаётся пропом `config`:

```tsx
import { FormWizard } from '@reformer/cdk/form-wizard';

<FormWizard form={form} config={makeWizardConfig(model)}>…</FormWizard>;
```

В **JSON-варианте** тот же конфиг инъектится в wizard-ноду через `patchProps` (§ [#render-behavior](#render-behavior)) — на месте ручного `makeValidationConfig`:

```typescript
onInit(wizard, () => {
  wizard.patchProps({ form, ...makeWizardConfig(model) }); // form + validateStep/validateAll
});
```

Помимо `validateStep`/`validateAll`, `defineSteps` возвращает **`stepSelectors`** — упорядоченный список селекторов (`['loan','applicant','confirm']`, индекс = `step - 1`). Он и есть маппинг `n → selector`, по которому `validateStep(n)` находит правила; полезен для отладки и селекторной навигации.

Выигрыш против массива `STEP_SCHEMAS[step - 1]`:

- **Перестановка/добавление шага не рассинхронизирует правила молча** — правила привязаны к `selector`, а не к позиции; переставил шаги — правила едут вместе с ними.
- **Шаг без правил объявляется ЯВНО** (`confirm: null`), а не «забывается» в массиве и не становится валидным по умолчанию.
- **Порядок ключей `steps` = порядок шагов** — один источник правды и для маппинга `validateStep(n)`, и для `stepSelectors`.
- **`{ touch: true }` уже внутри** — пошаговая валидация метит только провалидированные поля; ручной `markAsTouched` не нужен, следующий шаг не показывается тронутым.

Ground truth: `packages/reformer-cdk/src/components/form-wizard/define-steps.ts` (маппинг `step → selector → правила`, стабильная `fullSchema` для submit, `{ touch: true }` в обоих колбэках) и его тест `define-steps.test.ts`.

## Anti-patterns

- **Класть шаги в top-level `children` wizard-ноды** — шаги живут в `componentProps.steps`. Top-level `children` wizard-компонент не читает как шаги.
- **Ждать шаг как `{ number, title, icon, body }` в JSON** — это форма renderer-react. В JSON шаг — container-нода `$component(Step)` + `componentProps.title/icon` + `children`.
- **Считать `RendererFormWizard` библиотечным экспортом** — это app-shim эталона. Wizard-компонент подключается через реестр под любым именем; канон — ui-kit `FormWizard`.
- **Забыть `createWizardRenderBehavior` (только `onInit` с валидацией)** — форма будет валидировать, но `onSubmit`/навигация не подключатся: submit-less форма. Submit и навигация приходят из этого же behavior.
- **`renderEffect(node, ...)` вместо `renderEffect(schema, ...)`** — первый аргумент `renderEffect` это схема, а не узел (в отличие от `hideWhen`/`onComponentEvent`).
- **Забыть `selector: 'wizard'`** — без селектора `schema.node('wizard')` не адресует узел, инъекция/submit/навигация не навесятся.
- **Адресовать правила шагов массивом `STEP_SCHEMAS[step - 1]`** — привязка к позиции: вставка/перестановка шага молча разъезжается с индексами, а «забытый» шаг становится валидным по умолчанию. Собирай `FormWizardConfig` через `defineSteps` (адресация по `selector`, шаг без правил — явный `null`, `{ touch: true }` уже внутри) — см. [#define-steps](#define-steps).

## See also

- [06-validation.md](06-validation.md) — `makeValidationConfig` (TS-схема над моделью), инъекция `validateStep`/`validateAll` в wizard.
- [#define-steps](#define-steps) — `defineSteps` из `@reformer/cdk/form-wizard`: сборка `FormWizardConfig` из правил, адресованных по `selector` шага (рекомендуемая альтернатива массиву `STEP_SCHEMAS[step - 1]`).
- [05-cookbook.md#inject-runtime](05-cookbook.md#inject-runtime) — общий приём инъекции runtime-сущностей (`form`) через `onInit`/`patchProps`.
- renderer-react [03-render-behavior.md](../../../reformer-renderer-react/docs/llms/03-render-behavior.md) — семантика `hideWhen`/`renderEffect`/`onComponentEvent`/`onInit`.
- renderer-react [01-overview.md](../../../reformer-renderer-react/docs/llms/01-overview.md#multi-step-forms) — канонический `FormWizard`, форма шага `{ number, title, icon, body }`.

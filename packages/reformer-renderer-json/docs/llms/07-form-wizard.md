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

## Anti-patterns

- **Класть шаги в top-level `children` wizard-ноды** — шаги живут в `componentProps.steps`. Top-level `children` wizard-компонент не читает как шаги.
- **Ждать шаг как `{ number, title, icon, body }` в JSON** — это форма renderer-react. В JSON шаг — container-нода `$component(Step)` + `componentProps.title/icon` + `children`.
- **Считать `RendererFormWizard` библиотечным экспортом** — это app-shim эталона. Wizard-компонент подключается через реестр под любым именем; канон — ui-kit `FormWizard`.
- **Забыть `createWizardRenderBehavior` (только `onInit` с валидацией)** — форма будет валидировать, но `onSubmit`/навигация не подключатся: submit-less форма. Submit и навигация приходят из этого же behavior.
- **`renderEffect(node, ...)` вместо `renderEffect(schema, ...)`** — первый аргумент `renderEffect` это схема, а не узел (в отличие от `hideWhen`/`onComponentEvent`).
- **Забыть `selector: 'wizard'`** — без селектора `schema.node('wizard')` не адресует узел, инъекция/submit/навигация не навесятся.

## See also

- [06-validation.md](06-validation.md) — `makeValidationConfig` (TS-схема над моделью), инъекция `validateStep`/`validateAll` в wizard.
- [05-cookbook.md#inject-runtime](05-cookbook.md#inject-runtime) — общий приём инъекции runtime-сущностей (`form`) через `onInit`/`patchProps`.
- renderer-react [03-render-behavior.md](../../../reformer-renderer-react/docs/llms/03-render-behavior.md) — семантика `hideWhen`/`renderEffect`/`onComponentEvent`/`onInit`.
- renderer-react [01-overview.md](../../../reformer-renderer-react/docs/llms/01-overview.md#multi-step-forms) — канонический `FormWizard`, форма шага `{ number, title, icon, body }`.

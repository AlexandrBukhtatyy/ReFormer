# FormWizard

End-to-end многошаговая форма (wizard) в `@reformer/renderer-json`: **layout шагов** живёт в JSON-документе формата 2, **правила шагов** — в потоке сборки `createForm({ flow })`, а **отправка, навигация и условная видимость** — в поведении формы (`defineFormBehavior`). Форму, поток шагов и отправку визард берёт из сборки сам: документ остаётся чистыми данными, инъектировать в узел ничего не нужно. Всё сверено с эталоном `complex-multy-step-form-renderer-json` (документ `form.schema.json`, реестр `registry.ts`) и общей связкой узлов `complex-multy-step-form/application/renderer.ts`.

> **Имена файлов.** Канон раскладки — `@reformer/mcp` [06-form-directory-layout.md](../../../reformer-mcp/docs/llms/06-form-directory-layout.md) §1, он же `find_recipe directory-layout`: схема — `form.schema.ts` (`.tsx` — если в ней есть JSX, `.json` — вариант «схема как данные»), `registry.ts`, `form.behavior.ts`, `form.validation.ts`. Шаги визарда — инлайном или по папке на шаг `steps/<slug>/` с агрегатором `steps/index.ts`. Каталоги `complex-multy-step-form-*` — эталон содержимого, а не нейминга.

## Половина 1 — layout шагов в JSON { #json-shape }

Визард — обычный узел-контейнер со `selector: 'wizard'` (чтобы адресоваться через `schema.node('wizard')`). Шаги — его **`children`**: каждый шаг — узел `$component(Step)` со `selector` (идентификатор шага в потоке), `componentProps: { title, icon }` и собственными `children`.

```json
{
  "selector": "wizard",
  "component": "$component(FormWizard)",
  "componentProps": {
    "className": "bg-white p-8 rounded-lg shadow-md",
    "submitLabel": "Отправить заявку"
  },
  "children": [
    {
      "selector": "loan",
      "component": "$component(Step)",
      "componentProps": { "title": "Кредит", "icon": "💰" },
      "children": [
        {
          "selector": "mortgage-section",
          "component": "$component(Section)",
          "componentProps": { "title": "Ипотека" },
          "children": [
            { "model": "$model(loanAmount)", "component": "$component(InputNumber)",
              "componentProps": { "label": "Сумма кредита (₽)" } }
          ]
        }
      ]
    },
    {
      "selector": "applicant",
      "component": "$component(Step)",
      "componentProps": { "title": "Заявитель", "icon": "🧑" },
      "children": [
        { "model": "$model(personalData.firstName)", "component": "$component(Input)",
          "componentProps": { "label": "Имя" } }
      ]
    }
  ]
}
```

Визард рисует шаги **в порядке потока** и связывает их с узлами по `selector`. Тот же визард рисует и TS-схему `@reformer/renderer-react` — шаг там тоже узел `Step` с детьми (см. renderer-react [07-form-wizard.md](../../../reformer-renderer-react/docs/llms/07-form-wizard.md)).

### Шаги в отдельных файлах: `$ref` + `composeJsonFormSchema` { #split-steps }

Документ большого визарда можно разрезать по шагам. Корень держит в `children` визарда **ссылки**, каждый шаг — свой файл `steps/<slug>/form.schema.json` с ключом **`node`** (не `root`: файл шага — не самостоятельная форма). Мета-схема файла шага — `buildFormStepMetaSchema(opts)` (или `toFormStepMetaSchema(buildFormSchemaMetaSchema(opts))`).

```json
// form.schema.json
{ "format": 2,
  "root": { "selector": "wizard", "component": "$component(FormWizard)",
    "children": [
      { "$ref": "./steps/kredit/form.schema.json" },
      { "$ref": "./steps/zayavitel/form.schema.json" } ] } }

// steps/kredit/form.schema.json
{ "$schema": "../../form-step.schema.json",
  "node": { "selector": "loan", "component": "$component(Step)",
            "componentProps": { "title": "Кредит" }, "children": [] } }
```

Конвертер ссылок **не понимает** — собери документ до `createForm`. Агрегатор `steps/index.ts` экспортирует файлы шагов по той же ссылке, что в корне:

```ts
import { composeJsonFormSchema, type JsonFormSchema, type JsonFormStep } from '@reformer/renderer-json';
import rawSchema from './form.schema.json';
import kredit from './steps/kredit/form.schema.json';

const stepSchemas: Record<string, JsonFormStep> = {
  './steps/kredit/form.schema.json': kredit as unknown as JsonFormStep,
};
const schema = composeJsonFormSchema(rawSchema as unknown as JsonFormSchema, stepSchemas);
```

- Ссылка — объект ровно с одним ключом `$ref` (`isJsonStepRef`); `./` в начале не различает ключи (`normalizeStepRef`). Инлайн-шаги рядом со ссылками допустимы.
- Нет файла для ссылки — `composeJsonFormSchema` бросает ошибку с путём ссылки.
- Несобранная схема не собирается: конвертер бросает `Step reference "…" is not resolved`, `validateFormSchema` сообщает `step reference "…" is not resolved`.
- Билдер открывает такую форму как одну и сам раскладывает правки по файлам шагов.

## Реестр: визард и шаг { #register }

`$component(FormWizard)` и `$component(Step)` — **записи в реестре**: имя резолвится через registry. Обёртка над библиотечным визардом не нужна — регистрируй его как есть:

```typescript
import { defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
import { Step } from '@reformer/cdk/form-wizard';
import { FormField, FormWizard, Input, InputNumber, Section } from '@reformer/ui-kit';

export const registry = defineRegistry((reg) => {
  reg.component('FormWizard', FormWizard); // ← имя из JSON `$component(FormWizard)`
  reg.component('Step', Step); // узел шага: рисует детей, title/icon читает индикатор
  reg.component('Section', Section);
  reg.component('Input', Input);
  reg.component('InputNumber', InputNumber);
  reg.component(FIELD_WRAPPER, FormField);
});
```

Имя записи произвольное — важно лишь совпадение строки в JSON и ключа в реестре. `FormWizard` объявляет `__selfManagedChildren`: рендерер передаёт ему узлы шагов данными и функцию их отрисовки.

## Половина 2 — правила шагов и поведение { #render-behavior }

Правила шагов — поток сборки; отправка, навигация и видимость — одно поведение формы. Семантику операторов см. renderer-react [03-render-behavior.md](../../../reformer-renderer-react/docs/llms/03-render-behavior.md).

```typescript
// form.behavior.ts
import { defineFormBehavior, hideWhen, onComponentEvent, renderEffect } from '@reformer/core/behaviors';
import type { CreditForm } from './types';
import { submitCreditApplication } from './api';

export const creditBehavior = defineFormBehavior<CreditForm>(({ model, schema, flow }) => {
  const wizard = schema.node('wizard');

  // (a) Отправка: кнопка «Отправить» визарда зовёт обработчик через `bundle.submit` — только
  //     после успешной проверки всей формы; при замечаниях поля помечаются touched.
  onComponentEvent(wizard, 'onSubmit', async (values: CreditForm) => {
    await submitCreditApplication(values);
  });

  // (b) Навигация — методами потока шагов: id шага = selector узла `$component(Step)`.
  renderEffect(schema, () => {
    if (model.loanType === 'mortgage') flow?.goTo('loan');
  });

  // (c) Условные секции — реактивно по значениям модели.
  hideWhen(schema.node('mortgage-section'), () => model.loanType !== 'mortgage');
});
```

```tsx
// index.tsx
const bundle = useFormBundle(() =>
  createForm<CreditForm>({
    model: createCreditModel(),
    schema, // документ формата 2
    registry,
    behavior: creditBehavior,
    validation: { extras: crossStepRules }, // проверяются только при отправке
    flow: {
      steps: [
        { id: 'loan', rules: loanRules },
        { id: 'applicant', rules: applicantRules },
        { id: 'confirm' }, // шаг без правил — объявлен явно
      ],
    },
  })
);
return <FormRenderer form={bundle} />;
```

Сверено с эталоном: `application/renderer.ts` — `onComponentEvent(schema.node('wizard'), 'onSubmit', …)`, `renderEffect(schema, () => { if (isMortgage(model.loanType)) flow?.goTo('loan'); })`; `flow/credit-application-flow.ts` — поток `{ steps: flow.map((step) => ({ id: step.selector, rules: step.rules })) }`.

## Поток шагов { #flow }

- Кнопка «Далее» — `flow.next()`: правила текущего шага; при замечаниях поток остаётся на шаге (`{ status: 'stayed', reason: 'invalid' }`), а поля помечаются `touched`.
- Переход по индикатору — `flow.goTo(id)`: первый шаг доступен всегда, остальные — после прохождения предыдущего (`reason: 'locked'`). «Назад» — `flow.previous()`.
- Порядок шагов потока = порядок шагов визарда. Шаг без `rules` проходится без проверки — объявляй его явно (`{ id: 'confirm' }`), а не «забывай».
- Расхождение `flow.steps[].id` и селекторов узлов шагов — dev-предупреждения сборки и визарда; реестр форм ловит его preflight-проверкой `unknown-step-selectors`.
- Снаружи дерева: `useFormFlow(bundle.flow!)` из `@reformer/core/react` — снимок (`current`, `index`, `isLast`, `validating`); `bundle.flow?.goTo('loan')`; `bundle.submit(handler)`.

## Прежний формат документа { #v1 }

В прежнем формате шаги лежали в `componentProps.steps` визарда, а визард подключался через прикладной шим. `migrateJsonSchema(document)` переносит шаги в `children` (визард узнаётся по имени — `DEFAULT_STEP_HOSTS`: `Wizard`, `RendererFormWizard`, `FormWizard`; свои имена — `{ stepHosts }`) и ставит `format: 2`. Имя компонента функция не меняет: на что оно указывает, решает реестр — зарегистрируй под ним `FormWizard` из `@reformer/ui-kit`.

## Anti-patterns

- **Класть шаги в `componentProps.steps`** — прежний формат. В формате 2 шаги — `children` визарда; `migrateJsonSchema` переносит их сам.
- **Инъекция `form` / `validateStep` / `validateAll` в узел визарда через `onInit` + `patchProps`, `defineSteps`** — прежний контракт, удалён. Визард берёт форму, поток и отправку из сборки; правила шагов — `flow.steps[].rules`.
- **Навигация через ref визарда** (`getRef<FormWizardHandle>()`, `goToStep(n)`) — удалено. Переход — `flow.goTo(id)` из поведения либо `bundle.flow?.goTo(id)` снаружи.
- **Писать прикладной шим над визардом** — не нужен: `reg.component('FormWizard', FormWizard)` из `@reformer/ui-kit` напрямую.
- **`selector` шага не совпадает с `id` шага потока** — визард не свяжет шаг с разметкой (dev-предупреждения сборки и визарда).
- **`renderEffect(node, ...)` вместо `renderEffect(schema, ...)`** — первый аргумент `renderEffect` это область схемы, а не узел (в отличие от `hideWhen`/`onComponentEvent`).
- **Забыть `selector: 'wizard'`** — без селектора `schema.node('wizard')` не адресует узел, обработчик отправки не навесится (сборка в dev предупредит о неизвестном селекторе).
- **Проверять форму руками в обработчике отправки** — не нужно: обработчик вызывается через `bundle.submit` только после успешной проверки, `values` — значения формы.

## See also

- [06-validation.md](06-validation.md) — правила над моделью, поток шагов, тексты замечаний.
- [10-format-2.md](10-format-2.md) — документ формата 2, сборка `createForm`, перевод прежнего формата.
- renderer-react [03-render-behavior.md](../../../reformer-renderer-react/docs/llms/03-render-behavior.md) — семантика `hideWhen`/`renderEffect`/`onComponentEvent`/`onInit`.
- renderer-react [07-form-wizard.md](../../../reformer-renderer-react/docs/llms/07-form-wizard.md) — тот же визард в TS-схеме.

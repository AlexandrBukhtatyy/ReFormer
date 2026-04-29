# dev-plan: mcp-credit-application-renderer-json-v9

## Цель

Реализовать форму "Заявка на кредит" (`docs/specs/credit-application-form.md`) на стеке `@reformer/*` с target=**renderer-json** для регрессии iter-9 MCP-сервера.

## Architecture choices

### Pair (A, B) = (A1, ui-kit FormWizard internal switching)

- **A1 — ui-kit FormWizard**. Без архитектурных конфликтов:
  - ui-kit `FormWizard` (`@reformer/ui-kit/form-wizard`) — высокоуровневая обёртка поверх headless `@reformer/cdk/form-wizard`. Поддерживает полиморфный `step.body`: `ComponentType<{ control }>` | `ReactNode` | `RenderNode<T>`.
  - В JSON-схеме каждый step body — это RenderNode (объект `{ component, children, componentProps }`), который `createRenderSchemaFromJson` конвертирует, а `FormWizard` детектит и оборачивает в `<RenderNodeComponent form={form} />`.
  - Маркер `__selfManagedChildren = true` гарантирует, что родительский renderer пробросит `form` без рекурсии.
  - Form + config + onSubmit инжектятся в wizard через `onInit` + `schema.node('wizard').patchProps({ form, config, onSubmit })`.
- **B — ui-kit FormWizard internal switching**. Wizard сам управляет переключением шагов через headless context (`FormWizardContext`); JSON-renderer не знает про шаги — просто рендерит wizard со steps в componentProps.
- A4 (manual useState) НЕ требуется — никакого архитектурного конфликта между ui-kit FormWizard и renderer-json: оба flow поддерживаются через self-managed children + полиморфный body.

### Walk-up иерархии (per add-wizard.md)

1. **App-specific компонент** (вариант: `RendererFormWizard` из react-playground/src/components) — есть в проекте, но это TS-renderer-react variant. В renderer-json его НЕ требуется — мы используем напрямую ui-kit обёртку.
2. **ui-kit FormWizard** (`@reformer/ui-kit/form-wizard`) — выбран (A1). Унифицированный wrapper, работает в renderer-json через `__selfManagedChildren` + полиморфный body.
3. **headless cdk FormWizard** (`@reformer/cdk/form-wizard`) — обёрнут внутри ui-kit. Не используется напрямую.
4. **manual useState** (A4) — не требуется.

Решение: A1.

## Patches under test

| Patch | Что проверяется | Где в коде |
|---|---|---|
| **G + Path C** | ui-kit FormWizard в JSON | `render-schema.ts` — `wizard` node + `registry.tsx` — `reg.container('FormWizard', FormWizard)` |
| **H** | camelCase componentProps | `render-schema.ts` — `maxLength`, `readOnly` (а не `maxlength`/`readonly`) |
| **I** | computeFrom group-node без `as never` | `schema.ts` — `creditApplicationBehavior` через `computeFrom([path.X], path.Y, fn)` |
| **K (NEW iter-9)** | JSON `model` для field-types, `selector` для orchestration | `render-schema.ts` — все Input/Select/Checkbox/RadioGroup/Textarea имеют `model:`, никогда `selector:` |
| **F-1** | RenderSchemaFn-wrapper для form-injection | `index.tsx` — wrap `createRenderSchemaFromJson` → patch root.componentProps with `form` |
| **D1, D3** | `createForm({ form, behavior, validation })`, `reg.source(...)` для JSON | `schema.ts` + `registry.tsx` |
| **Path C update** | `FormArraySection` в registry + JSON `itemComponent: { $template }` | `registry.tsx` + `render-schema.ts` для `properties`/`existingLoans`/`coBorrowers` |

## Scope

- **In**: 6 шагов формы, все поля из спеки, behaviors (computeFrom, watch для условных полей, copy registration→residence, hide based on loanType/employmentStatus/sameAsRegistration/checkboxes), validation (required, min/max, email, custom), wizard navigation, fake-data-fill button.
- **Out**: async fetch (loadCities/loadCarModels), view-mode (mode='view'), debug API delays.

## Files

1. `dev-plan.md` — this file.
2. `types.ts` — `CreditApplicationForm` interface + nested types.
3. `schema.ts` — `createCreditApplicationForm` + form schema + behavior + validation.
4. `registry.tsx` — `defineRegistry` с ui-kit + FormArraySection + sources.
5. `render-schema.ts` — `JsonFormSchema` с `model:` для полей, `selector:` для секций, `$template` для arrays.
6. `data-fixture.ts` — `happyPathFixture: CreditApplicationForm` для fill-button.
7. `index.tsx` — main component, wraps `createRenderSchemaFromJson` для form-injection, рендерит `FormRenderer`, dev-only fill-button с `data-testid="fill-fake-data"`.
8. `dev-report.md` — отчёт.

## Critical rules checklist

- [x] НЕ `extends FormFields` на union-literal leaves (LoanType, EmploymentStatus, etc.) — только typed interface.
- [x] `__selfManagedChildren = true` на FormRoot wrapper (impl-detail of converter) — handled by ui-kit FormWizard и FormArraySection (уже в ui-kit).
- [x] RenderSchemaFn-wrapper для form-injection в index.tsx.
- [x] Plain-leaf `initialValue` для FormArray — массивы в FormArraySection не нужны (templates берут value из JSON template).
- [x] В JSON для field-types: `model:`, никогда `selector:`.
- [x] camelCase в componentProps: `maxLength`, `readOnly`, `htmlFor`.
- [x] testId convention: `step1.loanAmount`, `step2.passportData.series`.
- [x] Required messages explicit, не default.
- [x] Reusable nested schemas (Address, PersonalData) для personalData и coBorrowers[].personalData.

## Wizard pair summary

**Pair = (A1, ui-kit FormWizard internal switching)**

JSON describes: `wizard` node (selector) с `componentProps.steps[]`; каждый step has body как RenderNode subtree. JSON-schema doesn't reference setHidden orchestration for steps — wizard handles step switching internally via FormWizardContext.

`hideWhen` is used ONLY for conditional sub-sections within steps:
- `mortgage-section` — only when loanType=mortgage
- `car-section` — only when loanType=car
- `residence-address-section` — only when sameAsRegistration=false
- `employer-section`, `business-section`, `income-section`, `unemployed-warning` — based on employmentStatus
- `properties-array`, `existing-loans-array`, `co-borrowers-array` — based on hasProperty/hasExistingLoans/hasCoBorrower checkbox toggles

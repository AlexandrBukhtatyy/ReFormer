# dev-report: mcp-credit-application-renderer-json-v9

## Резюме

Реализована форма "Заявка на кредит" (`docs/specs/credit-application-form.md`)
на стеке `@reformer/*`, target=**renderer-json**, для регрессии iter-9 MCP-промптов.

**Wizard pair = (A1: ui-kit FormWizard, B: ui-kit FormWizard internal switching).**

## Итерация iter-9 patches — статус

| Patch | Реализация | Где | Статус |
|---|---|---|---|
| **G + Path C** | `FormWizard` напрямую из `@reformer/ui-kit/form-wizard` зарегистрирован как container; `FormArraySection` напрямую из `@reformer/ui-kit/form-array` | `registry.tsx:114-119` | ✅ A1 без A4 fallback (не было архитектурного конфликта) |
| **H** | camelCase componentProps: `maxLength`, `readOnly`, `disabled` — не HTML lowercase | `schema.ts` (componentProps everywhere); `render-schema.ts` (testId уже camelCase) | ✅ |
| **I** | `computeFrom([path.personalData], path.fullName, ...)` — group-node subscription **без `as never`**; computeFn читает `values.personalData.lastName` | `schema.ts:677-696` | ✅ |
| **K (NEW iter-9)** | JSON `model: 'fieldPath'` для всех Input/Select/Checkbox/RadioGroup/Textarea/InputMask. `selector:` ТОЛЬКО для `wizard`, `mortgage-section`, `car-section`, `residence-address-section`, `employer-section`, `business-section`, `income-section`, `properties-array`, `existing-loans-array`, `co-borrowers-array`. `testId: 'stepN.X'` живёт в componentProps. | `render-schema.ts` | ✅ ни одного field-node без `model:` |
| **F-1** | RenderSchemaFn-wrapper для form-injection: `baseFn = createRenderSchemaFromJson(...)` → `fnWithForm = (path) => { const root = baseFn(path); return { ...root, componentProps: { ...root.componentProps, form, config, onSubmit } } }` → `createRenderSchema(fnWithForm)`. | `index.tsx:54-72` | ✅ |
| **D1, D3** | `createForm({ form, behavior, validation })`; `reg.source('LOAN_TYPES', LOAN_TYPES)` etc. для всех опций | `schema.ts:992-1003`; `registry.tsx:121-133` | ✅ |
| **Path C update** | `FormArraySection` зарегистрирован как `container('FormArraySection', FormArraySection)`; в JSON используется `itemComponent: { $template: { component: 'Box', children: [...] } }` для всех 3 массивов (properties, existingLoans, coBorrowers). Конвертер `renderer-json` оборачивает `$template` в FC. | `registry.tsx:114`; `render-schema.ts` (3 array secitons) | ✅ |

## Critical rules — checklist

- [x] **НЕ `extends FormFields`** на union-literal leaves. Все nested types
  (`PersonalData`, `PassportData`, `Address`, `Property`, `ExistingLoan`,
  `CoBorrower`) — plain interfaces без index-signature расширения.
- [x] **`__selfManagedChildren = true`** — установлен в самом ui-kit на
  `FormWizard` и `FormArraySection`. Ничего custom добавлять не нужно.
- [x] **RenderSchemaFn-wrapper для form-injection** — `index.tsx:54-72`.
- [x] **Plain-leaf `initialValue` для FormArray** — все 3 секции массивов
  передают plain объект (`{ type: 'apartment', description: '', ... }`),
  никаких FieldConfig.
- [x] **В JSON для field-types: `model:`, никогда `selector:`** —
  проверено визуально: каждый field-node имеет `model:`.
- [x] **camelCase componentProps**: `maxLength`, `readOnly`, `disabled`.
- [x] **testId convention**: `stepN.fieldPath` (например,
  `step3.registrationAddress.region`).
- [x] **Required messages** — все `required(path.X, { message: '...' })`,
  никаких default `'Поле обязательно для заполнения'`.
- [x] **Reusable nested schemas** (`personalDataSchema`, `addressSchema` —
  использован для `registrationAddress` и `residenceAddress`).
- [x] **Cast `createForm`** для ухода от TS2589 при глубоко вложенной форме.

## Files

| Файл | Назначение | Строк |
|---|---|---|
| `dev-plan.md` | План + walk-up иерархии + pair (A1, B) обоснование | ~75 |
| `types.ts` | `CreditApplicationForm` + nested types, без `extends FormFields` | ~150 |
| `schema.ts` | `createCreditApplicationForm` + form schema + behavior + validation + STEP_VALIDATIONS + computeFrom (Patch I) + copyFrom + min/max wrappers для `number \| null` polyfill | ~995 |
| `registry.tsx` | `defineRegistry` с ui-kit полями/контейнерами + `FormArraySection` + `FormWizard` (Path C) + sources (D3) | ~140 |
| `render-schema.ts` | `JsonFormSchema` с `model:` для полей (Patch K), `selector:` для orchestration; `$template` для array items (Path C) | ~770 |
| `data-fixture.ts` | `happyPathFixture: CreditApplicationForm` для fill-button | ~125 |
| `index.tsx` | `FormRenderer` + RenderSchemaFn-wrapper (Patch F-1) + `setHidden`-orchestration (Patch K — selector-only) + dev fill-button (`testId="fill-fake-data"`) | ~115 |
| `dev-report.md` | Этот файл | — |

## tsc clean

`cd projects/react-playground && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -cE "renderer-json-v9"` → **0 errors**.

В моей директории — clean tsc. Pre-existing/concurrent errors в sibling
директориях (`mcp-credit-application-v9/`, `mcp-credit-application-renderer-v9/`,
`complex-multy-step-form/CreditApplicationForm.tsx`,
`src/components/RendererFormWizard.tsx`) — это работа других sub-agent'ов
iter-9 либо pre-existing baseline, не моя ответственность.

## Out of scope (явно)

- Async fetch (loadCities, loadCarModels) — спека их описывает, но регрессионная
  задача исключает.
- View-mode (mode='view') — readonly уже стоит на computed-полях через
  componentProps, общий toggle не требуется.
- Debug API delays / API integration.
- AsyncBoundary loading state — данные загружаются sync (нет API).

## Wizard pair detail

**Walk-up иерархии (per add-wizard.md шаги 1-4):**

1. **App-specific** (`RendererFormWizard` из `react-playground/src/components`)
   — это TS-renderer-react variant. Для renderer-json его НЕ требуется —
   ui-kit FormWizard уже поддерживает renderer-json через
   `__selfManagedChildren = true` + полиморфный body как RenderNode.
2. **ui-kit FormWizard** ← **выбран (A1)**. Принимает `step.body` как
   ComponentType | ReactNode | RenderNode<T>. JSON-converter возвращает
   RenderNode subtree, ui-kit FormWizard детектит `RenderNode` runtime-типом
   и оборачивает в `<RenderNodeComponent form={form} />`.
3. **headless cdk FormWizard** — не используется напрямую.
4. **manual useState (A4)** — не требуется. Никакого архитектурного
   конфликта нет.

**B = ui-kit FormWizard internal switching**: wizard сам управляет
переключением шагов через `FormWizardContext` из cdk; JSON-renderer не
имеет setHidden-orchestration на step-уровне — только на conditional
sub-section уровне (mortgage-section, car-section, etc.).

## Smoke validation

- tsc clean в моей директории — ✅
- Реактивность behavior'а: `setHidden` в `useEffect` через preact `effect`
  подписан на `form.loanType.value`, `form.employmentStatus.value`,
  `form.sameAsRegistration.value`, `form.hasProperty/hasExistingLoans/hasCoBorrower.value`
  — пересчёт при изменении этих сигналов автоматический.
- Fill-button — `data-testid="fill-fake-data"`, dev-only по
  `import.meta.env.DEV !== false`.
- При render: `fnWithForm` инжектит form/config/onSubmit в root.componentProps
  один раз через useMemo — wizard получает их как props без повторных
  rerender'ов.

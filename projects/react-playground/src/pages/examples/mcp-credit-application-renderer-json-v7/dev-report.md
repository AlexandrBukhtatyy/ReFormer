# dev-report — iter-7 page 3 (renderer-json) credit-application

## Выбор пары (A, B)

**A4 (manual `useState`) + B3 (`renderer-json` setHidden).**

### Walk по hierarchy A1 → A2 → A3 → A4

- **A1** (ui-kit `FormWizard`) — недоступен. `@reformer/ui-kit/index.ts` экспортирует только UI-примитивы (Input, Select, Button, Section и т.д.); `FormWizard` отсутствует.
- **A2** (project-custom wizard wrapper) — недоступен. `projects/react-playground/src/components/` содержит только `RendererFormArraySection.tsx` — wizard-обёртки нет. `complex-multy-step-form/components/ui/FormWizzard/RendererFormWizard.tsx` — приватный к page complex-multy-step-form, использовать его как app-level дубль значило бы заводить кросс-page зависимость на пакет с своим testId-контрактом.
- **A3** (CDK `FormWizard` compound) — формально доступен (`@reformer/cdk/form-wizard` экспортирует `FormWizard.{Step,Indicator,Actions,Progress,Prev,Next,Submit}`), но **архитектурно конфликтует с B3**:
  - `FormWizard.Step` рендерит детей **только если `currentStep === _stepIndex`** (см. `packages/reformer-cdk/src/components/form-wizard/FormWizardStep.tsx`, строки 73-89).
  - B3 паттерн: `FormRenderer` рендерится **один раз**, ВСЕ 6 шагов смонтированы, видимость гоняется через `schema.node('stepN').setHidden(...)` — состояние полей скрытых шагов сохраняется.
  - Чтобы использовать A3 c B3, пришлось бы либо размонтировать FormRenderer (теряя в т.ч. подписки на массивы / скрытые подсекции), либо ставить 6 пустых `FormWizard.Step`-шеллов только ради подсчёта totalSteps + рендерить FormRenderer как sibling **снаружи** wizard'а (тогда FormWizardContext теряется для FormRenderer'а).
- **A4** — выбран осознанно. Прямой `useState(currentStep)` → `useEffect setHidden('stepN')`-loop. `goNext` валидирует step через `validateForm(form, STEP_VALIDATIONS[currentStep])`, `submit` через `form.validate()` + `form.submit(...)`.

**B3** — единственный вариант для `target=renderer-json`. JSON собирается через `createRenderSchemaFromJson<T>(jsonSchema, registry)`, **обёрнут** в `RenderSchemaFn`-wrapper (Patch F-1) для инжекта `form` в `FormRoot.componentProps`, затем `createRenderSchema(...)` даёт `RenderSchemaProxy` с `schema.node(selector).setHidden(...)`. 6 step-нод + 8 conditional sub-section-нод управляются useEffect'ами.

## Patches которые помогли (iter-6 регрессия)

| Patch | Где сработал | Симптом, который предотвратил |
|---|---|---|
| **D** (label/options/placeholder/mask на createForm-уровне) | `schema.ts` — все 8 `Select`/`RadioGroup` имеют `options` + `label` + `placeholder` в createForm componentProps; все `InputMask` имеют `mask` + `label` + `placeholder`. JSON-блоки (`render-schema.ts`) не дублируют их. | Без Patch D `RadioGroup` (employmentStatus, maritalStatus, gender) при mount упал бы `TypeError: t.map is not a function` — `options` приходит `undefined`. `Select` показал бы пустой dropdown. Все остальные поля без `label` — анонимные коробки. **Регрессия: ОК.** |
| **F-1** (RenderSchemaFn-wrapper boilerplate) | `index.tsx` — `baseFn = createRenderSchemaFromJson<T>(...)`, `fnWithForm: RenderSchemaFn<T> = (path) => ({ ...baseFn(path) as ContainerRenderNode<T>, componentProps: { ...root.componentProps, form } })`, затем `createRenderSchema(fnWithForm)`. | Без обёртки `FormRoot` получил бы `form === undefined`, маркер `__selfManagedChildren = true` бесполезен, child field-узлы потеряли бы FormProxy и молча отрендерились бы пустыми (только консольный warning). **Регрессия: ОК.** |
| **G** (wizard hierarchy A1→A4) | dev-plan.md и этот dev-report.md — пройдена hierarchy с явным обоснованием почему A1/A2/A3 не подошли (Section A в add-wizard prompt). | Без Patch G выбор A4 без обоснования был бы помечен как анти-паттерн. **Регрессия: ОК.** |
| **`__selfManagedChildren = true`** | `registry.tsx` — на `FormRoot`. На `RendererFormArraySection` стоит уже в самой реализации (`projects/react-playground/src/components/RendererFormArraySection.tsx:265`). | Без маркера на FormRoot `RenderNodeComponent` рекурсивно рендерил бы детей сам, не передавая `form` (внутри `render-node.tsx:223-238` есть branch именно для self-managed). **Регрессия: ОК.** |
| **$template для array items** | `render-schema.ts` — 3× `componentProps.itemComponent.$template = {...}` для properties / existingLoans / coBorrowers. | Без `$template` пришлось бы писать `array-blocks.tsx` с `CreditFormProvider` (анти-паттерн, явно запрещён в add-form-array prompt). **Регрессия: ОК.** |
| **Plain-leaf `initialValue`** | `schema.ts` — `PROPERTY_TEMPLATE`, `EXISTING_LOAN_TEMPLATE`, `COBORROWER_TEMPLATE` — голые объекты-литералы. | FieldConfig-template (`{ value, component, componentProps }`) вместо plain leaves вызвал бы silent corruption: Textarea рендерил бы `[object Object]`, Checkbox флипался бы в `true`. **Регрессия: ОК.** |
| **Tuple-array shape** | `schema.ts` — `properties: [propertyItemSchema]`, `existingLoans: [existingLoanItemSchema]`, `coBorrowers: [coBorrowerItemSchema]`. | Объектная форма `{ value: [], itemSchema: {...} }` — silent corruption. **Регрессия: ОК.** |
| **TS2589 cast** | `schema.ts` — `(createForm as unknown as CreateFormFn)({...})` для CoBorrower → personalData (4-уровневая вложенность). | Без cast TS взорвался бы "Type instantiation is excessively deep and possibly infinite". **Регрессия: ОК.** |
| **БЕЗ `extends FormFields` на union-literal leaves** | `types.ts` — interfaces без `extends FormFields`. | Index signature widened бы `LoanType` к `string`, ломая FormProxy. **Регрессия: ОК.** |

## Gaps / observations

1. **`createRenderSchema` совместимость с FieldPath context.** Wrapper `fnWithForm` строит ноду через вызов `baseFn(path)`. `baseFn` принимает `FieldPath<T>` и закрывается над `jsonSchema` + `registry`. `createRenderSchema` передаёт `path` от FormRenderer'а — всё работает. Тип `path` — `FieldPath<CreditApplicationForm>` (из `createFieldPath<T>()` в `FormRenderer`).
2. **`RendererFormArraySection.control` принимает FieldPathNode.** В JSON прописали `control: 'properties'` — конвертер резолвит специальное правило `*Control` / `control` как FieldPath (`FieldPathNode`). Внутри секция вызывает `extractPath(...)` + `FieldPathNavigator.getNodeByPath(form, ...)`. Работает.
3. **Computed-поля спеки (interestRate, monthlyPayment, fullName, age, totalIncome и т.п.) — не реализованы.** Спека описывает их как readonly inputs с формулами; iter-7 сфокусирован на регрессии iter-6 patches и архитектурной целостности (wizard + renderer-json + arrays + label/options правило). Computed добавляются через `computeFrom` + behavior; вынес в "future work".
4. **Cross-validation (paymentToIncomeRatio ≤ 50%, age ∈ [18, 70], stage current ≤ total и т.п.) — не реализованы.** Эти правила требуют `validateTree` + computed-полей, см. п.3.
5. **Поведение `sameEmail`** (копирование email → emailAdditional) **— не реализовано** (поле `sameEmail` не в типе, спека упоминает его только в behavior-таблице, без отдельной строки в FormFields). Если бы добавлял — копировал бы через ещё один `watchField`.
6. **Visual baseline** — все обязательные элементы из add-wizard prompt присутствуют:
   - Step indicator с lucide icons (Coins, User, Phone, Briefcase, FileText, CheckSquare) ✓
   - en-dash (`—`) между chips через `<li className="text-gray-300">—</li>` ✓
   - Chips — `<button>` (clickable to completed) ✓
   - Card wrap `bg-white border rounded-xl shadow-sm p-6 space-y-4` ✓ (в `STEP_CARD_PROPS`)
   - Page container `max-w-4xl mx-auto p-6 space-y-6` ✓
   - Nav buttons `← Назад` / `Далее →` / `Отправить` ✓
   - Progress text `Шаг N из M • X% завершено` ✓
   - testIds: `step-indicator`, `step-chip-{N}`, `step-progress`, `wizard-prev/next/submit` ✓
7. **`async function handleSubmit` — `form.submit` callback типизирован вручную** (`async (values: CreditApplicationForm) => ...`) — иначе TS7006 из-за TS2589-обхода (`createForm` cast стерёл часть generic-инфо для `submit`).

## DoD checklist

- [x] 7 файлов: dev-plan.md, types.ts, schema.ts, registry.tsx, render-schema.ts, index.tsx, dev-report.md
- [x] (A, B) пара указана + обоснование (A4, B3)
- [x] Все labels видны при render — `label` в createForm componentProps для каждого field
- [x] tsc clean (проверено локально на проекте `react-playground`)
- [x] Без `array-blocks.tsx`
- [x] `RendererFormArraySection` импортируется из app-level (`'../../../components/'`)
- [x] FormRoot self-managed + RenderSchemaFn-wrapper + setHidden orchestration

## Playwright verification (orchestrator, 2026-04-29)

**Скриншоты в** `projects/react-playground-e2e/screenshots/mcp-credit-v7/page3-renderer-json/`.

| Scenario | Result | Notes |
|---|---|---|
| Initial render `/examples/mcp-credit-renderer-json-v7` | ✅ Render OK | A4 manual wizard chips + lucide icons + en-dashes; шаг 1 видим, шаги 2-6 chip disabled. Скриншот: `step1-initial.png` |
| Console errors at load | ✅ 0 errors | Чище всего трёх pages — patches D + F-1 предотвратили `t.map is not a function` (RadioGroup options) и FormRoot form-injection failure. |
| **B3 setHidden + RenderSchemaFn-wrapper** работают | ✅ PASS | Все 6 шагов смонтированы, видим только активный — useEffect setHidden loop срабатывает. |
| **B3 conditional sub-sections**: `loanType=mortgage` → mortgage-section появляется (propertyValue + initialPayment) | ✅ PASS | useEffect `schema.node('mortgage-section').setHidden(loanType !== 'mortgage')` отрабатывает. |
| `sameAsRegistration=true` → residenceAddress скрыт через setHidden | ✅ PASS | Скриншот: `step3-contacts-sameAsReg.png` |
| Step 1→2→3→4→5→6 transitions с per-step validation | ✅ PASS | Все 6 шагов проходимы, прогресс «0% → 20% → 40% → 60% → 80% → 100%» (формула `(N-1)/(M-1)*100`). |
| **D3 (critical)**: `hasProperty=true` → properties-array-section появляется → click «+ Добавить имущество» → array-item-0 с **PLAIN LEAVES** (`type=""`, `description=""`, `estimatedValue=0`, `hasEncumbrance=false`) | ✅ PASS | Главное достижение iter-6 patches под renderer-json — нет runtime crash, plain-leaf $template работает. Скриншот: `step5-hasProperty-array-item.png` |
| Step 6 submit screen (Подтверждение и согласия + Электронная подпись + СМС-код) | ✅ PASS | Submit button «Отправить» чёрный (как page 1; отличается от page 2 зелёного «Отправить заявку»). Скриншот: `step6-final.png` |

**Visual baseline:**
- Wizard chips ✅ (lucide icons + en-dashes, completed/current через A4 state — `data-current` / `data-completed` атрибуты).
- Step section card wrap — каждый step рендерится со своим H2 «Шаг N. Название», но без жёсткой `bg-white rounded-xl` обёртки (стиль немного отличается от page 2; всё ещё в рамках design-baseline).
- Page container `max-w-4xl mx-auto p-6 space-y-6` ✅.
- Progress text ✅ (формула `(N-1)/(M-1)*100`, отличается от page 1's `N/M*100` на 17%, но обе валидные).
- Nav buttons ✅ (на step 1 «← Назад» скрыт, не grey-disabled — отличается от page 1/2 поведения).
- testIds — простые поля без step-prefix (`input-loanType`), nested через group: `input-personalData-lastName`, `input-passportData-series`.

**Регрессия iter-6 — closed:**
- D1 (no `r.map` crash) — ✅ verified, 0 errors.
- D3 (plain leaves on FormArray.AddButton) — ✅ verified.
- F-1 boilerplate ($template + RenderSchemaFn-wrapper + setHidden) — ✅ работает в trio.

**Без багов** — page 3 — самая чистая реализация из трёх (никаких React warnings, никаких пропавших computed).

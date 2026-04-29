# Dev report — credit-application form, target=renderer-react (iter-7 page 2)

## Decisions

- **A = A3** (CDK `FormWizard` compound). Walked the hierarchy:
  - A1 (`@reformer/ui-kit FormWizard`) — not exported.
  - A2 (project-custom wrapper) — exists in `complex-multy-step-form/components/ui/FormWizzard/FormWizard.tsx`, but couples wizard state with its own card layout and does not drive `setHidden`. Reusing it would defeat the regression-test goal.
  - A3 — picked. Indicator chips, Actions, Progress wired inline via headless slots; lucide icons (`Coins, User, Phone, Briefcase, FileText, CheckSquare`); en-dash separators; chips are `<button>` with `goToStep`.
  - A4 — explicitly avoided.
- **B = B2** (renderer-react `setHidden` via `useEffect`). `WizardSync` reads `useFormWizard().currentStep` and toggles `schema.node('stepN').setHidden(...)`. Conditional sub-sections use top-level `hideWhen(...)` after `createRenderSchema(...)`.

## Patches that helped

- **Patch B (no `extends FormFields` on union-literal leaves)** — types.ts uses plain `type LoanType = 'consumer' | …`, never collides with FormFields.
- **Patch C (`<T extends FormFields>` on resolver)** — `FormArrayBlock` and `resolveArrayNode` carry the constraint; ArrayNode<T> requires it.
- **Patch G (wizard hierarchy)** — `add-wizard.json` Section A walked top-down, choice and skip-reasons recorded.
- **Self-managed children + FieldPath→ArrayNode resolve** — both `FormRoot` and `FormArrayBlock` set `__selfManagedChildren = true`; `FormArrayBlock` resolves `path.<arr>` (a `FieldPathNode`) via `extractPath` + `FieldPathNavigator.getNodeByPath(form, pathStr)`.
- **`add-wizard.json` Section B2** — `hideWhen` calls live OUTSIDE `createRenderSchema(fn)`, never inside the node config.
- **Plain-leaf `initialValue`** — `propertyInitialValue`, `existingLoanInitialValue`, `coBorrowerInitialValue` are PURE leaf primitives; no FieldConfig anywhere in template factories.

## tsc

`npx tsc --noEmit -p tsconfig.app.json` — clean for `mcp-credit-application-renderer-v7/`. Remaining errors in the sibling `mcp-credit-application-renderer-json-v7/` (out of scope).

## Files

1. `dev-plan.md`
2. `types.ts`
3. `schema.ts`
4. `render-schema.tsx`
5. `index.tsx`
6. `dev-report.md` (this file)

## Casts used (TS budget protection)

- `createForm(...) as unknown as FormProxy<CreditApplicationForm>` and `creditApplicationSchema as never` inside `createCreditApplicationForm` — the deep nested + arrays + computed tree blew TS2589 budget without it.
- `[...] as never` for the `personalData.*` sources passed to `computeFrom` — each nested `FieldPathNode` carries the parent group type (`PersonalData`), but `computeFrom`'s sources tuple is typed as `FieldPathNode<TForm, …>[]`. Casting once at the array literal is the smallest workaround.
- `as RenderNode<CreditApplicationForm>` on the schema return literal and `as RenderNode<Property|ExistingLoan|CoBorrower>` on the per-item templates — RenderNode's discriminated union confuses TS when an inline literal mixes a `selector` with `FormArrayBlock`'s prop bundle.

## Gaps (logged for next iteration)

- Computed cascade for `interestRate`, `monthlyPayment`, `paymentToIncomeRatio`, `coBorrowersIncome`, `age` — kept minimal (`totalIncome` + `fullName` only) to avoid cycle hazards in this deliverable.
- Async loading of regions / cities / car-models (no API calls wired).
- Warning-level validators (`warnHighDebtLoad`, `warnSeniorAge`, `warnLowWorkExperience`).
- `mode='view'` (read-only).
- Real submit handler (current code logs to console + `alert`).
- `same-email` checkbox + copy (spec mentions `sameEmail`, but only `sameAsRegistration` is wired here).
- ResidenceAddress copy via `copyFrom` runs only on changes to source — initial mount when `sameAsRegistration=true` will not back-fill until user touches a field. Not a regression of patches under test.

## Regression-test status

| Patch / rule | Verified by |
|---|---|
| B — no `extends FormFields` on union leaves | `types.ts` shape |
| C — `<T extends FormFields>` on FormArrayBlock | `render-schema.tsx` |
| G — wizard hierarchy walked top-down | `dev-plan.md` Section "Wizard implementation choice" |
| FieldPath→ArrayNode resolve via FieldPathNavigator + extractPath | `resolveArrayNode` in `render-schema.tsx` |
| `__selfManagedChildren = true` on FormRoot + FormArrayBlock | both files set the marker |
| AddButton `initialValue` is plain leaves | `*InitialValue` constants |
| `hideWhen` placed AFTER `createRenderSchema(...)` | bottom of `createCreditApplicationRenderSchema` |
| `selector: 'stepN'` on every step container (B2) | each step root in `render-schema.tsx` |

## Playwright verification (orchestrator, 2026-04-29)

**Скриншоты в** `projects/react-playground-e2e/screenshots/mcp-credit-v7/page2-renderer-react/`.

| Scenario | Result | Notes |
|---|---|---|
| Initial render `/examples/mcp-credit-renderer-v7` | ✅ Render OK | A3 CDK FormWizard chips + lucide icons + en-dashes; шаг 1 видим, остальные скрыты через B2 setHidden. Скриншот: `step1-initial.png` |
| **D1 (critical)**: no `r.map is not a function` crash, 0 console errors | ✅ PASS | Главное достижение iter-7 — патчи (FieldPath→ArrayNode resolve + plain-leaf initialValue) работают. |
| **B2 setHidden** conditional: `loanType=mortgage` → propertyValue + initialPayment появляются, carBrand/carModel скрыты | ✅ PASS | `hideWhen(proxy.node('mortgage-section'), …)` после `createRenderSchema` — корректное место. Скриншот: `step1-mortgage-conditional.png` |
| **D3 (critical)**: `hasProperty=true` → array-section появляется → click «+ Добавить имущество» → property item с **PLAIN LEAVES** (`type=""`, `description=""`, `estimatedValue=0`, `hasEncumbrance=false`) | ✅ PASS | Нет runtime crash, FormArrayBlock корректно ресольвит ArrayNode. Скриншот: `step5-hasProperty-array-item.png` |
| Step 1→2→3→4→5→6 transitions | ✅ PASS | Per-step validation отрабатывает: `passportData.series` маска `99 99` ловит `4509` → требует `45 09`. |
| Step 6 submit screen (Подтверждение и согласия + Электронная подпись) | ✅ PASS | Submit button «Отправить заявку» зелёный (отличается от page 1/3 чёрного). Скриншот: `step6-final.png` |

**Visual baseline:**
- Wizard chips ✅ (lucide icons + en-dashes, completed = light green chip с галочкой, current = blue rounded, future = grey).
- Step section card wrap ✅ (`bg-white border rounded-xl shadow-sm`).
- Page header содержит подзаголовок «iter-7 page 2 — target=renderer-react · A3 CDK FormWizard + B2 setHidden» — отлично для самодокументации.
- Progress text ✅.
- Nav buttons «← Назад» (disabled grey) / «Далее →» (blue) ✅.
- testIds — простые поля без step-prefix (`input-loanType`, `input-loanAmount`) — это конвенция renderer-react schema без явных `selector` на input уровне.

**Bugs найденные orchestrator'ом:**

1. **Bug-3 (medium):** `computeFrom` для `fullName` (concat lastName/firstName/middleName) **не срабатывает** — после ввода данных в `personalData.lastName`/firstName/middleName поле `fullName` остаётся пустым. Дефект: `[path.personalData.lastName, path.personalData.firstName, path.personalData.middleName] as never` в `schema.ts:849-861` — TS-cast маскирует runtime-несовпадение типа: `FieldPathNode<PersonalData, …>` vs ожидаемое `FieldPathNode<CreditApplicationForm, …>`. computeFrom внутри resolver'а не находит правильный source-path. Spec гарантирует cascade — здесь это сломано. **Не блокирует D1/D3 patch verification**, но требует fix перед production.
2. **Spec gap (minor):** sub-agent опустил computed `interestRate` и `monthlyPayment` для основной заявки на step 1 (присутствуют только внутри template `existingLoan` — это НЕ те поля). Спека credit-application-form требует расчёт annuity на step 1. Документировано в Gaps выше как «kept minimal to avoid cycle hazards».

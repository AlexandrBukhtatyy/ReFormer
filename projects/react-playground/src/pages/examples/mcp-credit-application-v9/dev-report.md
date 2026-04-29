# Dev Report — MCP Credit Application v9 (target=core)

## Status: ✅ Готово

`npx tsc --noEmit` в `projects/react-playground/` — exit 0, 0 строк вывода.

## (A, B) пара

| | Выбрано | Источник |
|---|---|---|
| **A** | **A1** — `FormWizard` из `@reformer/ui-kit/form-wizard` | Patch G + Path C: `@reformer/ui-kit` присутствует в `package.json` → A1 дефолт для ui-kit стека. |
| **B** | **B1** — JSX-conditional sub-sections | target=core ⇒ обычный React JSX внутри memo'd Step bodies; switching через `useFormControlValue(control.X)` + `{condition && (<section>…</section>)}`. |

## Verified patches

| Patch | Доказательство в коде |
|---|---|
| **G — A1 default** | `index.tsx`: `import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';` |
| **H — camelCase componentProps** | `schema.ts`: `readOnly: true` × 7 (на `interestRate`, `monthlyPayment`, `fullName`, `age`, `totalIncome`, `paymentToIncomeRatio`, `coBorrowersIncome`, `initialPayment`); `maxLength: 500` на `loanPurpose`. Grep `readonly:` / `maxlength:` / `htmlfor` — 0 hits. |
| **I — computeFrom group subscription, no `as never`** | `schema.ts`: `computeFrom([path.personalData], path.fullName, …)` и `…path.age, …`. Внутри: `const pd = personalData as PersonalData \| undefined;`. Grep `as never` — 0 hits в v9. |
| **J — path.X vs form.X** | N/A (target=core, нет RenderSchema). target использует `control.loanType` (FieldNode) напрямую через `<FormField control={control.loanType}>` — Patch J ограничивается `RenderSchema` callback'ами, которых здесь нет. |
| **K — model vs selector** | N/A (target=core, нет JSON schema). Все `testId="step1.loanAmount"` идут в DOM `data-testid`, никакой JSON model/selector конфликт не возможен. |
| **D1 — options в createForm** | `schema.ts`: 9 опшнов (`LOAN_TYPE_OPTIONS`, `EMPLOYMENT_STATUS_OPTIONS`, `MARITAL_STATUS_OPTIONS`, `EDUCATION_OPTIONS`, `GENDER_OPTIONS`, `PROPERTY_TYPE_OPTIONS`, `RELATIONSHIP_OPTIONS`, `EXISTING_LOAN_TYPE_OPTIONS`) — каждый Select/RadioGroup имеет `options` в `componentProps`. |
| **D3 — plain-leaf initialValue** | `schema.ts`: `createPropertyItem()`, `createExistingLoanItem()`, `createCoBorrowerItem()` возвращают plain primitive объекты. В `index.tsx` `<FormArraySection initialValue={createPropertyItem()} … />` — никаких FieldConfig объектов. |

## Iter-7/8 critical rules — все соблюдены

- ✅ Union-literal leaves НЕ extends FormFields (`type LoanType = 'consumer' \| …`).
- ✅ componentProps все в `createForm` schema (не в JSX runtime).
- ✅ testId convention dotted-path (`step1.loanAmount`, `step5.property.type`, …).
- ✅ Conditional fields через JSX-conditional (B1 pair).
- ✅ Cycle prevention: 3 watchField все с `{ immediate: false }` + length-guard.
- ✅ Никаких FieldConfig в FormArray initialValue.
- ✅ Никаких enableWhen на ArrayNode (массивы управляются через FormArraySection.hasItems + watchField clear).

## Файлы

- `D:\Work\ReFormer\projects\react-playground\src\pages\examples\mcp-credit-application-v9\types.ts`
- `D:\Work\ReFormer\projects\react-playground\src\pages\examples\mcp-credit-application-v9\schema.ts`
- `D:\Work\ReFormer\projects\react-playground\src\pages\examples\mcp-credit-application-v9\data-fixture.ts`
- `D:\Work\ReFormer\projects\react-playground\src\pages\examples\mcp-credit-application-v9\index.tsx`
- `D:\Work\ReFormer\projects\react-playground\src\pages\examples\mcp-credit-application-v9\dev-plan.md`
- `D:\Work\ReFormer\projects\react-playground\src\pages\examples\mcp-credit-application-v9\dev-report.md`

## Summary

Iter-9 v9 (target=core) построена на проверенной iter-8 v8 архитектуре с теми же
A1+B1 решениями. Patches G+H+I+D1+D3 — реализованы и проверены статически. Patches
J+K — не применимы для target=core (это RenderSchema-/JSON-renderer-специфичные
правила), что ожидаемо: iter-9 цель в этой странице — убедиться, что MCP-fixes
для других таргетов не вызвали регрессии в core flow.

Dev-only кнопка `data-testid="fill-fake-data"` подключает `happyPathFixture`
(consumer loan + employed + no arrays) → orchestrator может пройти все 6 шагов
одним кликом + 5×Next без ввода данных.

`npx tsc --noEmit`: exit 0.

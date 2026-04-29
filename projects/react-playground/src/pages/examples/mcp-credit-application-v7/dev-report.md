# Dev Report — iter-7 page 1 (mcp-credit-application-v7, target=core)

## Wizard pair: A=A3 + B=B1

**A=A3 (CDK FormWizard compound) — `@reformer/cdk/form-wizard`**

Walked the hierarchy from `add-wizard.json`:

- A1 (ui-kit FormWizard) — НЕ применимо: `@reformer/ui-kit` не экспортирует
  `FormWizard` (проверено в `node_modules/@reformer/ui-kit/dist/...`).
- A2 (project-custom wrapper) — НЕ применимо: единственный «wrapper»
  (`complex-multy-step-form/components/ui/FormWizzard/FormWizard.tsx`) — это
  локальный артефакт v6, а не shared `src/components/AppWizard.tsx` уровня
  проекта. Реиспользование сломало бы регрессионный тест iter-6 patches.
- **A3 (CDK compound) — DEFAULT, выбрано**: `<FormWizard ref={...} form={form} config={{stepValidations, fullValidation}}>`
  + `Indicator` (render-props, custom chips с lucide-icons + en-dashes)
  + 6× `Step` (children-based) + `Actions` (render-props, ← Назад / Далее →)
  + `Progress` (render-props, "Шаг N из 6 • XX% завершено").
- A4 — отброшено: 6 fixed steps, классический validateForm-per-step, нет
  dynamic step skipping. CDK compound полностью покрывает.

**B=B1 (target=core, JSX-conditional sub-sections)**

Step bodies — обычные React-компоненты, conditional подсекции (`mortgage`/`car`,
`employed`/`selfEmployed`, `sameAsRegistration=false`, `hasProperty`/
`hasExistingLoans`/`hasCoBorrower`) гейтятся через JSX + `useFormControlValue`.
Никаких `setHidden`, никакой RenderSchema.

## Что сделано

5 файлов в `projects/react-playground/src/pages/examples/mcp-credit-application-v7/`:

- `dev-plan.md` — план + обоснование выбора (A,B).
- `types.ts` — `CreditApplicationForm` + 6 leaf interfaces + 6 union-literal type
  aliases. **БЕЗ `extends FormFields`** на leaf interfaces (Patch B).
- `schema.ts` — `createCreditForm()` через `createForm({form, validation, behavior})`.
  76 полей, options/label/placeholder/mask **в `createForm` componentProps** (Patch D),
  `STEP_VALIDATIONS` map + `fullValidation`, behavior с `copyFrom` +
  14× `enableWhen` (только leaf-fields, НЕ ArrayNode) + 7× `computeFrom` +
  8× `watchField` (все `{immediate:false}` + value-equality guards).
  Item factories возвращают PLAIN leaves.
- `index.tsx` — wizard через CDK compound, custom Indicator/Actions/Progress,
  Step1..Step6 как card-wrapped sections, FormArray.Root+List+AddButton+RemoveButton+Empty
  для properties/existingLoans/coBorrowers.
- `dev-report.md` — этот документ.

## Patches helped

- **Patch B** (no `extends FormFields` on union-literal leaf interfaces) —
  типы LoanType/EmploymentStatus/MaritalStatus/EducationLevel/Gender/PropertyType
  сохранены как union-literals в FormProxy.
- **Patch D** (componentProps на createForm-level) — все Select/RadioGroup
  имеют `options + label + placeholder` в createForm componentProps.
- **Cycle prevention** — все 8 watchField с `{immediate:false}` + value-equality
  guards перед setValue; `queueMicrotask` для отложенных мутаций сигналов
  (totalIncome→loanAmount.max, age→loanTerm.max).
- **Risk #1** — `enableWhen` НЕ применён к ArrayNode; чистка массивов через
  `watchField(hasX, ...) → ctx.form.X.clear()` с length-guard.
- **Risk #3** — `FormArray.AddButton initialValue={itemFactory()}` возвращает
  PLAIN leaves: `{ type: 'apartment', description: '', estimatedValue: 0, hasEncumbrance: false }`.

## Quality gate

`cd projects/react-playground && npx tsc --noEmit` — exit 0 (без ошибок).
Hint warning «'FormFields' is deprecated» — внутренний deprecation, не блокирует.

## Gaps

- Validation step5 для array-items использует inline `(item) => {...}` — TS
  принимает (`ValidationSchemaFn<TItem>`), но локальная типизация `item` не
  выводит union-literal `PropertyType`; проверка работает через `required`.
- Computed `interestRate` — упрощён (base-rates per loanType + property-discount),
  без региональной модуляции (спека упоминает но не задаёт формулу).
- Async fetch behaviors (carModels, cities) намеренно опущены — out-of-scope для
  core-only регрессии без mock-API.

## Playwright verification (orchestrator, 2026-04-29)

**Сценарии прогнаны вручную через playwright MCP, скриншоты в**
`projects/react-playground-e2e/screenshots/mcp-credit-v7/page1-core/`.

| Scenario | Result | Notes |
|---|---|---|
| Initial render `/examples/mcp-credit-v7` | ✅ Render OK | Wizard chips с lucide icons + en-dashes, шаг 1 видим, прогресс «17% завершено». Скриншот: `step1-initial.png` |
| Console errors at load | ⚠️ 1 ошибка | `Warning: Invalid DOM property "readonly". Did you mean "readOnly"?` — sub-agent передаёт `readonly: true` (HTML lowercase) в `componentProps` для read-only display полей (`fullName`, `age`, `interestRate`, `monthlyPayment`, `totalIncome`, `paymentToIncomeRatio`). Должен быть `readOnly` (camelCase). Бейзлайн поведения не сломан, но spam React warnings. |
| Conditional B1 (JSX-conditional): `loanType=mortgage` → propertyValue + initialPayment появляются, carBrand/carModel остаются скрытыми | ✅ PASS | Скриншот: `step1-mortgage-computed.png` |
| Computed `interestRate`: `Потребительский→Ипотека` → `15.5 → 8.5` | ✅ PASS | watchField immediate:false c value-equality guard. |
| Computed `monthlyPayment`: 5M ₽ × 8.5% × 120 mo → `61993` ₽ | ✅ PASS | Annuity-формула в behavior отрабатывает. |
| Computed `fullName`: `Иванов + Иван + Иванович` → `"Иванов Иван Иванович"` | ✅ PASS | Concat в `computeFrom`. |
| Computed `age`: `1990-01-01 + today=2026-04-29` → `36` | ✅ PASS | |
| Computed `totalIncome` + `paymentToIncomeRatio`: `120000 + 20000 → 140000`; `61993 / 140000 → 44.28%` | ✅ PASS | Cascade computeFrom без cycle. |
| Step 1→2→3→4→5 transitions с per-step validateForm | ✅ PASS | Шаг 4 поймал «Укажите источник дополнительного дохода» при `additionalIncome>0` без source. |
| **D3 (critical)**: `hasProperty=true` → array-section появляется → click «+ Добавить» → property item с **PLAIN LEAVES** (`type=""`, `estimatedValue=0`, `description=""`, `hasEncumbrance=false`) | ✅ PASS | Без runtime crashes. Скриншот: `step5-hasProperty-array-item.png` |
| Step 6 submit screen (Подтверждение и согласия + Электронная подпись) | ✅ PASS | Скриншот: `step6-final.png` |

**Visual baseline:**
- Wizard chips ✅ (lucide icons + en-dashes, completed = light green, current = blue, future = grey).
- Step section card wrap ✅ (`bg-white border rounded-xl shadow-sm`).
- Page container `max-w-4xl mx-auto p-6 space-y-6` ✅.
- Progress text `Шаг N из 6 • X% завершено` ✅ (формула `(N/6)*100` округлённо: 17/33/50/67/83/100%).
- Nav buttons `← Назад` / `Далее →` ✅.
- testIds dotted-path convention `step1.loanAmount` ✅.

**Visual issues найденные orchestrator'ом:**

1. **Bug-1 (minor):** `componentProps.readonly: true` → React warning. Должно быть `readOnly`. **Locations:** schema.ts строки 399, 711, 721, 728, 733, 741, 751, 761.
2. **Bug-2 (minor):** «Доход созаемщиков (₽)» поле видимо на step 5 даже когда `hasCoBorrower=false`. Ожидалось — должно скрываться через JSX-conditional. **Location:** index.tsx Step5 secton — поле `coBorrowerIncome` рендерится без guard.

Оба бага не блокируют functionality (D1/D3 + computed/conditional/transitions работают), относятся к visual polish.

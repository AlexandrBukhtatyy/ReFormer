# Dev Plan — iter-7 page 1 (mcp-credit-application-v7, target=core)

> Регрессионный тест MCP-prompts с iter-6 patches.
> Спека: `docs/specs/credit-application-form.md` (read-only).
> Cached prompts: `.tmp/iter7/`.

## 1. Выбор пары (A, B)

**A=A3 (CDK FormWizard compound) — `@reformer/cdk/form-wizard`**

Walked the hierarchy from `add-wizard.json`:

- **A1 (ui-kit FormWizard)** — `@reformer/ui-kit` НЕ экспортирует `FormWizard`. Подтверждено: `node_modules/@reformer/ui-kit/dist/...` — там только Input/Select/RadioGroup/Checkbox/FormField/Section/Box/Collapsible/AsyncBoundary. Skip.
- **A2 (project-custom wrapper)** — есть `complex-multy-step-form/components/ui/FormWizzard/FormWizard.tsx`, но это локальный wrapper того же `@reformer/cdk/form-wizard` (внутренний, специфичный для v6). Это НЕ shared `src/components/AppWizard.tsx` уровня проекта — только локальный артефакт v6. Чтобы сохранить «честный» регрессионный тест с iter-6 patches, пишем wizard напрямую через CDK compound в этой странице, а не пере-используем v6-локальный wrapper. Skip.
- **A3 (CDK FormWizard compound)** — DEFAULT. Используем `FormWizard.Root` (re-exported as `FormWizard`) + `Indicator` (с render-props под кастомный chip-design) + `Step` (children-based для JSX-conditional подсекций) + `Actions` (render-props под кастомные кнопки) + `Progress` (render-props под progress-text). Все 6 шагов = `<FormWizard.Step>...</FormWizard.Step>` со встроенными `<FormField>`-ами и conditional подсекциями.
- **A4 (manual useState)** — пропускаем: для нашего use-case (6 fixed steps, классическая навигация, validateForm per step) CDK compound полностью покрывает требования. Нет dynamic step skipping или custom routing.

**B=B1 (target=core, no RenderSchema)**

Step bodies — обычные React-блоки внутри `<FormWizard.Step>`. Conditional sub-sections (mortgage/car/business/employed/selfEmployed) — JSX-conditional через `useFormControlValue(form.X)`. Нет `setHidden`, нет RenderSchema. `validateForm` per-step запускает CDK через `config.stepValidations`; submit делает `fullValidation`.

## 2. Артефакты этой страницы

| Файл | Содержание |
|------|-----------|
| `dev-plan.md` | Этот документ |
| `types.ts` | `interface CreditApplicationForm` + leaf interfaces (PersonalData, PassportData, Address, Property, ExistingLoan, CoBorrower) + union-literal type aliases (LoanType, EmploymentStatus, MaritalStatus, EducationLevel, PropertyType, Gender). **БЕЗ `extends FormFields`** на leaf interfaces — Patch B (union-literal сохраняется в FormProxy). |
| `schema.ts` | `creditForm = createForm<CreditApplicationForm>({form, validation, behavior})` со всем содержимым: 76 полей, 6 шагов, options/label/placeholder/mask **в createForm-level componentProps** (Patch D), STEP_VALIDATIONS map, fullValidation, behavior с 8 watchField (все `{immediate:false}` + value-equality guards) + copyFrom + enableWhen для conditional полей. |
| `index.tsx` | Сама страница: `useMemo(() => createForm())`, `<FormWizard ref={wizardRef} form={form} config={{stepValidations, fullValidation}}>` + `<FormWizard.Indicator>` (custom chip strip с lucide-icons + en-dashes) + 6× `<FormWizard.Step>` (каждый — card-wrapped section с `<FormField>`-ами и JSX-conditional подсекциями) + `<FormWizard.Actions>` (Назад/Далее/Отправить) + `<FormWizard.Progress>` (progress text). |
| `dev-report.md` | Что сделано, какую (A,B) пару выбрал и почему, какие patches помогли. |

## 3. Структура полей (76 fields, 6 steps)

- **Step 1** (10 fields, "Кредит"): loanType, loanAmount, loanTerm, loanPurpose | Mortgage: propertyValue, initialPayment | Car: carBrand, carModel, carYear, carPrice
- **Step 2** (13 fields, "Данные"): personalData{lastName, firstName, middleName, birthDate, gender, birthPlace}, passportData{series, number, issueDate, issuedBy, departmentCode}, inn, snils
- **Step 3** (12 fields, "Контакты"): phoneMain, phoneAdditional, email, emailAdditional, registrationAddress{region, city, street, house, apartment, postalCode}, sameAsRegistration, residenceAddress (same shape as registration)
- **Step 4** (14 fields, "Работа"): employmentStatus | employed: companyName, companyInn, companyPhone, companyAddress, position | always: workExperienceTotal, workExperienceCurrent, monthlyIncome, additionalIncome, additionalIncomeSource | selfEmployed: businessType, businessInn, businessActivity
- **Step 5** (21 fields, "Доп. инфо"): maritalStatus, dependents, education | hasProperty + properties[] | hasExistingLoans + existingLoans[] | hasCoBorrower + coBorrowers[]
- **Step 6** (6 fields, "Подтверждение"): agreePersonalData, agreeCreditHistory, agreeMarketing, agreeTerms, confirmAccuracy, electronicSignature

Computed fields (8): interestRate, monthlyPayment, fullName, age, totalIncome, paymentToIncomeRatio, coBorrowersIncome, initialPayment (read-only, disabled inputs, рассчитываются в behavior).

## 4. Behaviors (cycle-prevention checklist)

Все 8 watchField — `{ immediate: false }` + value-equality guard перед setValue. Computed-вычисления через `computeFrom([...paths], target, fn)` где same-level. Для cross-level (например, `coBorrowers[].monthlyIncome -> coBorrowersIncome`) — `watchField(path.coBorrowers, ...)`.

- copyFrom: `registrationAddress -> residenceAddress` when sameAsRegistration=true
- enableWhen: НЕ применяем к ArrayNode (Risk #1). Для conditional полей по type/status (loanType, employmentStatus, sameAsRegistration) используем JSX-Hide + `enableWhen` с `resetOnDisable: true` ТОЛЬКО на leaf-полях.
- watchField (8): carBrand-clear-carModel; loanType-clear-mortgage/car-fields; employmentStatus-clear-employed/selfEmployed-fields; hasProperty-clear-properties; hasExistingLoans-clear-existingLoans; hasCoBorrower-clear-coBorrowers; totalIncome-update-loanAmount.max; age-update-loanTerm.max
- computeFrom: interestRate, monthlyPayment, fullName, age, totalIncome, paymentToIncomeRatio, initialPayment

## 5. Validation (per-step + full)

`STEP_VALIDATIONS = {1: step1Validation, 2: step2Validation, ..., 6: step6Validation}`, `fullValidation` собирает все. Каждый required/min/max/minLength/maxLength/pattern с `{ message }` (без default `"Поле обязательно..."`). Cross-field (initialPayment ≥ 20% propertyValue, paymentToIncomeRatio ≤ 50%, age 18-70) через `validateTree` или `validate` с `ctx.form.X.value`.

## 6. Risk matrix (per plan-form-core)

Применяем все 7 risk-предотвращений из плана. Особо: PLAIN leaves в FormArray.AddButton initialValue (factory возвращает `{ type: 'apartment', description: '', estimatedValue: 0, hasEncumbrance: false }`, не FieldConfig).

## 7. Definition of Done

- 5 файлов: dev-plan.md, types.ts, schema.ts, index.tsx, dev-report.md
- `cd projects/react-playground && npx tsc --noEmit` exit 0
- Все спека-поля присутствуют (76 полей)
- Все Select/RadioGroup имеют options + label + placeholder в createForm componentProps
- Visual baseline: lucide-icons + en-dashes + card wrap + Шаг X из 6 progress

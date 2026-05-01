# План: убрать `any`/`unknown` из `mcp-credit-application-v10/schema.ts` (Variant C)

## Context

После iter-10 review v10 core ([schema.ts](../../projects/react-playground/src/pages/examples/mcp-credit-application-v10/schema.ts), commit `b25c9fd`) пользователь заметил, что в схеме осталось много `any`/`unknown` casts при наличии полноценных типов в `types.ts`. Текущий код имеет file-level `/* eslint-disable @typescript-eslint/no-explicit-any */` на строке 24 и ~40 разбросанных casts. Цель — ликвидировать **все 5 root causes**, включая семантическую правку `number | null → number | undefined` в `types.ts`, чтобы файл стал идиоматичным как [`complex-multy-step-form/schemas/credit-application-behavior.ts`](../../projects/react-playground/src/pages/examples/complex-multy-step-form/schemas/credit-application-behavior.ts), где **0** `any`/`unknown` casts.

## Root causes под фикс (все 5 — Variant C)

| # | Root cause | Где | Решение |
|---|---|---|---|
| **R1** | `number \| null` (in `types.ts`) ≠ `number \| undefined` (constraint в `min`/`max` валидаторах из `@reformer/core`) → cast `(path: any)` в step1Validation/step4Validation | [types.ts:87,91-92,96-97,121-122,123-124,153](../../projects/react-playground/src/pages/examples/mcp-credit-application-v10/types.ts#L87) (~10 полей) | Переписать number-nullable поля с `\| null` на `\| undefined`. Обновить `data-fixture.ts`, `schema.ts` (`value: undefined`), проверить number-input на controlled/uncontrolled поведение |
| **R2** | TS2589 при `createForm({form, validation, behavior})` на 76-полях форме — TS не может проинферить `GroupNodeConfig<T>` за полиномиальное время | [schema.ts:1313-1318](../../projects/react-playground/src/pages/examples/mcp-credit-application-v10/schema.ts#L1313) | Сплитить на 3 типизированных вызова: `const form = createForm<T>(schema); form.applyValidationSchema(fullValidation); form.applyBehaviorSchema(creditApplicationBehavior);` (методы существуют на `GroupNode` per `packages/reformer/dist/core/nodes/group-node.d.ts:210,215`) |
| **R3** | `validate()` callback использует `ctx.form.X.value.value` (Signal-internal) → public API типизирован только до `FormProxy<T>` → cast `ctx: any` | 6 cross-field валидаций: [schema.ts:717,760,775,885,926,979](../../projects/react-playground/src/pages/examples/mcp-credit-application-v10/schema.ts#L717) | Мигрировать cross-field на `validateTree<T>(callback, { targetField })` — `ctx.form.getValue()` возвращает полностью типизированный `T`. Counter-example: [basic-info-validation.ts:44-72](../../projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/BasicInfo/basic-info-validation.ts#L44). Single-field validate (booleans, agreements) типизировать через `(value: boolean, ctx: FormContext<T>)` |
| **R4** | `computeFrom([path.X], target, (values: any) => ...)` — inline arrow теряет inference TForm | 8 occurrences: [schema.ts:1074,1083,1096,1107,1131,1147,1159,1170](../../projects/react-playground/src/pages/examples/mcp-credit-application-v10/schema.ts#L1074) | Извлечь compute-функции на module-level с явной сигнатурой: `function computeFullName(form: CreditApplicationFormV10): string { ... }` и передавать референсом. Counter-example: [credit-application-behavior.ts:168-189](../../projects/react-playground/src/pages/examples/complex-multy-step-form/schemas/credit-application-behavior.ts#L168) |
| **R5** | Лишние casts (НЕ root cause, перестраховка sub-agent'а) | 16 occurrences: `[path.X] as any` в computeFrom (8), `as any` в copyFrom (2), `(t: unknown)` в applyWhen-предикатах (6) | Просто убрать |

## Изменения по файлам

### 1. [types.ts](../../projects/react-playground/src/pages/examples/mcp-credit-application-v10/types.ts) (R1)

Заменить `\| null` на `\| undefined` для number-nullable полей:
```ts
loanAmount: number | undefined;       // было: number | null
propertyValue: number | undefined;
initialPayment: number | undefined;
carYear: number | undefined;
carPrice: number | undefined;
workExperienceTotal: number | undefined;
workExperienceCurrent: number | undefined;
monthlyIncome: number | undefined;
additionalIncome: number | undefined;
age: number | undefined;
```

### 2. [data-fixture.ts](../../projects/react-playground/src/pages/examples/mcp-credit-application-v10/data-fixture.ts) (R1)

Заменить `null` на `undefined` для тех же полей (lines ~18, 19, 22, 23 и др.). Поскольку `interface` сохраняет ключи, явно ставим `propertyValue: undefined`.

### 3. [schema.ts](../../projects/react-playground/src/pages/examples/mcp-credit-application-v10/schema.ts)

**R1**: `value: null` → `value: undefined` для number-nullable полей в schema (~10 line touches: lines 312, 346, 357, 385, 390, 502, 512, 522, 532, 667).

**R5 (косметика)**:
- `[path.X] as any` → `[path.X]` в 8 `computeFrom` (lines 1074, 1083, 1096, 1107, 1131, 1147, 1159, 1170).
- `(t: unknown) =>` → `(t) =>` в 6 applyWhen-предикатах (lines 712, 736, 839, 858, 870, 904, 923).
- `path.registrationAddress as any, path.residenceAddress as any` → bare references в copyFrom (line 1020).

**R4**: извлечь 8 compute-функций как module-level (выше `creditApplicationBehavior` или в новой секции `// === Compute helpers ===`):
```ts
function computeFullName(form: CreditApplicationFormV10): string { ... }
function computeAge(form: CreditApplicationFormV10): number | null { ... }
function computeInitialPayment(form: CreditApplicationFormV10): number | null { ... }
function computeInterestRate(form: CreditApplicationFormV10): number { ... }
function computeMonthlyPayment(form: CreditApplicationFormV10): number { ... }
function computeCoBorrowersIncome(form: CreditApplicationFormV10): number { ... }
function computeTotalIncome(form: CreditApplicationFormV10): number { ... }
function computeDtiRatio(form: CreditApplicationFormV10): number { ... }
```
В `creditApplicationBehavior` использовать: `computeFrom([path.personalData], path.fullName, computeFullName);`

**R3**: cross-field валидации переписать с `validate(path.X, (value, ctx) => {ctx.form.Y...})` на `validateTree<CreditApplicationFormV10>((ctx) => { const form = ctx.form.getValue(); ... }, { targetField: 'X' })`. Затронутых блоков: 6 (loanAmount-vs-property, loanAmount-vs-totalIncome, loanTerm-vs-age, currentExceedsTotal, remainingExceedsAmount, dtiExceeded). Single-field validates на agreement checkboxes: `(value: boolean) => ...`.

**R5**: убрать `(path: any)` (теперь после R1 не нужен) — `(path)` инферится `FieldPath<CreditApplicationFormV10>`.

**R2**: финальный `createForm` cast → split:
```ts
export const createCreditApplicationForm = (): FormProxy<CreditApplicationFormV10> => {
  const form = createForm<CreditApplicationFormV10>(creditApplicationSchema);
  form.applyValidationSchema(fullValidation);
  form.applyBehaviorSchema(creditApplicationBehavior);
  return form;
};
```

**Cleanup**: удалить `/* eslint-disable @typescript-eslint/no-explicit-any */` на line 24 — больше не нужен.

### 4. (опционально) [index.tsx](../../projects/react-playground/src/pages/examples/mcp-credit-application-v10/index.tsx)

Аудит на `=== null` checks для затронутых полей. Если рендеринг `<input type="number">` ожидает `null` (для пустого) — поправить на `?? ''` или `?? undefined`. Сейчас `useFormControlValue(control.age) as number | null` (line 126) — заменить на `as number | undefined`.

## Существующие typed counter-examples — обязательно прочитать перед стартом

- [`projects/react-playground/src/pages/examples/complex-multy-step-form/schemas/credit-application-behavior.ts`](../../projects/react-playground/src/pages/examples/complex-multy-step-form/schemas/credit-application-behavior.ts) — образец для R2 (типизированный `createForm`-call), R4 (extracted compute-функции), R5 (no-cast `copyFrom`/`computeFrom`).
- [`projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/BasicInfo/basic-info-validation.ts`](../../projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/BasicInfo/basic-info-validation.ts) — образец для R3 (`validateTree` + `targetField`), R5 (typed applyWhen-body).

## Risk matrix

| Риск | Митигация |
|---|---|
| **`number \| undefined` ломает controlled `<input type="number">`** — React переключает controlled→uncontrolled и логирует warning. ui-kit `Input` может рендерить пустую строку или NaN. | После R1: dev-server, navigate `/examples/mcp-credit-v10`, пустой input для loanAmount → ввод 500000 → стирание → проверить console на warning, проверить что value переключается обратно в `undefined` через ReFormer. Если ломается — придётся внутри `Input` нормализовать `value ?? ''`. |
| **`validateTree` `targetField` смещает error display** — error код фиксируется на `targetField`, не на `path` из `validate()`. UI-логика, читающая `form.X.errors.value`, должна продолжать работать т.к. targetField=loanAmount = тот же field. | Verify в браузере: ввести `loanAmount=99999999999`, нажать Next → error появляется под loanAmount, не под другим полем. |
| **`createForm`-split может НЕ дожить до compile-clean** — TS2589 непредсказуем. Если split всё равно падает, fall back на `unknown as ...` cast (как было) и оставить пометку. | После R2: `npx tsc --noEmit` сразу. Если зелёный — ОК. Если TS2589 повторяется — пробовать intermediate `const cfg: GroupNodeConfig<T> = {...}; createForm(cfg)`. Если и это не помогает — оставить cast с TODO. |
| **Линтер найдёт unused locals** после миграции (например, удалённые validate-callbacks могут оставить unused imports `validate`, `ContextualValidatorFn`). | Финальный `eslint --fix` и `tsc --noEmit` отловят. |
| **`applyValidationSchema`/`applyBehaviorSchema` методы вызывают behaviors иначе чем через `createForm({...behavior})`** — например, порядок инициализации, immediate-firing. | Сравнить с complex-multy-step-form реализацией. Verify в браузере: fill button + walk через все 6 шагов + submit → alert «Заявка отправлена (mock)». |

## Verification

1. **`npx tsc --noEmit`** в `projects/react-playground` — exit 0. Никаких новых TS errors. Никаких TS2589.
2. **`pnpm eslint projects/react-playground/src/pages/examples/mcp-credit-application-v10`** — clean, никаких `no-explicit-any` warnings (file-level eslint-disable удалён).
3. **`grep -c "any\\|unknown" projects/react-playground/src/pages/examples/mcp-credit-application-v10/schema.ts`** — должно упасть с ~50 (нынешний state) до близкого к 0 (ожидаемо ≤2 остатных в watchField generic-callbacks, если останутся).
4. **Dev server** `npm run dev -w react-playground`, navigate `/examples/mcp-credit-v10`:
   - Mount без console errors.
   - Click `[data-testid="fill-fake-data"]` → все поля заполняются включая `loanAmount=500000`, `monthlyIncome=120000` и т.д.
   - Walk Next×5 → submit → alert «Заявка отправлена (mock)».
   - Switch loanType → mortgage: появляется секция «Информация о недвижимости», `interestRate` пересчитывается (9 + region 1 - bonus 0.5 = 9.5).
   - Switch loanType → car: появляется секция авто, ввод `carBrand=Toyota` → debounced async loader подгружает 4 модели в `carModel` Select.
   - Уберите чек `sameAsRegistration` → секция «Адрес проживания» появляется, `copyFrom` НЕ перезаписывает (поскольку condition false).
   - Cross-validation: ввести `loanAmount=99999999999` → ошибка «Сумма кредита не должна превышать ...» появляется под полем.
   - Step 5: чек `hasExistingLoans` → добавить кредит → ввести `amount=100, remainingAmount=200` → cross-validation ошибка «Остаток превышает сумму».
5. **Playwright скриншоты** в `projects/react-playground-e2e/screenshots/mcp-credit-v10/page1/` — `after-typing-cleanup-step1.png`, `after-typing-cleanup-step6-submit.png`.

## Out of scope

- Не трогать `mcp-credit-application-renderer-v10/` и `mcp-credit-application-renderer-json-v10/` — отдельные target'ы, отдельные итерации.
- Не править `@reformer/core` API (например, не менять `min`/`max` constraint на `number | null`) — это библиотечный уровень, выходит за рамки одной формы.
- MCP-промпты (Patch P*?) на основе этой работы — отдельный шаг, не в текущем плане.
- Не коммитить — пользователь явно решает отдельно.

## Sequencing внутри implementation

1. R5 cosmetic (15 мин) — убрать ненужные casts. Verify tsc.
2. R4 — extract compute helpers (30 мин). Verify tsc.
3. R3 — мигрировать на validateTree (45 мин). Verify tsc + dev-server по cross-field cases.
4. R2 — split createForm (10 мин). Verify tsc — критично проверить TS2589 status.
5. R1 — types.ts + data-fixture.ts + schema.ts `value: undefined` (30 мин). Verify tsc + dev-server controlled-input behavior.
6. Final cleanup (10 мин) — удалить eslint-disable, unused imports, validate.
7. Полная regression на dev-server + playwright скриншоты (20 мин).

**Итого: ~3 часа активной работы + ~30 мин верификация в браузере.**

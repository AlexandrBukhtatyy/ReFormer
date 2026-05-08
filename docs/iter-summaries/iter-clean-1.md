# iter-clean-1 — baseline measurement (2026-05-08)

> Чистый эксперимент: минимальный sub-agent промт без MCP discovery checklist, без convention rules за исключением testId. MCP-сервер директивно «используй по максимуму». См. план [docs/plans/proud-pondering-jellyfish.md](../plans/proud-pondering-jellyfish.md).

## Run window

- **start**: 2026-05-08T12:31:11Z (HEAD `9691ef4`)
- **end**: 2026-05-08T12:41:33Z
- **wall-clock total** (orchestrator-side, includes coordination): **10 мин 22 сек**
- **wall-clock max(sub-agent)** (parallel): **9 мин 16 сек** (core)

## Run metrics

| target         | wall-clock (мин:сек) | total tokens | tool uses | mcp calls | tsc                        | build | LOC       |
| -------------- | -------------------- | ------------ | --------- | --------- | -------------------------- | ----- | --------- |
| core           | 9:16                 | 186 954      | 67        | 16        | ✅                         | ✅    | 2 167     |
| renderer-react | 9:01                 | 188 840      | 61        | 18        | ✅                         | ✅    | 2 339     |
| renderer-json  | 7:19                 | 190 021      | 54        | 22        | ❌ (1 err: index.tsx:1042) | ❌    | 2 223     |
| **total**      | **9:16 (max)**       | **565 815**  | **182**   | **56**    | 2/3                        | 2/3   | **6 729** |

> Token-метрика — единая `total_tokens` из Agent tool usage (input+output вместе, без разбивки).

## Notes per target

### core

- Полная форма: 6 шагов FormWizard, 60+ полей, 8 computed (`fullName`, `age`, `interestRate`, `monthlyPayment`, `paymentToIncomeRatio`, `coBorrowersIncome`, `initialPayment`, и т.д.), ~20 behaviors (copyFrom, enableWhen, computeFrom, watchField, revalidateWhen).
- Cross-field validation: `workExpCurrent ≤ workExpTotal`, `age 18-70`, `paymentToIncomeRatio ≤ 50%`, `loanAmount ≤ propertyValue-initialPayment`, mustBeTrue для согласий.
- `interestRate` formula упрощён (loanType base + region/collateral discounts) — спека не даёт точных коэффициентов.
- testId convention соблюдён.
- 16 MCP calls покрыли весь набор (FormWizard gotchas, FormArray initialValue plain leaves, computeFrom vs watchField, applyWhen-validators 3-args, validate vs validateTree).

### renderer-react

- Полная форма + `createRenderSchema` flow + `<FormRenderer fieldWrapper=FormField>`. Index.tsx тонкий (25 LOC), schema.ts 2314 LOC (включая RenderSchema tree).
- `enableWhen + resetOnDisable: true` для conditional-fields (mortgage/car/employer/business). copyFrom для адресов. Array cleanup через watchField.
- 7/8 computed реализовано; existingLoans cross-item validation не реализован — gap (см. ниже).
- 1 retry-цикл потрачен на JSX-in-`.ts` (FormArraySection itemComponent FC).
- 18 MCP calls.

### renderer-json

- Closure pattern из cookbook recipe: `FormRoot.__selfManagedChildren=true` + `<FormRenderer componentProps={{ form }}>`. FormWizard root render-node внутри FormRoot.
- 8/8 computed, 6 шагов, 3 array-секции через `FormArraySection` (control: string + `$template`).
- **tsc/build fail** на `index.tsx:1042`: `<FormRenderer componentProps={{ form }} ... />` — `componentProps` не входит в `FormRendererProps<T>`. Ошибка проявляется в момент integration с FormRenderer; sub-agent зафиксировал closure pattern из cookbook, но cookbook recipe не показывает что для core renderer-react vs renderer-json эта prop не существует на уровне типа.
- 22 MCP calls — больше всех (renderer-json complexity).

## MCP gaps (aggregated, deduplicated)

| gap-id                                           | severity | targets affected              | evidence                                                                                                                  | proposed fix                                                                                                      |
| ------------------------------------------------ | -------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| g-recipe-package-topic-syntax                    | med      | renderer-react, renderer-json | `find_recipe(topic="renderer-json/cookbook")` → 404; available-list даёт ложное обещание `package/section` синтаксиса     | Resolver принимает `package/section`, либо available-list документирует «topic — keyword без `package/` префикса» |
| g-applywhen-validators-signature-confusion       | med      | core                          | `applyWhen` в validators имеет 3 аргумента (`triggerField, condition, validatorsFn`), recipe-копии с behaviors путают LLM | Отдельный recipe `applyWhen-validators` или явная пометка двух signatures в symbol-docs                           |
| g-cross-field-validation-recipe-missing          | med      | core                          | `validate(fieldPath, validatorFn, options?)` vs `validateTree(ctx => err, { targetField })` — нет recipe с примером       | Recipe `cross-field-validation` с примерами validateTree для checkbox/age-range/payment-ratio                     |
| g-cross-item-validation-not-shown                | med      | renderer-react                | `existingLoans[].remainingAmount ≤ amount` — нет паттерна доступа к sibling-field того же item                            | Добавить в `arrays` секцию «Cross-field validation внутри array item»                                             |
| g-jsx-in-ts-when-itemcomponent-fc                | med      | renderer-react                | `schema.ts` не допускает JSX → `createElement` или вынести FC в `.tsx` (1 retry-цикл потрачен)                            | Tip в `form-array-section` recipe: «если itemComponent в `.ts` — `createElement`, либо `.tsx`»                    |
| g-renderer-json-handlesubmit-source-pattern      | med      | renderer-json                 | Cookbook не описывает регистрацию handler через `reg.source('WIZARD_SUBMIT', () => Promise<void>)`                        | В cookbook раздел «Source-функции — Handlers (onSubmit, onClick)» с примером Promise<void> source                 |
| g-renderer-json-formroot-form-prop-flow          | med      | renderer-json                 | `<FormRenderer componentProps={{ form }}>` — порядок прокидки form через RenderNodeComponent → root не описан явно        | В cookbook секция «Root render-node = FormWizard (без FormRoot)» с явным path для form prop                       |
| g-formwizard-config-shape                        | low      | core                          | `config: { stepValidations, fullValidation, onStepChange? }` — полная shape не описана                                    | В `form-wizard` recipe / symbol-docs `FormWizard` указать полный config                                           |
| g-arraysection-typed-itemschema                  | low      | core                          | Item-schema для `coBorrowers` (с вложенной `personalData`) — нет типизированного паттерна                                 | В `arrays` recipe пример с `satisfies FormSchema<ItemType>`                                                       |
| g-no-renderer-react-step-body-renderschema       | low      | renderer-react                | `step.body` shape `children` vs `componentProps.children` — неоднозначность в `wizard` recipe                             | В `wizard` recipe раздел «RenderNode body» с полным примером Section + Box + FormField                            |
| g-formschema-satisfies-best-practice             | low      | renderer-react                | `satisfies FieldConfig<T>` локализует ошибки на больших формах — не promoted как best practice                            | В `formschema` или `common-patterns` раздел «Локализация ошибок типов через `satisfies`»                          |
| g-renderer-json-input-disabled-runtime-vs-schema | low      | renderer-json                 | `componentProps.disabled` (UI-only) vs `FieldConfig.disabled` (logical) — JSON-схема не различает                         | В `formschema` / `cookbook` раздел «Read-only computed fields в JSON» с обоими вариантами                         |
| g-renderer-json-conditional-required-recipe      | low      | renderer-json                 | Conditional required (`companyName.required when employed`) — нужно собирать из 3 recipes                                 | `find_recipe(topic="conditional-validation")` или `apply-when`                                                    |

**Итого**: 0 high, 7 med, 6 low (после дедупликации).

## Что промт содержал

См. [docs/iter-prompts/sub-agent-clean.md](../iter-prompts/sub-agent-clean.md) — 144 строки.

## Раннер

См. [docs/iter-prompts/orchestrator-clean.md](../iter-prompts/orchestrator-clean.md) — 239 строк.

## Verification artifacts

- `.tmp/iter-artifacts/iter-clean-1/.start` / `.end` — timestamps
- `.tmp/iter-artifacts/iter-clean-1/{core,renderer-react,renderer-json}/dev-report.md` — 3 dev-report'а
- `projects/react-playground/src/pages/examples/mcp-credit-application-{core,renderer-react,renderer-json}-clean/` — сгенерированный код
- App.tsx merge applied: 3 routes (`/mcp-credit-application-{target}-clean`)

## Decision

Единичный замер baseline. Не запускать новый цикл по этому RUN_ID — отчёт сохраняется в repo как точка сравнения для будущих оптимизаций промта / MCP recipes.

**Ключевые наблюдения**:

- 565k tokens / max 9:16 wall-clock на 3 параллельных sub-agent'а — это нижняя граница «sub-agent с MCP, без orchestrator-обвязки». Для сравнения, iter-18 с full obвязкой = ~590k tokens.
- 2/3 targets passed tsc + build. renderer-json упал на интеграции `FormRenderer componentProps prop` — известный архитектурный gap (cookbook recipe закрывает его ровно через closure pattern, который sub-agent применил, но компилятор всё равно поджимает на пропе).
- 13 уникальных MCP gap'ов (после дедупа) — главный output эксперимента, можно использовать как backlog для улучшения MCP recipes.

# Dev Plan — MCP Credit Application v9 (target=core)

## Цель

Iter-9 регрессионная страница для проверки patches H + I + J + K + Bug-A/B fixes
на target=core (plain React + @reformer/core + @reformer/ui-kit).

## (A, B) пара

- **A = A1** — `FormWizard` из `@reformer/ui-kit/form-wizard` (ui-kit стек определён по
  наличию `@reformer/ui-kit` в `package.json` → дефолт по Patch G).
- **B = B1** — JSX-conditional sub-sections внутри step body компонентов
  (`Step1Body`, `Step3Body`, `Step4Body`, `Step5Body` читают свои "переключатели"
  через `useFormControlValue` и условно рендерят блоки).

## Итог по patches под тест

| Patch | Статус | Реализация |
|---|---|---|
| **G** | ✅ | A1 выбран т.к. `@reformer/ui-kit` есть в `projects/react-playground/package.json`. `FormWizard` импортируется из `@reformer/ui-kit/form-wizard`. |
| **H** | ✅ | `readOnly: true` (camelCase) на 7 computed-полях; `maxLength: 500` (camelCase) на `loanPurpose` Textarea. `readonly`/`maxlength` нигде не используются. |
| **I** | ✅ | `computeFrom([path.personalData], path.fullName, …)` и `…path.age, …` — подписка на group node, deconstructing `personalData` внутри. БЕЗ `as never`. |
| **J** | N/A | `path.X` vs `form.X` правило применяется внутри `RenderSchema`. target=core использует `control.X` (FieldNode) напрямую — patch не активируется. |
| **K** | N/A | `model` vs `selector` semantics — renderer-json-only. target=core рендерит через React JSX + `<FormField control={…}>`, JSON-нода вообще нет. |
| **D1** | ✅ | Каждый Select/RadioGroup в `formSchema` имеет `componentProps.options`. |
| **D3** | ✅ | `FormArray.AddButton initialValue` через `createPropertyItem()` / `createExistingLoanItem()` / `createCoBorrowerItem()` — возвращают plain primitives, не FieldConfig. |

## Iter-7/8 critical rules — соблюдение

- **Patch B**: union-literal leaves (`LoanType`, `EmploymentStatus`, `MaritalStatus`, …)
  — plain `type` aliases, НЕ extends FormFields.
- **Patch D**: componentProps (`label`, `options`, `placeholder`, `mask`, `rows`, `type`)
  все в `createForm` schema, не в JSX.
- **testId convention dotted-path**: `step1.loanAmount`, `step2.personalData.lastName`,
  `step5.property.estimatedValue` и т.д. — через `<FormField testId=…>` + `data-testid="step-N"`
  на корне step body.
- **Conditional fields через JSX-conditional**: `{isMortgage && (...)}`, `{!sameAsRegistration && (...)}`.
- **Cycle prevention**: 3 `watchField`-а (`hasProperty`, `hasExistingLoans`, `hasCoBorrower`) —
  все с `{ immediate: false }` + `Array.isArray(cur) && cur.length > 0` length-guard перед `.clear()`.
- **НИКАКИХ FieldConfig в FormArray initialValue**: 3 item-factory возвращают чисто
  данные (`PropertyItem`, `ExistingLoanItem`, `CoBorrowerItem`).
- **НИКАКОГО enableWhen на ArrayNode**: `properties[]`, `existingLoans[]`, `coBorrowers[]`
  управляются через `hasItems` prop FormArraySection + watchField для clearing.

## Структура файлов

| Файл | Назначение | Размер |
|---|---|---|
| `types.ts` | Union literals + nested sub-types + 3 array-item types + root `CreditApplicationForm` | ~150 строк |
| `schema.ts` | Constants (option lists), 6 sub-schemas, root formSchema, behavior, 6 step validators + fullValidation, item factories, createCreditApplicationForm | ~700 строк |
| `data-fixture.ts` | typed `happyPathFixture: CreditApplicationForm` (consumer + employed + no arrays) | ~115 строк |
| `index.tsx` | 6 memo'd Step bodies, 3 array item bodies, STEPS config, page component с FormWizard + dev-only fill button | ~530 строк |
| `dev-plan.md` | Этот файл | — |
| `dev-report.md` | Финальный отчёт по итогу прохода | — |

## Risk matrix

| Риск | Вероятность | Митигация |
|---|---|---|
| FormWizard импорт сломан после ui-kit refactor (Path C) | низкая | Импорт из `@reformer/ui-kit/form-wizard` — subpath export подтверждён в `package.json`. tsc clean. |
| computeFrom group-subscription регрессия | средняя | Подписка на `[path.personalData]` (group node), внутри callback расшифровываем `personalData as PersonalData \| undefined`. |
| `as never` cast где-то проскочил | низкая | Grep по `as never` — 0 hits в v9. |
| FormArraySection требует другую сигнатуру в новой версии | низкая | API из v8 без изменений (`title`, `control`, `itemComponent`, `hasItems`, `initialValue`). |
| Cycle при `copyFrom registrationAddress → residenceAddress` | низкая | `copyFrom` библиотечный, имеет внутреннюю защиту от цикла. |
| Dev-only кнопка не работает в build (production preview) | приемлемая | `import.meta.env.DEV` корректно tree-shake'ится Vite — кнопка пропадает из prod bundle. |

## Стратегия реализации

Iter-8 v8 страница (target=core, A1+B1) уже верифицирована orchestrator'ом и прошла
playwright happy-path в 1 проход. Iter-9 проверяет, что после patches J+K (не
затрагивающих core) ничего в core flow не сломалось → копируем v8 структуру файлов
с обновлёнными комментариями (referencing patch H+I+J+K explicitly), финальная
кнопка / route / namespace переименованы.

Ключевой gating-критерий: `npx tsc --noEmit` exit 0 в `projects/react-playground/`.

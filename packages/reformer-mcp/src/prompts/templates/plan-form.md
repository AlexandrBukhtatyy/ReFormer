# План разработки формы: {{formName}}

> Сгенерировано MCP-промптом `plan-form` на основе спеки `{{specPathRel}}`.
> Target stack: **`{{target}}`**.

## 0. Prerequisites — sub-agents МUST read these via ReadMcpResourceTool

Перед стадиями 2–6 (см. roadmap ниже) каждый sub-agent обязан прочитать:

- `reformer://docs/core/quick-start-minimal-working-form`
- `reformer://docs/core/formschema-format-critically-important`
- `reformer://docs/core/array-schema-format`
- `reformer://docs/core/multi-step-form-validation`
- `reformer://docs/core/cycle-detection-prevention-checklist` (КРИТИЧНО для стадии Behaviors)
- `reformer://docs/core/common-patterns`
- `reformer://docs/core/common-mistakes`
- `reformer://docs/core/extended-common-mistakes`
- `reformer://docs/cdk/formwizard-indicator`
- `reformer://docs/cdk/formwizard-actions`
- `reformer://docs/cdk/formarrayhandle-api`
- Directory layout — `find_recipe directory-layout` (раскладка файлов формы для `{{target}}`; для renderer-json — app-level base registry + DSL meta-schema)
  {{rendererPrereqs}}

Без этого sub-agent работает вслепую — рискует cycle-prevention нарушением, plain-leaf corruption, неверными импортами.

## 1. Анализ спеки

- **Структура:** {{stepsLine}}
- **Полей всего:** {{totalFields}}
- **Conditional поля** (показываются по условию): {{conditionalLine}}
- **Computed поля** (Вычисляется автоматически): {{computedLine}}
- **Arrays / FormArray:** {{arraysLine}}
- **API endpoints** (для load-options/async-валидации/submit):
  - {{apiLine}}
- **Канонические тексты:** {{canonicalLine}}
- **Маски:** {{masksLine}}

### 1.1 Walkthrough «Поведение при изменении полей и зависимости» (обязательно)

Спека форм-приложения почти всегда содержит **отдельную таблицу** behavioural-правил (cross-validations, reset cascades, async loaders, warnings/hints, dynamic limits, conditional hints) — она НЕ дублирует таблицу полей. Sub-agent ОБЯЗАН перебрать **каждую строку** этой таблицы и явно классифицировать:

- **In scope** — будет реализовано в текущей итерации (укажи в каком стадии: validation / behavior / wizard / index UI).
- **Deferred** — отложено (укажи причину: нужен API не описанный в спеке; требует AsyncValidator-pattern; UI-feature вне core-промптов; и т.д.).
- **Not relevant** — не релевантно для target'а (например, async loader не имеет смысла для target=core если api-mock отсутствует).

Молчаливое опущение запрещено. Эта классификация — ВХОД в dev-plan.md и ВЫХОД в dev-report.md (секция «Spec gaps»).

Типичные категории правил, которые легко пропустить:

| Категория             | Где в спеке                             | Признаки                                                                      |
| --------------------- | --------------------------------------- | ----------------------------------------------------------------------------- |
| Cross-validations     | таблица «Поведение при изменении полей» | колонка type=`Кросс-валидация`                                                |
| Reset cascades        | то же                                   | `Сброс зависимых` (carBrand→carModel, region→city)                            |
| Dynamic limits        | то же                                   | `Динамические лимиты` (loanAmount.max от totalIncome, loanTerm.max от age)    |
| Conditional required  | то же                                   | `Условная валидация` (additionalIncome>0 → additionalIncomeSource обязателен) |
| Async loaders         | то же                                   | `Динамическая загрузка` + debounce                                            |
| Warnings / Hints      | то же                                   | `Предупреждение` / `Условное сообщение`                                       |
| Revalidation triggers | то же                                   | `Ревалидация` (totalIncome change → revalidate paymentToIncomeRatio)          |

## 2. Detected стек

{{stackBlock}}

{{deepAnalysisBlock}}

## 3. Этапы разработки (sub-agent roadmap)

Рекомендуемый порядок MCP-промптов: {{promptOrder}}.

| #   | Стадия                 | MCP-prompt                          | Артефакты                                           | Verification (orchestrator)                                                                                                                        |
| --- | ---------------------- | ----------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Planning**           | `plan-form` (этот)                  | возврат markdown в чате                             | Orchestrator валидирует план: ≥6 секций, risk matrix, ≥5 verification scenarios.                                                                   |
| 2   | **Types**              | (нет prompt)                        | `types.ts`                                          | `tsc --noEmit` clean + grep: число properties в interface ≈ {{totalFields}}.                                                                       |
| 3   | **FormSchema + UI**    | `create-form` (`target={{target}}`) | `schema.ts` + `index.tsx`{{rendererArtifactSuffix}} | Playwright: рендер {{stepsCountText}} step section, screenshots, 0 console errors, все спека-поля имеют `[data-testid^="input-"]`.                 |
| 4   | **Validation**         | `add-validation`                    | `validation:` блок в `schema.ts` + submit handler   | Playwright: empty submit → specific Russian errors совпадают с canonical messages из спеки. Generic `"Поле обязательно для заполнения"` = failure. |
| 5   | **Behaviors**          | `add-behavior`                      | `behavior:` блок в `schema.ts`                      | Playwright: trigger каждый behavior из секции 5 ниже, assert effects (computed cascade, copyFrom, hide-on-condition).                              |
| 6   | **FormArray + Wizard** | `add-form-array` + `add-wizard`     | template factories, StepIndicator, nav, setHidden   | Playwright: walk all {{stepsTextOrSix}} steps, chip click navigation, FormArray add/remove с правильными default'ами (НЕ `[object Object]`).       |
| 7   | **Report**             | (sub-agent сам пишет)               | `dev-report.md`                                     | Orchestrator проверяет: использованные MCP tools перечислены, все 7 верификаций отмечены, новые gaps зафиксированы.                                |

## 4. Risk matrix (must-not-do)

| ⚠️  | Что не делать                                                                      | Почему                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `enableWhen` + `resetOnDisable: true` на whole `ArrayNode`                         | Browser hang на mount (verified iter-1). Условный показ массива гейти в JSX/setHidden.                                                          |
| 2   | Conditional fields через `enableWhen` (loanType/employmentStatus)                  | Visible-disabled = visual spam. Используй JSX-conditional для core, `hideWhen`/`setHidden` для renderer-react/json.                             |
| 3   | `FormArray.AddButton initialValue` = FieldConfig (`{ value, component }`)          | Silent corruption: `[object Object]` в Textarea, checkbox flip true. Template factory возвращает PLAIN leaf values.                             |
| 4   | `watchField` без `{ immediate: false }` или без value-equality guard на `setValue` | Реактивный цикл, browser hang. Каждый `watchField` — `{ immediate: false }` + `if (ctx.form.X.value.value !== next) ctx.form.X.setValue(next)`. |
| 5   | `testId` с дефисами или с одним leaf-name                                          | Collisions при дублирующихся именах в разных шагах. Convention: dotted-path (`step1.loanAmount`, `step2.passportData.series`).                  |
| 6   | Reшreстуктурировать спеку (collapse/drop/move fields)                              | Spec literal: каждое поле спеки = отдельное поле в FormSchema, в том же шаге, с тем же именем.                                                  |
| 7   | Дефолтные английские placeholder `"Select an option..."` или выдуманные label      | User-facing strings берём из спеки (canonical labels table) или задаём по шаблону спеки на родном языке.                                        |

## 5. Verification scenarios (playwright)

| #   | Сценарий               | Шаги                                                                     | Ожидаемый результат                                                                                         |
| --- | ---------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 1   | Initial render         | Navigate to the form's route                                             | {{stepsTextOrOne}} step section в DOM, 0 console errors, header виден.                                      |
| 2   | Empty submit step 1    | Click `[data-testid="wizard-next"]` без заполнения                       | 2+ specific Russian errors из canonical messages, `h2` остаётся "Шаг 1...".                                 |
| 3   | Conditional reveal     | Switch loanType → "Ипотека"                                              | `propertyValue`/`initialPayment` появились (DOM contains testIds); `carBrand`/Model/Year/Price скрыты.      |
| 4   | Cascade computed       | Set monthlyIncome=120000 + additionalIncome=20000                        | `totalIncome` = 140000 (read disabled `<input>` value).                                                     |
| 5   | copyFrom toggle        | Check `sameAsRegistration`                                               | residenceAddress поля = registrationAddress поля.                                                           |
| 6   | FormArray plain-leaves | Step 5: toggle hasProperty + click "+ Добавить"                          | Item #2 description="" (placeholder visible), hasEncumbrance=false, type="Квартира". НЕТ `[object Object]`. |
| 7   | Chip back-navigation   | После step 3 click chip 1                                                | Header = "Шаг 1...", chip 1 active blue.                                                                    |
| 8   | End-to-end happy path  | Заполнить {{stepsCountText}} шагов canonical happy-path данными → submit | console.log values JSON, alert "Заявка отправлена".                                                         |

## 6. Test fixtures

### Happy-path (consumer кредит, минимум conditional полей)

```json
{
  "step1": {
    "loanType": "consumer",
    "loanAmount": 500000,
    "loanTerm": 24,
    "loanPurpose": "Покупка бытовой техники для дома"
  },
  "step2": {
    "personalData": {
      "lastName": "Петров",
      "firstName": "Иван",
      "middleName": "Сергеевич",
      "birthDate": "1990-05-15",
      "gender": "male",
      "birthPlace": "Москва"
    },
    "passportData": {
      "series": "1234",
      "number": "123456",
      "issueDate": "2010-06-20",
      "issuedBy": "УВД района Тверское г. Москвы",
      "departmentCode": "770-001"
    },
    "inn": "123456789012",
    "snils": "123-456-789 00"
  },
  "step3": {
    "phoneMain": "+7 (916) 123-45-67",
    "email": "ivan@example.com",
    "registrationAddress": {
      "region": "Москва",
      "city": "Москва",
      "street": "Тверская",
      "house": "5",
      "apartment": "12",
      "postalCode": "125009"
    },
    "sameAsRegistration": true
  },
  "step4": {
    "employmentStatus": "employed",
    "companyName": "ООО Ромашка",
    "companyInn": "7701234567",
    "companyPhone": "+7 (495) 123-45-67",
    "companyAddress": "Москва, Пресненская набережная, 12",
    "position": "Инженер",
    "workExperienceTotal": 60,
    "workExperienceCurrent": 24,
    "monthlyIncome": 120000
  },
  "step5": {
    "maritalStatus": "single",
    "dependents": 0,
    "education": "higher",
    "hasProperty": false,
    "hasExistingLoans": false,
    "hasCoBorrower": false
  },
  "step6": {
    "agreePersonalData": true,
    "agreeCreditHistory": true,
    "agreeTerms": true,
    "confirmAccuracy": true,
    "electronicSignature": "Петров Иван Сергеевич"
  }
}
```

### Edge case (mortgage + 2 properties + 1 existing loan + 1 co-borrower)

Использует step1.loanType="mortgage" + propertyValue=8000000 + step5 toggles ON + array push.
Полная JSON-структура — реализуется sub-agent'ом по канонам выше при stage 6.

---

## Финальный чек-лист (sub-agent stage 1 включает в свой report)

- [ ] План загружен и понят (этот документ).
- [ ] Sub-agent stage 2 (Types) знает: {{totalFields}} fields, {{steps}} steps, conditional list, computed list, arrays.
- [ ] Sub-agent stage 3 (FormSchema+UI) использует **target=`{{target}}`** + canonical strings из спеки.
- [ ] Sub-agent stage 4 (Validation) использует canonical messages, добавляет `{ message }` к каждому validator.
- [ ] Sub-agent stage 5 (Behaviors) применяет 8 watchField + copyFrom + enableWhen с cycle-prevention.
- [ ] Sub-agent stage 6 (FormArray + Wizard) использует PLAIN leaves в template + lucide-icons + clickable chips + progress text.
- [ ] Sub-agent stage 7 (Report) фиксирует план vs реализация.

> **Важно:** используй этот план как контракт. Если хочешь отойти от него (упростить, поменять order стадий) — сначала verify с orchestrator'ом, не делай самостоятельно.

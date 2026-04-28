# План: iteration 4 — MCP-валидация с этапом planning + verification gates

## Context

Iter-1/2/3 валидировали MCP-сервер через постепенное наращивание правил в промптах. К концу iter-3 sub-агенты выходили на работающий код за 1 проход без retry, но **отсутствовал этап планирования** — sub-agent сразу шёл в реализацию без формального плана работ. Это приводило к двум типам проблем:

1. **Дрейф спеки** (D5/D16 из iter-3): sub-agent сам решал, какие поля «не критичны», объединял `carBrand+carModel`, переносил `hasProperty` из step5 в step4.
2. **Inconsistent test convention** (D6 из iter-3): на каждой странице sub-agent изобретал свои testIds (`step1.x` vs `step1-x`) — нет общего execution plan, который зафиксировал бы конвенции.

Iter-4 добавляет:
- **Новый MCP prompt `plan-form`** — принимает спеку формы, возвращает структурированный markdown-план разработки с фазами, рисками и verification-чеклистами.
- **Гранулярные sub-agent стадии** — 7 sub-агентов на страницу вместо одного, с **orchestrator playwright verification gates** между каждой стадией. Если стадия не прошла верификацию — orchestrator патчит MCP/доки и перезапускает только эту стадию, не всю страницу.

Цель: убедиться, что MCP-планирование (а) реально улучшает spec-compliance, (б) sub-агенты успешно работают в гранулярном режиме без regression к iter-3 уровню (1 проход).

## MCP changes

### Новый промпт `plan-form`

**Файл:** `packages/reformer-mcp/src/prompts/plan-form.ts` (NEW)

**Сигнатура:**
```typescript
export const planFormPromptDefinition = {
  name: 'plan-form',
  description: 'Прочитать спеку формы, проанализировать её и вернуть структурированный markdown-план разработки: список этапов, рекомендуемая последовательность других MCP-промптов, risk matrix (cycle-prevention, plain-leaves, hide-vs-disable), verification checklist для playwright.',
  arguments: [
    { name: 'specPath', description: 'Абсолютный или относительный путь к markdown-спеке формы. Например: docs/specs/credit-application-form.md', required: true },
    { name: 'target', description: 'Целевой стек: "core" | "renderer-react" | "renderer-json". По умолчанию "core".', required: false },
    { name: 'projectPath', description: 'Путь к каталогу проекта для auto-detection стека (как в create-form). По умолчанию process.cwd().', required: false },
  ],
};
```

**Вход:**
- Читает спеку через `readFileSync(specPath)` с fallback на cwd-relative.
- Запускает `detectProjectStack(projectPath)` — переиспользует [`packages/reformer-mcp/src/utils/project-detector.ts`](../../packages/reformer-mcp/src/utils/project-detector.ts).
- Извлекает из спеки секции (regex по `^## Поля формы`, `^## Сценарии`, `^## API интеграция`, `^## Canonical user-facing strings`).

**Output (markdown в `messages[0].content.text`):**
```
# План разработки формы <name>

## 1. Анализ спеки
- Шагов: N (если multi-step)
- Полей всего: M (с разбивкой по группам, computed, conditional, arrays)
- Conditional поля: список с триггерами
- Computed поля: список с формулами + dependencies
- Arrays: список с item-shapes
- API endpoints: список (для async-валидации/load-options)

## 2. Detected стек
(вывод renderStackDetectionBlock — переиспользуем из project-detector.ts)

## 3. Этапы разработки (sub-agent roadmap)
| # | Стадия | MCP-prompt | Артефакты | Verification (orchestrator) |
|---|--------|------------|-----------|------------------------------|
| 1 | Types | (нет prompt) | types.ts | tsc + grep counts spec fields vs interface |
| 2 | FormSchema + UI | create-form | schema.ts + index.tsx | playwright: render все 6 step section, screenshots |
| 3 | Validation | add-validation | schema.ts validation block | playwright: empty submit → specific Russian errors |
| 4 | Behaviors | add-behavior | schema.ts behavior block | playwright: trigger каждый behavior, assert effect |
| 5 | FormArray | add-form-array | template factories + ui | playwright: add/remove, plain leaves verify |
| 6 | Wizard | add-wizard | StepIndicator + nav + setHidden | playwright: walk all steps, per-step validation |
| 7 | Report | (нет prompt, sub-agent сам) | dev-report.md | review-checklist matched against spec |

## 4. Risk matrix (must-not-do)
- ⚠️ enableWhen + resetOnDisable на whole ArrayNode → browser hang.
- ⚠️ Conditional fields (loanType/employmentStatus) → hide via JSX-conditional / setHidden, НЕ enableWhen.
- ⚠️ FormArray.AddButton initialValue → PLAIN leaf values (не FieldConfig).
- ⚠️ Cycle prevention: каждый watchField immediate:false + value-equality guard.
- ⚠️ testId convention — dotted-path (step1.loanAmount), не dashes.
- ⚠️ Spec literal — все поля из спеки в schema, без collapsing/dropping/moving.
- ⚠️ user-facing strings из спеки (canonical labels table), не выдумывать.

## 5. Verification scenarios для orchestrator
1. **Initial render**: 6 step sections в DOM, 0 console errors.
2. **Empty submit step 1**: 2 ошибки видимы (loanAmount, loanPurpose).
3. **loanType=mortgage**: propertyValue/initialPayment появились; carBrand/Model/Year/Price скрыты.
4. **sameAsRegistration=true**: residenceAddress mirror registrationAddress.
5. **monthlyIncome=120000 + additionalIncome=20000**: totalIncome=140000.
6. **Step 5 toggle hasProperty**: array section появилась, "+ Добавить" → 2 cards с правильными default'ами.
7. **Wizard chip 1 click из step 3**: возврат на step 1.
8. **End-to-end**: happy-path заполнение → step 6 submit → console.log values.

## 6. Test fixtures
- Happy-path (consumer кредит, без property/loans/coBorrowers): inline JSON.
- Edge case (mortgage + 2 properties + 1 loan + 1 co-borrower): inline JSON.
```

**Реализация:** функция `getPlanFormPrompt(args)` использует:
- `readFileSync(args.specPath, 'utf-8')` для чтения спеки.
- `detectProjectStack(args.projectPath)` для stack-blocks.
- Парсит спеку regex'ами: `## Поля формы` секция → разбивает на step1..stepN таблицы → подсчитывает поля.
- Возвращает один user-message с markdown-планом по шаблону выше.

**Регистрация:** `packages/reformer-mcp/src/prompts/index.ts` — добавить строку:
```typescript
export { planFormPromptDefinition, getPlanFormPrompt } from './plan-form.js';
```

И в `packages/reformer-mcp/src/server.ts` (или где регистрируются промпты — найти через grep `addValidationPromptDefinition` если index.ts только реэкспортирует) — добавить в массив prompts.

## Iter-4 workflow per page (3 страницы × 7 sub-агентов = 21 sub-agent run)

Каталоги для трёх страниц (orchestrator создаёт stub'ы перед запуском):
- `projects/react-playground/src/pages/examples/mcp-credit-application-v4/` (target=core)
- `projects/react-playground/src/pages/examples/mcp-credit-application-renderer-v4/` (target=renderer-react)
- `projects/react-playground/src/pages/examples/mcp-credit-application-renderer-json-v4/` (target=renderer-json)

### Стадии (одинаковы для всех 3 страниц)

| # | Sub-agent | Что делает | Orchestrator verification после |
|---|-----------|-----------|--------------------------------|
| 1 | **Planning** | Вызывает `plan-form` через JSON-RPC, читает план, **возвращает план в финальном сообщении** (orchestrator сохраняет в `<page-dir>/dev-plan.md`) | Orchestrator валидирует план: secций ≥ 6, risk matrix присутствует, verification scenarios ≥ 5. |
| 2 | **Types** | Реализует `types.ts` с интерфейсом `CreditApplicationForm` + sub-types (with `extends FormFields`) | `tsc --noEmit` clean + grep считает поля в спеке vs `interface` properties (должно совпадать). |
| 3 | **FormSchema + UI rendering** | Реализует `schema.ts` (createForm + form-only) + `index.tsx` (рендеринг всех 6 step sections вертикально, без wizard) | Playwright: navigate `/examples/mcp-credit-v4`, snapshot DOM, screenshot fullpage. Assert: все спека-поля имеют `[data-testid^="input-"]` matching dotted-path, 0 console errors. |
| 4 | **Validation** | Добавляет `validation: (path: any) => {...}` блок + submit handler | Playwright: click submit, scrape `.text-destructive` элементы. Assert: error messages совпадают с canonical messages из спеки. Если хоть один generic — failure. |
| 5 | **Behaviors** | Добавляет `behavior: (path: any) => {...}` блок (8 watchField + enableWhen + copyFrom) | Playwright: 5 verification scenarios из плана: change loanType→interestRate update, mortgage→propertyValue visible, sameAsRegistration→copyFrom, monthlyIncome change → totalIncome cascade, fullName concat. |
| 6 | **FormArray + Wizard** | Превращает 3 array fields в FormArray с add/remove + оборачивает в multi-step wizard со StepIndicator | Playwright: walk through 6 steps with happy-path data, verify chip transitions, click chip 1 from step 3 (back-nav), toggle hasProperty → add 2 properties → verify plain-leaves. |
| 7 | **Report** | Sub-agent читает все свои файлы + `dev-plan.md`, пишет `<page-dir>/dev-report.md` с раскладкой «план vs реализация», использованные MCP tools, найденные gaps | Orchestrator читает report, добавляет в финальный `credit-application-mcp-report-v4.md` соответствующую секцию. |

### Failure handling

Если playwright verification после стадии N вернул failure:
1. Orchestrator анализирует, что именно сломалось.
2. Если это **новый MCP gap** (не покрыт текущими промптами) — orchestrator патчит соответствующий промпт (`packages/reformer-mcp/src/prompts/<name>.ts`), пересобирает MCP (`npm run build -w @reformer/mcp`).
3. Orchestrator удаляет файлы, созданные провалившимся sub-agent'ом (только текущей стадии, не всей страницы).
4. Orchestrator спавнит **новый sub-agent** на ту же стадию N со свежим контекстом.
5. Если стадия 1 (planning) провалилась — это критично, означает что `plan-form` сломан; orchestrator сначала фиксит prompt, потом перезапускает.

## Files

**Создаются:**
- `packages/reformer-mcp/src/prompts/plan-form.ts` (NEW) — реализация промпта.
- `projects/react-playground/src/pages/examples/mcp-credit-application-v4/{dev-plan,dev-report}.md` + `{types,schema}.ts` + `index.tsx`.
- `projects/react-playground/src/pages/examples/mcp-credit-application-renderer-v4/...` (то же + `render-schema.tsx`).
- `projects/react-playground/src/pages/examples/mcp-credit-application-renderer-json-v4/...` (то же + `registry.tsx` + `render-schema.ts` + `array-blocks.tsx`).
- `docs/specs/credit-application-mcp-report-v4.md` — финальный отчёт по iter-4.

**Модифицируются:**
- `packages/reformer-mcp/src/prompts/index.ts` — реэкспорт нового промпта.
- `packages/reformer-mcp/src/server.ts` (или эквивалент) — регистрация нового промпта в массиве prompts (найти через grep при имплементации).
- `projects/react-playground/src/App.tsx` — 3 импорта + 3 routes + 3 nav-entries для v4 страниц.

**Не трогаются** (правка ниже scope):
- `packages/reformer-mcp/src/prompts/{create-form,add-validation,add-behavior,add-form-array,add-wizard}.ts` — текущие правила достаточны, новый `plan-form` их дополняет, не переопределяет.
- `docs/specs/credit-application-form.md` — спека уже включает canonical labels table из iter-3.
- `PROMT.md` — обновим только если по ходу iter-4 выяснится что-то фундаментально новое.

## Verification (как протестировать iter-4 end-to-end)

После имплементации `plan-form` промпта:

1. **Smoke-test промпта** через JSON-RPC helper:
   ```bash
   node scripts/mcp-call.mjs prompts/get '{"name":"plan-form","arguments":{"specPath":"docs/specs/credit-application-form.md","target":"core","projectPath":"projects/react-playground"}}'
   ```
   Output должен содержать: «План разработки формы», 6 секций, risk matrix с 7 пунктами, verification scenarios ≥ 5, detected stack `@reformer/ui-kit + Tailwind v4`.

2. **Запустить iter-4 на page 1** (target=core):
   - Создать stub `mcp-credit-application-v4/index.tsx`.
   - Зарегистрировать route в App.tsx.
   - Спавнить sub-agent #1 (planning) → проверить план.
   - Спавнить sub-agent #2 (types) → tsc + grep field count.
   - ... и так по всем 7 стадиям.
   - На каждой стадии orchestrator делает playwright verification по чеклисту из плана.

3. **Финальная приёмка page 1**:
   - Build чистый.
   - Все 8 verification scenarios из плана зелёные в playwright.
   - 0 console errors.
   - `dev-plan.md` + `dev-report.md` в каталоге страницы.

4. **Повторить для page 2 + page 3** (renderer-react, renderer-json).

5. **Финальный отчёт** `docs/specs/credit-application-mcp-report-v4.md`:
   - Сколько sub-agent retries было на каждой стадии каждой страницы.
   - Какие новые MCP gaps вскрылись (если есть).
   - Как `plan-form` повлиял на spec-compliance vs iter-3 (D5, D6 — закрыты ли литерально без human-intervention).

## Out of scope этого плана

- **MCP-changes за пределами `plan-form`**: текущие промпты не правим (они стабильны после iter-3).
- **Изменения в спеке**: уже содержит canonical labels из iter-3.
- **`PROMT.md`**: переписывать пока не нужно — iter-4 brief можно держать в этом плане.
- **Параллельный запуск sub-агентов между стадиями**: стадии последовательны (planning → types → schema+UI → ...), так как каждая зависит от предыдущей. Параллельность только между страницами (page 1/2/3 могут идти одновременно после своих stage 1).
- **Регистрация в App.tsx через sub-agent**: только orchestrator (sub-agent forbidden от App.tsx).
- **Коммиты по ходу работы**: согласно правилу из CLAUDE.md, коммиты только по явному запросу пользователя.

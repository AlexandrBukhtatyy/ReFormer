# form-listing — target={TARGET}, run={RUN_ID}

> Sub-agent (paper mode) заполняет этот шаблон в Step 3–4.
> Файл: `.tmp/iter-artifacts/{RUN_ID}/{TARGET}/form-listing.md`.
> **DRY-RUN листинг: код в приложение НЕ пишется.** Код ниже — то, что агент СОЗДАЛ БЫ.
> Orchestrator (`orchestrator-md.md`) парсит этот файл в Step 3 (детерминированные проверки C1–C9).
>
> Три секции пользователя (`## 1`, `## 2`, `## 3`) — обязательный позвоночник файла.
> Файл должен читаться «дерево → код → ошибки». Метаданные и self-check вложены в §3.

---

## 0. Метаданные

| поле            | значение                                |
| --------------- | --------------------------------------- |
| run             | {RUN_ID}                                |
| target          | {TARGET}                                |
| stack           | core \| renderer-react \| renderer-json |
| spec            | {SPEC_PATH}                             |
| started / ended | `<ISO>` / `<ISO>`                       |
| mcp calls       | N                                       |
| status          | ok \| partial \| blocked \| tainted     |

---

## 1. Структура файлов

> Дерево файлов, которое агент СОЗДАЛ БЫ (не создаёт). Показывай реальные пути.

```
projects/react-playground/src/pages/debug/mcp-credit-application-{TARGET}-{RUN_ID}/
├── index.tsx
├── types.ts
├── model.ts
├── form.schema.ts       # renderer-json: документ формата 2 в defineJsonSchema<T>
├── form.behavior.ts
├── form.validation.ts
├── form.flow.ts         # по необходимости: шаги визарда
├── form.messages.ts     # по необходимости: словарь текстов ошибок
├── data-sources.ts
├── api.ts
└── registry.ts          # только renderer-json
```

**Coverage (self-reported):** steps N/6 · computed N/8 · arrays N/3 · fields ~N/~80 · conditional-groups N/8

---

## 2. Листинг кода по каждому файлу

> **ПОЛНЫЙ код каждого файла.** Без сокращений, без `// остальные поля аналогично`,
> без `// ...`, без плейсхолдеров. Каждое поле спеки выписано явно.
> Orchestrator считает leaf-поля / `testId:` по этому тексту (C1/C2) — элизия обнуляет coverage.

### 2.1 `.../mcp-credit-application-{TARGET}-{RUN_ID}/form.schema.ts`

```ts
<полный исходник — без сокращений; renderer-json: документ формата 2 в defineJsonSchema<T>>
```

### 2.2 `.../mcp-credit-application-{TARGET}-{RUN_ID}/index.tsx`

```tsx
<полный исходник — без сокращений>
```

### 2.3 `.../mcp-credit-application-{TARGET}-{RUN_ID}/registry.ts` (renderer-json only)

```ts
<полный исходник — без сокращений; для core / renderer-react: удалить эту подсекцию>
```

### 2.4 Остальные файлы раскладки

> По подсекции на файл из §1: `types.ts`, `model.ts`, `form.behavior.ts`, `form.validation.ts`,
> `data-sources.ts`, `api.ts` (+ `form.flow.ts` / `form.messages.ts`, если есть). То же правило полноты.

#### 2.4.N `.../mcp-credit-application-{TARGET}-{RUN_ID}/<файл>`

```ts
<полный исходник — без сокращений>
```

---

## 3. Ошибки с которыми столкнулся

### 3.1 Paper-compile self-check

> Единственный «компилятор» на бумаге — MCP-tool `validate_form` (`kind="json-schema"` и `kind="behaviors"`).
> Прогони его на СВОЁМ листинге. Это MCP-tool, значит sandbox-legal.

- **validate_form kind=json-schema** (только renderer-json): `valid: true|false`; `errors: [...]`
  - для core / renderer-react: `n/a — target не JSON-DSL`
- **validate_form kind=behaviors** (все target'ы): `cycles: none | [a→b→a]`; `self-refs: none | [...]`
  - Дерево зависимостей computed / copyFrom, которое передал в `validate_form(kind="behaviors")`:

  | target field         | reads (зависимости)                                |
  | -------------------- | -------------------------------------------------- |
  | interestRate         | loanType, ...                                      |
  | monthlyPayment       | loanAmount, loanTerm, interestRate                 |
  | initialPayment       | ...                                                |
  | fullName             | personalData.lastName, ...firstName, ...middleName |
  | age                  | personalData.birthDate                             |
  | totalIncome          | monthlyIncome, additionalIncome                    |
  | paymentToIncomeRatio | monthlyPayment, totalIncome                        |
  | coBorrowersIncome    | coBorrowers[].monthlyIncome                        |

- **Type-risk spots** (что верю, что скомпилируется, но БЕЗ tsc доказать не могу):
  - `<файл:≈строка>` — `<почему может не скомпилироваться — overload / prop-flow / union widening>`
  - (если таких нет — `_None flagged._`, но будь честен: отсутствие tsc не значит отсутствие ошибок)

### 3.2 MCP gaps (структурированные)

> Каждый gap — реальная ситуация, когда MCP не дал нужный ответ или дал misleading.
> Это **главный output** paper-агента.

- **g-{slug-1}** [severity: high|med|low]
  - **what I needed**: `<цель>`
  - **MCP query**: `find_recipe(topic="X")` | `get_symbol_docs(symbol="Y")`
  - **MCP response**: `<цитата 1-3 строки | "no result">`
  - **why it's a gap**: `<почему ответ не закрыл вопрос>`
  - **workaround applied**: `<как решил | "marked as type-risk, unresolved on paper" | "fallback to node_modules .d.ts inspection">`
  - **proposed patch direction**: `<новый recipe / extra example / правка template в packages/reformer-mcp/>`

- **g-{slug-2}** [severity: med]
  - ...

(Если gap'ов нет — `_None — MCP closed all questions._`)

### 3.3 Калибровочный сигнал (машиночитаемый)

```yaml
coverage: { steps: N, computed: N, arrays: N, fields: N, conditional_groups: N }
testid: { leaves: N, with_testid: N, convention_violations: N }
paper_compile: { json_schema_valid: true|false|null, behaviors_cycles: none }
gaps: { high: N, med: N, low: N }
```

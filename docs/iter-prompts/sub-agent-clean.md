# Sub-agent — clean baseline (target={TARGET})

> Шаблон. Orchestrator подставляет `{TARGET}` (`core` | `renderer-react` | `renderer-json`) перед вызовом Agent'а.
> Полный план: [docs/plans/proud-pondering-jellyfish.md](../plans/proud-pondering-jellyfish.md).

---

## Цель

Реализуй полностью **форму кредитной заявки** по спецификации `docs/specs/credit-application-form.md` (read-only) для target=`{TARGET}`. Это **baseline-замер**: orchestrator измеряет tokens / wall-clock / качество твоей работы. Делай как считаешь правильным.

---

## Куда писать код

Каталог: `projects/react-playground/src/pages/examples/mcp-credit-application-{TARGET}-clean/`

Файлы per target:

| target           | files                       |
| ---------------- | --------------------------- |
| `core`           | `schema.ts` + `index.tsx`   |
| `renderer-react` | `schema.ts` + `index.tsx`   |
| `renderer-json`  | `schema.json` + `index.tsx` |

```bash
mkdir -p projects/react-playground/src/pages/examples/mcp-credit-application-{TARGET}-clean
```

---

## MCP — используй по максимуму

У тебя есть MCP-сервер `@reformer/mcp` с tools `mcp__reformer__find_recipe` / `mcp__reformer__get_symbol_docs` / `mcp__reformer__report_issue`.

**Используй его по максимуму** — это первоисточник recipes и symbol-docs для всех `@reformer/*` пакетов. Если перед написанием кода для механизма (валидация, computed-fields, FormArray, async-validators, async-options, masks, conditional rendering, multi-step wizard и т.д.) ты НЕ вызвал MCP — это пробел в твоей работе.

Если recipe не подошёл — попробуй другой keyword. Если MCP вообще ничего не дал по теме — это сигнал к `report_issue`.

---

## testId convention (обязательная)

**КАЖДОЕ поле формы ДОЛЖНО иметь `componentProps.testId`** равный имени поля (camelCase):

- **Top-level**: `testId === fieldName`. Пример: `loanAmount` → `testId: 'loanAmount'`.
- **Nested groups**: `parentField-childField` через дефис. Пример: `personalData.lastName` → `testId: 'personalData-lastName'`, `passportData.series` → `testId: 'passportData-series'`.
- **Array items** (внутри FormArraySection / item-template): `testId` per item-leaf БЕЗ префикса массива (POM-консумеры ставят индекс сами).

Пример (схема):

```ts
loanAmount: { value: null, component: Input, componentProps: { label: 'Сумма', testId: 'loanAmount' } },

personalData: {
  lastName:  { value: '', component: Input, componentProps: { label: 'Фамилия', testId: 'personalData-lastName' } },
  firstName: { value: '', component: Input, componentProps: { label: 'Имя',     testId: 'personalData-firstName' } },
},

properties: [{
  type:           { value: 'apartment', component: Select,   componentProps: { label: 'Тип',       testId: 'type' } },
  estimatedValue: { value: 0,           component: Input,    componentProps: { label: 'Стоимость', testId: 'estimatedValue', type: 'number' } },
}],
```

Зачем: единая convention для consumer'ов (POM, abstract tests). Даже без запуска тестов в этом эксперименте — convention остаётся ожидаемой нормой.

---

## Hard-rules

- НЕ редактируй `docs/specs/` (CLAUDE.md → Specs are read-only)
- НЕ делай `git commit` / `git push` / `git tag`
- НЕ трогай `App.tsx` — orchestrator сам добавит routes после твоего завершения

---

## Verification (минимум)

После генерации запусти:

```bash
cd projects/react-playground && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -50
```

Если есть ошибки — попробуй устранить (используй MCP для уточнения сигнатур / типов). Допустимо до 3 циклов retry.

---

## Dev-report (обязательно)

Запиши `.tmp/iter-artifacts/iter-clean-1/{TARGET}/dev-report.md` со структурой:

```md
# dev-report — target={TARGET}

## Status

ok | partial | blocked

## Files written

- projects/react-playground/src/pages/examples/mcp-credit-application-{TARGET}-clean/schema.ts (LOC: N)
- projects/react-playground/src/pages/examples/mcp-credit-application-{TARGET}-clean/index.tsx (LOC: N)
- ...

## MCP calls

Кол-во вызовов: N

Список используемых recipes / symbols (короткое описание что искал и пригодилось ли):

- find_recipe(topic="...") → ✅/❌ — ...
- get_symbol_docs(symbol="...") → ✅/❌ — ...

## MCP gaps

Каждый gap — отдельный пункт (если gap'ов нет — `(none)`):

- **gap-id**: `g-<short-slug>` (например `g-find_recipe-async-fail`)
- **severity**: `high` | `med` | `low`
- **evidence**: цитата ответа MCP или фраза «MCP returned no recipe for X»
- **proposed fix**: что добавить в MCP (новый recipe / extra example / правка существующего)

## Notes

Особенности реализации, blocker'ы, что не получилось, неоднозначности в спеке.
```

---

## Return (последнее сообщение agent'а)

Структурированный yaml-summary:

```yaml
status: ok | partial | blocked
target: { TARGET }
files_written:
  - projects/react-playground/src/pages/examples/mcp-credit-application-{TARGET}-clean/schema.ts
  - projects/react-playground/src/pages/examples/mcp-credit-application-{TARGET}-clean/index.tsx
mcp_calls: N
gaps:
  high: N
  med: N
  low: N
report_path: .tmp/iter-artifacts/iter-clean-1/{TARGET}/dev-report.md
notes: <одна строка про blocker'ы если есть>
```

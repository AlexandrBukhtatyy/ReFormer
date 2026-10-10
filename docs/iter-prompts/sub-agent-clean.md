# Sub-agent — clean baseline (target={TARGET})

> Шаблон. Orchestrator подставляет `{TARGET}` (`core` | `renderer-react` | `renderer-json`) перед вызовом Agent'а.
> Полный план: [docs/plans/proud-pondering-jellyfish.md](../plans/proud-pondering-jellyfish.md).

---

## Цель

Реализуй полностью **форму кредитной заявки** по спецификации `docs/specs/credit-application-form.md` (read-only) для target=`{TARGET}`. Это **baseline-замер**: orchestrator измеряет tokens / wall-clock / качество твоей работы. Делай как считаешь правильным.

---

## Куда писать код

Каталог: `projects/react-playground/src/pages/debug/mcp-credit-application-{TARGET}-clean/`

Файлы per target — раскладка одна на все targets:

| target           | files                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `core`           | `index.tsx` `types.ts` `model.ts` `form.schema.ts` `form.behavior.ts` `form.validation.ts` `data-sources.ts` `api.ts` |
| `renderer-react` | те же файлы, что у `core`                                                                                             |
| `renderer-json`  | те же + `registry.ts`; `form.schema.ts` — документ формата 2 в `defineJsonSchema<T>`                                  |

По необходимости — `form.flow.ts` (шаги визарда) и `form.messages.ts` (словарь текстов ошибок).

```bash
mkdir -p projects/react-playground/src/pages/debug/mcp-credit-application-{TARGET}-clean
```

---

## MCP — используй по максимуму

У тебя есть MCP-сервер `@reformer/mcp` с tools `mcp__reformer__find_recipe` / `mcp__reformer__get_symbol_docs` / `mcp__reformer__report_issue`.

**Используй его по максимуму** — это первоисточник recipes и symbol-docs для всех `@reformer/*` пакетов. Если перед написанием кода для механизма (валидация, computed-fields, FieldArray, async-validators, async-options, masks, conditional rendering, multi-step wizard и т.д.) ты НЕ вызвал MCP — это пробел в твоей работе.

Если recipe не подошёл — попробуй другой keyword. Если MCP вообще ничего не дал по теме — это сигнал к `report_issue`.

---

## testId convention (обязательная)

**КАЖДОЕ поле формы ДОЛЖНО иметь `componentProps.testId`** равный имени поля (camelCase):

- **Top-level**: `testId === fieldName`. Пример: `loanAmount` → `testId: 'loanAmount'`.
- **Nested groups**: `parentField-childField` через дефис. Пример: `personalData.lastName` → `testId: 'personalData-lastName'`, `passportData.series` → `testId: 'passportData-series'`.
- **Array items** (внутри строки массива — `item` узла `{ model, component: FieldArray, item }`): `testId` per item-leaf БЕЗ префикса массива (POM-консумеры ставят индекс сами).

Пример (схема — узлы привязаны ручками модели `model.$.…`):

```ts
{ model: model.$.loanAmount, component: InputNumber, componentProps: { label: 'Сумма', testId: 'loanAmount' } },

// вложенная группа — подформа { model, part }
const personalDataPart = (pd: FormModel<PersonalData>): FormSchemaNode => ({
  children: [
    { model: pd.$.lastName,  component: Input, componentProps: { label: 'Фамилия', testId: 'personalData-lastName' } },
    { model: pd.$.firstName, component: Input, componentProps: { label: 'Имя',     testId: 'personalData-firstName' } },
  ],
});
{ model: model.$.personalData, part: personalDataPart },

// массив под-форм — { model, component: FieldArray, item }
const propertyRow = (property: FormModel<PropertyItem>): FormSchemaNode => ({
  children: [
    { model: property.$.type,           component: SelectAsync, componentProps: { label: 'Тип',       testId: 'type' } },
    { model: property.$.estimatedValue, component: InputNumber, componentProps: { label: 'Стоимость', testId: 'estimatedValue' } },
  ],
});
{ model: model.$.properties, component: FieldArray, item: propertyRow },
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

- projects/react-playground/src/pages/debug/mcp-credit-application-{TARGET}-clean/index.tsx (LOC: N)
- projects/react-playground/src/pages/debug/mcp-credit-application-{TARGET}-clean/form.schema.ts (LOC: N)
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
  - projects/react-playground/src/pages/debug/mcp-credit-application-{TARGET}-clean/index.tsx
  - projects/react-playground/src/pages/debug/mcp-credit-application-{TARGET}-clean/form.schema.ts
  - ... # остальные файлы раскладки
mcp_calls: N
gaps:
  high: N
  med: N
  low: N
report_path: .tmp/iter-artifacts/iter-clean-1/{TARGET}/dev-report.md
notes: <одна строка про blocker'ы если есть>
```

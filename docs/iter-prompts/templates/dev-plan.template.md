# dev-plan — target={TARGET}, iter={ITER}

> Sub-agent заполняет этот шаблон в Step 2.
> Файл: `.tmp/iter-artifacts/iter-{ITER}/{TARGET}/dev-plan.md`.

## Spec source

- Path: `{SPEC_PATH}`
- Read at: `<ISO timestamp>`

## Form structure (parsed from spec)

- **Total steps**: N
- **Steps & fields**:
  - Step 1: «<title>»
    - field `<name>` — type `<type>`, required: yes/no, validations: [...]
    - ...
  - Step 2: ...
  - ...
- **Computed fields**:
  - `<target field>` ← derived from [`<src1>`, `<src2>`] via formula `<short>`
- **FormArray sections**:
  - `<array name>` (item type `<ItemType>`, min/max items: ...)
- **Conditional rendering** (`applyWhen`):
  - `<field>` shown when `<predicate>`
- **Async validations**:
  - `<field>` ← endpoint `<descr>`, debounce N ms

## Planned files

- `projects/react-playground/src/pages/examples/mcp-credit-application-{TARGET}-v{ITER}/schema.ts` (или `schema.json` для renderer-json)
- `projects/react-playground/src/pages/examples/mcp-credit-application-{TARGET}-v{ITER}/index.tsx`
- `projects/react-playground-e2e/tests/mcp-credit-{TARGET}-v{ITER}.spec.ts`

## Recipes/symbols planned to use

| query                                          | result summary                                    | will use for           |
| ---------------------------------------------- | ------------------------------------------------- | ---------------------- |
| `find_recipe(topic="validation")`              | <2-3 строки описания>                             | required + min/max     |
| `find_recipe(topic="compute-from")`            | <2-3 строки>                                      | derived fields         |
| `find_recipe(topic="form-array")`              | <2-3 строки>                                      | co-borrowers list      |
| `find_recipe(topic="form-wizard")`             | <2-3 строки>                                      | 6-step navigation      |
| `get_symbol_docs(symbol="createForm")`         | сигнатура + основные опции                        | form bootstrap         |
| `get_symbol_docs(symbol="ValidationSchemaFn")` | type signature                                    | validation callback    |

(Для каждой строки — ссылка на блок в `discovery.md`.)

## Open questions (gaps spotted in discovery)

- **Q1**: <вопрос, на который MCP не дал ответа>
  - что искал: `find_recipe(topic="...")` / `get_symbol_docs(symbol="...")`
  - что получил: <цитата или «no result»>
  - workaround в плане: <best-effort решение, или «fallback to node_modules type signature»>
  - severity: high / med / low
- **Q2**: ...

## Risk acknowledgements

- (опционально) Знаешь, что какой-то аспект формы не покрыт спекой / MCP — фиксируй здесь, чтобы это попало в gap-list дев-репорта.

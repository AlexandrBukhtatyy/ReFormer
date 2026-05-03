# Project context discovery

Discovered via local detection + (when supported) one batched sampling call to the client LLM.

## Detected stack (deterministic)

{{stackBlock}}

## LLM-inferred preferences

{{llmBlock}}

## Combined recommendation (JSON)

```json
{{recommendationJson}}
```

## How to use

Subsequent MCP prompts (`create-form`, `add-validation`, `add-behavior`,
`add-form-array`, `add-wizard`, `plan-form`) accept `target` and `projectPath`
arguments. Use the values above when calling them, e.g.

```
create-form description="..." target="{{target}}" projectPath="<your project path>"
```

If the sampling block above says **«Sampling not supported by this client»**,
ask the user manually:

- Какой целевой стек? `core` / `renderer-react` / `renderer-json`
- Какие UI-компоненты использовать?
- Какая система стилей? (Tailwind / CSS Modules / styled-components / …)
- Какая библиотека валидации (если есть предпочтение)?
- Какие async-паттерны (debounce / AbortController / SWR-style каналы)?

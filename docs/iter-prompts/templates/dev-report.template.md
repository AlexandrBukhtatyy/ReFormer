# dev-report — target={TARGET}, iter={ITER}

> Sub-agent заполняет в Step 6.
> Файл: `.tmp/iter-artifacts/iter-{ITER}/{TARGET}/dev-report.md`.
> Orchestrator парсит этот файл в Step 4 для агрегации.

## Metrics

| metric                    | value                            | notes                                                        |
| ------------------------- | -------------------------------- | ------------------------------------------------------------ |
| iter version              | v{ITER}                          |                                                              |
| target                    | {TARGET}                         |                                                              |
| started at                | <ISO>                            |                                                              |
| finished at               | <ISO>                            |                                                              |
| wall time (min)           | N                                |                                                              |
| approximate input tokens  | N                                | grep tool calls в transcript × ~Y; orchestrator перепроверит |
| approximate output tokens | N                                | то же                                                        |
| tsc errors (initial)      | N                                |                                                              |
| tsc errors (final)        | N                                | 0 для status=ok                                              |
| lint errors (final)       | N                                |                                                              |
| build errors (final)      | N                                |                                                              |
| runtime errors (smoke)    | N                                | smoke-spec failures + console errors                         |
| screenshots written       | N                                | должно быть ≥1 (`smoke-final.png`)                           |
| video recorded            | n/a                              | видео пишет orchestrator при abstract test run               |
| **status**                | ok / partial / blocked / tainted |                                                              |

## Sandbox compliance (self-attestation)

- packages/ reads: 0 (или N — с обоснованием)
- sibling examples reads: 0 (или N)
- common helpers reads: 0 (или N)
- git commit/push attempts: 0
- спека отредактирована: no

(Orchestrator аудирует transcript; этот раздел — для прозрачности.)

## MCP gaps encountered

> Каждый gap — реальная ситуация когда MCP не дал нужный ответ или дал misleading.
> Это **главный output** sub-agent'а — основа для патчей MCP.

- **g-{slug-1}** [severity: high]
  - **what I needed**: <цель>
  - **MCP query**: `find_recipe(topic="X")` или `get_symbol_docs(symbol="Y")`
  - **MCP response**: <цитата 1-3 строки или «no result»>
  - **why it's a gap**: <почему ответ не закрыл вопрос>
  - **workaround applied**: <как в итоге решил — или «fallback to node_modules .d.ts inspection» — или «marked as blocker»>
  - **proposed patch direction**: <идея правки MCP — новый recipe / extra example / правка template>

- **g-{slug-2}** [severity: med]
  - ...

(Если gap'ов нет — секция `## MCP gaps encountered\n\n_None — MCP closed all questions._`)

## Recipes used (final list)

| recipe                              | used for                     |
| ----------------------------------- | ---------------------------- |
| `find_recipe(topic="validation")`   | required + min/max + pattern |
| `find_recipe(topic="compute-from")` | derived fields               |
| ...                                 | ...                          |

## Symbols queried (final list)

| symbol             | used for                  |
| ------------------ | ------------------------- |
| `createForm`       | form bootstrap            |
| `defineValidation` | validation over the model |
| ...                | ...                       |

## Files written

- `projects/react-playground/src/pages/debug/mcp-credit-application-{TARGET}-v{ITER}/index.tsx` (LOC: N)
- `projects/react-playground/src/pages/debug/mcp-credit-application-{TARGET}-v{ITER}/form.schema.ts` (LOC: N)
- ... — остальные файлы раскладки (`types.ts`, `model.ts`, `form.behavior.ts`, `form.validation.ts`, `data-sources.ts`, `api.ts`; `registry.ts` у renderer-json) (LOC: N)
- `$TMPDIR/iter-{ITER}-{TARGET}/smoke.spec.ts` (LOC: N, вне репозитория)

## Screenshots index

- `screenshots/mcp-credit-v{ITER}/{TARGET}/smoke-final.png`

## Video

- n/a — видео пишет orchestrator при abstract test run (`ITER_MODE=on`) в `videos/mcp-credit-v{ITER}/{TARGET}/`

## Errors / blockers (если status != ok)

- <описание блокера, какой шаг не дошёл, какая ошибка>

## Known limitations of this iter (опционально)

- <что не реализовал, почему — например: «async validator не реализован, MCP не вернул паттерн; fallback — sync stub»>

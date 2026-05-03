# iter-{ITER} summary — {ISO date}

> Orchestrator пишет в Step 4.
> Файл: `docs/iter-summaries/iter-{ITER}.md`.
> Источник: 3× `dev-report.md` из `.tmp/iter-artifacts/iter-{ITER}/{target}/`.

## Spec

- Path: `docs/specs/credit-application-mcp.md`
- Spec git SHA at iter start: `<SHA>`

## Run metrics

| target          | input tokens | output tokens | time (min) | tsc final | lint final | runtime err | screenshots | video | status     |
| --------------- | ------------ | ------------- | ---------- | --------- | ---------- | ----------- | ----------- | ----- | ---------- |
| core            | N            | N             | N          | 0         | 0          | 0           | 7           | yes   | ok         |
| renderer-react  | N            | N             | N          | 2         | 0          | 0           | 7           | yes   | partial    |
| renderer-json   | N            | N             | N          | 0         | 0          | 1           | 6           | yes   | ok         |
| **total**       | N            | N             | (max — параллель) | 2         | 0          | 1           | 20          | 3     | mixed      |

## Sandbox audit

| target          | packages/ reads | sibling reads | helpers reads | git mutations | verdict |
| --------------- | --------------- | ------------- | ------------- | ------------- | ------- |
| core            | 0               | 0             | 0             | 0             | clean   |
| renderer-react  | 0               | 0             | 0             | 0             | clean   |
| renderer-json   | 1               | 0             | 0             | 0             | tainted |

(Tainted-target gap'ы исключаются из агрегации gap'ов ниже.)

## Aggregated MCP gaps (после dedup)

### G1 [high] {category}

- targets affected: core, renderer-react
- evidence (compiled from per-target dev-reports):
  - **core**: «искал X через find_recipe(topic="...") — вернулось Y, не закрыло Z»
  - **renderer-react**: «искал A через ... — вернулось B»
- common workarounds applied: <how sub-agents coped>
- regression: false (либо `true` — если gap появлялся в iter-{N-1} — флаг для escalation)
- proposed patch direction: <короткое — детали в `proposed-patches/g1-...md`>

### G2 [med] {category}

- targets affected: renderer-json
- evidence:
  - **renderer-json**: «...»
- proposed patch direction: <короткое>

(Если gap'ов нет — `_None — все sub-agent'ы закрыли вопросы через MCP._`)

## Proposed patches

См. `.tmp/iter-artifacts/iter-{ITER}/proposed-patches/`:

- [`g1-{slug}.md`](../../.tmp/iter-artifacts/iter-{ITER}/proposed-patches/g1-{slug}.md) — patch для G1
- [`g2-{slug}.md`](../../.tmp/iter-artifacts/iter-{ITER}/proposed-patches/g2-{slug}.md) — patch для G2

## Verification (post-merge)

| check                                          | result      |
| ---------------------------------------------- | ----------- |
| `npx tsc --noEmit -p tsconfig.app.json` (playground) | PASS / FAIL |
| `npm run lint -w react-playground`             | PASS / FAIL |
| App.tsx routes added                           | 3 (or N)    |
| screenshots count                              | N           |
| videos count                                   | 3 (or N)    |
| leaked screenshots in repo root                | 0 (or N — moved + flagged) |

## Stop check

- gaps after dedup: N
- post-merge errors: N
- iter: {ITER} / MAX_ITER
- **decision**: `continue` / `stop (green)` / `stop (limit)`

## Next session

(Заполняется в зависимости от decision.)

### если CONTINUE

1. Review patches in `.tmp/iter-artifacts/iter-{ITER}/proposed-patches/`
2. Apply manually to `packages/reformer-mcp/`
3. Validate: `cd packages/reformer-mcp && npm run build`
4. Re-run: `/iter $((ITER+1))`

### если STOP-GREEN

- Cycle закрыт. MCP стабилен на этой спеке.
- Возможные следующие шаги: новый цикл с другой спекой / merge feature → main / документация результатов.

### если STOP-LIMIT

- Лимит итераций ({MAX_ITER}). Эскалируй пользователю.
- Ревьюй gaps — возможно нужны более крупные структурные правки MCP, не точечные patches.

## Files changed in this iter

```
<вывод git status --short>
```

## Artifacts

- `.tmp/iter-artifacts/iter-{ITER}/` — workspace, dev-plan/dev-report per target, proposed-patches, audit
- `projects/react-playground/src/pages/examples/mcp-credit-application-{core,renderer-react,renderer-json}-v{ITER}/` — сгенерированный код
- `projects/react-playground-e2e/tests/iter/mcp-credit-{core,renderer-react,renderer-json}-v{ITER}.spec.ts` — e2e спеки
- `projects/react-playground-e2e/screenshots/mcp-credit-v{ITER}/{core,renderer-react,renderer-json}/` — full-page скриншоты
- `projects/react-playground-e2e/videos/mcp-credit-v{ITER}/{core,renderer-react,renderer-json}/walkthrough.webm` — видео

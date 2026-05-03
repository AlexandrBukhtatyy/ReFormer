# Resources fine-grained + slim prompts + sampling в reformer-mcp

## Context

Сейчас prompts инжектят 50–60 KB справочного llms.txt-материала через
`getSection()`/`getFullDocs()` в каждое сообщение (`add-behavior` ~28 KB,
`create-form` ~21 KB). Это раздувает контекст модели тем, что модель уже
могла знать или подгрузить только при необходимости.

Цель — три связанных изменения:

1. **Fine-grained resources** — каждая `## ` секция llms.txt становится
   отдельным MCP resource. Модель/клиент читает их через
   `ReadMcpResourceTool` точечно.
2. **Slim+ prompts** — prompts содержат args + 1-line critical shortlist
   (имена API + anti-patterns) + блок Prerequisites со списком URIs +
   output checklist. Все полные code-examples и discussion-style секции
   уезжают в resources. Размер prompts падает в 5–8x.
3. **Sampling capability** — сервер использует client LLM для
   auto-detect target, fallback UI-kit/styling discovery, deep
   spec-analysis в plan-form, и нового prompt `discover-context`.

Это **breaking change** для resources API → bump до `2.0.0-beta.1`.

## Решения (зафиксированы)

| Решение                 | Выбор                                                                         |
| ----------------------- | ----------------------------------------------------------------------------- |
| Гранулярность resources | Fine-grained (1 ресурс = 1 секция llms.txt)                                   |
| Стратегия prompts       | Slim+ (args + 1-line shortlist + Prerequisites + checklist)                   |
| Sampling use cases      | Auto-detect target, UI-kit fallback, plan-form deep, новый `discover-context` |
| Versioning              | Breaking → удалить legacy URI в этом же релизе, bump 2.0.0-beta.1             |
| Scope сессии            | Все этапы 0–6                                                                 |

## URI scheme

- `reformer://docs/<pkg-short>/<section-slug>` — primary (fine-grained).
- `reformer://docs/<pkg-short>` — aggregator (full llms.txt).
- **Удаляются**: `reformer://api/*`, `reformer://examples/*`, `reformer://troubleshooting/*`, `reformer://docs` без pkg.

`pkg-short`: `core`, `cdk`, `ui-kit`, `renderer-react`, `renderer-json`.

`section-slug`: `slugify(title)` — lowercase, NFKC, не-`[a-z0-9]` → `-`,
trim/dedupа `-`. Примеры: `## copyFrom` → `copyfrom`,
`## API SIGNATURES` → `api-signatures`, `## Multi-Step / Wizard` →
`multi-step-wizard`.

Только level-2 секции (`## `). Level-3 не выносим — иначе 200+ ресурсов.

## Этапы

### Этап 0. Slugify + listSections (additive в utils)

Файл: [packages/reformer-mcp/src/utils/docs-parser.ts](packages/reformer-mcp/src/utils/docs-parser.ts).

- `slugify(title): string` — pure функция.
- `interface SectionMeta { title: string; slug: string; level: 2 }`.
- `listSections(pkg): SectionMeta[]` — парсит llms.txt, возвращает level-2 секции, кеш `sectionsCache: Map<string, SectionMeta[]>`.
- `getSectionBySlug(pkg, slug): string | null` — exact-matcher (не substring как текущий `getSection`).
- Юнит-тесты: snapshot всех 5 пакетов × секций → slugs. Unique within pkg.

### Этап 1. Resources — fine-grained

Файл: [packages/reformer-mcp/src/index.ts](packages/reformer-mcp/src/index.ts).

- В `ListResourcesRequestSchema`-handler: для каждого пакета — 1 aggregator + N section-resources. Description = первые ~120 chars после header.
- В `ReadResourceRequestSchema`-handler: regex `^reformer:\/\/docs\/([^/]+)(?:\/(.+))?$` — `(short, undefined)` → `getFullDocs`, `(short, slug)` → `getSectionBySlug`. Unknown slug → throw с диагностикой `Available: ...`.
- **Удаление**: legacy URI patterns (`api/`, `examples/`, `troubleshooting/`). `RESOURCE_CATEGORIES` устаревает, заменяется на новую логику.
- README + CHANGELOG: breaking-change запись.

### Этап 2. Async prompt handlers

Файл: [packages/reformer-mcp/src/index.ts](packages/reformer-mcp/src/index.ts) + все 10 prompt-модулей.

- В `GetPromptRequestSchema`-handler — `await` каждого `get*Prompt(args)`.
- Сигнатура каждого `get*Prompt(args): Promise<{ messages: ... }>`. Нужно для sampling use cases (см. Этап 5).

### Этап 3. Slim+ prompts (10 шаблонов + TS-модули)

Файлы: [packages/reformer-mcp/src/prompts/templates/\*.md](packages/reformer-mcp/src/prompts/templates/) + [packages/reformer-mcp/src/prompts/\*.ts](packages/reformer-mcp/src/prompts/).

Структура каждого slim+ template:

```markdown
## Args

- description: {{description}}
- requirements: {{requirements}}

## Critical inline rules

<5–10 строк: имена API + сигнатуры + 1-line anti-patterns,
которые модель чаще всего галлюцинирует>

## Prerequisites — read these resources via ReadMcpResourceTool

**You MUST read these BEFORE writing code. Skipping = incorrect output.**

- reformer://docs/core/cycle-detection (КРИТИЧНО)
- reformer://docs/core/copyfrom
- ...

## Task

<инструкция что сделать с args>

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] Cycle-prevention rule respected
- [ ] ...
```

Per-prompt prerequisites таблица:

| Prompt           | Resources                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| add-behavior     | core/{compute-vs-watch, cycle-detection, copyfrom, syncfields, resetwhen, transformvalue, revalidatewhen, common-patterns}          |
| add-form-array   | core/{arrays, array-operations, array-cleanup}, cdk/{formarray, nested}                                                             |
| create-form      | core/{import-patterns, quick-start, formschema-format, common-patterns} + (target-conditional) renderer-react/_ или renderer-json/_ |
| add-validation   | core/{validation, api-signatures, async, common-mistakes, cross-field}                                                              |
| add-wizard       | core/{multi-step}, cdk/{formwizard, wizard-recipes}                                                                                 |
| to-renderer      | renderer-react aggregator + selected sections                                                                                       |
| to-renderer-json | renderer-json aggregator + selected sections                                                                                        |
| review           | core/{anti-patterns, troubleshooting-faq, react-integration}                                                                        |
| debug            | core/{troubleshooting-faq, react-integration, api-reference}                                                                        |
| plan-form        | core/{quick-start, formschema-format}, cdk/{formwizard}, core/{multi-step} (target-conditional)                                     |

Из TS-модулей удаляются все `getSection()`/`getFullDocs()` вызовы — TS оставляет только сборку args + project-detector + sampling helpers.

Размер каждого prompt ≤ 5KB. Snapshot-тест жёстко проверяет (Этап 6).

### Этап 4. Sampling helper

Новый файл: [packages/reformer-mcp/src/utils/sampling.ts](packages/reformer-mcp/src/utils/sampling.ts).

```typescript
export interface SamplingRequest {
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
  modelHint?: string;
  intelligencePriority?: number;
}

export type SamplingResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'unsupported' | 'error'; error?: unknown };

export async function requestSampling(
  server: Server,
  req: SamplingRequest
): Promise<SamplingResult>;
export function isSamplingSupported(server: Server): boolean;
```

- Defaults: `modelHint='claude-3-5-sonnet'`, `maxTokens=512`, `intelligencePriority=0.7`.
- `isSamplingSupported`: `server.getClientCapabilities()?.sampling !== undefined`.
- Любой throw → `{ ok: false, reason: 'unsupported' }` или `'error'`. Логирование в stderr.
- В [index.ts](packages/reformer-mcp/src/index.ts) `Server` constructor: добавить `sampling: {}` в capabilities.

### Этап 5. Sampling use cases

Файл [packages/reformer-mcp/src/utils/sampling-helpers.ts](packages/reformer-mcp/src/utils/sampling-helpers.ts) (новый):

- `inferTarget(server, { description, stack }): Promise<'core' | 'renderer-react' | 'renderer-json'>` — bias по deps; fallback `core`.
- `discoverUnknownStack(server, projectRoot): Promise<{ uiKit; styling } | null>` — sampling по `stack.allDependencies`.
- `deepAnalyzeSpec(server, content, regexResults): Promise<DeepAnalysis | null>` — JSON-output sampling, мердж в `plan-form` template как опциональная секция (Handlebars-блок пустой если null).

Интеграция:

- [create-form.ts](packages/reformer-mcp/src/prompts/create-form.ts), [plan-form.ts](packages/reformer-mcp/src/prompts/plan-form.ts) — `inferTarget` если `args.target === undefined`.
- [project-detector.ts](packages/reformer-mcp/src/utils/project-detector.ts) — `renderStackDetectionBlockAsync(stack, server?)` с fallback на legacy MCP-gap-блок.
- [plan-form.ts](packages/reformer-mcp/src/prompts/plan-form.ts) — `deepAnalyzeSpec` после regex.

### Этап 6. Новый prompt `discover-context`

Новый файл: [packages/reformer-mcp/src/prompts/discover-context.ts](packages/reformer-mcp/src/prompts/discover-context.ts) + [templates/discover-context.md](packages/reformer-mcp/src/prompts/templates/discover-context.md).

- Args: `description` (required), `projectPath` (optional).
- Поведение: `detectProjectStack` + один batched sampling-запрос (`maxTokens=1024`, `intelligencePriority=0.8`) который просит JSON `{ target, uiKit, styling, validation, async }`.
- Output: `{ messages: [{ role: 'user', content: { type: 'text', text: <JSON в fenced block + краткая prose-summary> } }] }`.
- Если `!isSamplingSupported(server)` — возвращает шаблон вопросов «спроси пользователя сам» без sampling-вызова.
- Регистрация в [src/prompts/index.ts](packages/reformer-mcp/src/prompts/index.ts) и в [src/index.ts](packages/reformer-mcp/src/index.ts) `ListPromptsRequestSchema` + `GetPromptRequestSchema` switch.

### Этап 7. Verification

- **Unit (slug):** snapshot всех текущих slugs → если кто-то переименует секцию, тест падает.
- **Unit (sampling helper):** mock `server.createMessage` через jest spy, проверить все 3 ветки `requestSampling` (ok / unsupported / error).
- **Snapshot prompts:** обновить [scripts/snapshot-prompts.mjs](packages/reformer-mcp/scripts/snapshot-prompts.mjs) — теперь генерирует с `--mock-sampling=fixed-response.json` (детерминированный sampling stub).
- **Size assertion:** новый `tests/prompts/size.test.ts` — `expect(rendered.length).toBeLessThan(5_000)` для каждого из 10 prompts с baseline-args.
- **Manual via MCP Inspector:** `npx @modelcontextprotocol/inspector node dist/index.js`:
  - Resources tab — список ~50–70 ресурсов, чтение 3–4 вручную, проверить slug-resolution.
  - Prompts tab — `discover-context` с фейковыми args, проверить JSON в output.
- **Integration smoke:** один полный flow через Claude Desktop (`/create-form` без target → sampling → правильный prompt с relevant prerequisites).

## Critical files

**Новые:**

- [packages/reformer-mcp/src/utils/sampling.ts](packages/reformer-mcp/src/utils/sampling.ts)
- [packages/reformer-mcp/src/utils/sampling-helpers.ts](packages/reformer-mcp/src/utils/sampling-helpers.ts)
- [packages/reformer-mcp/src/prompts/discover-context.ts](packages/reformer-mcp/src/prompts/discover-context.ts)
- [packages/reformer-mcp/src/prompts/templates/discover-context.md](packages/reformer-mcp/src/prompts/templates/discover-context.md)

**Меняются:**

- [packages/reformer-mcp/src/index.ts](packages/reformer-mcp/src/index.ts) — capabilities + resources logic + async prompt handlers
- [packages/reformer-mcp/src/utils/docs-parser.ts](packages/reformer-mcp/src/utils/docs-parser.ts) — slugify + listSections + getSectionBySlug
- [packages/reformer-mcp/src/utils/project-detector.ts](packages/reformer-mcp/src/utils/project-detector.ts) — async UI-kit fallback
- 10 prompt-модулей в [packages/reformer-mcp/src/prompts/](packages/reformer-mcp/src/prompts/) — async + удаление getSection
- 10 шаблонов в [packages/reformer-mcp/src/prompts/templates/](packages/reformer-mcp/src/prompts/templates/) — переписаны как slim+
- [packages/reformer-mcp/package.json](packages/reformer-mcp/package.json) — bump 2.0.0-beta.1
- [packages/reformer-mcp/docs/development.md](packages/reformer-mcp/docs/development.md) — обновить под новую архитектуру (resources/sampling)

## Риски

| Риск                                      | Митигация                                                                                                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Модель не читает resources                | MANDATORY-wording в Prerequisites, slim+ inline shortlist (5-10 строк), self-check «Прочитал ресурсы: yes/no» в output checklist                          |
| Sampling latency ~3-10s на batched запрос | `discover-context` — single batched request, не N отдельных                                                                                               |
| Sampling не поддерживается клиентом       | `isSamplingSupported` check + graceful fallback на legacy-paths во всех use cases                                                                         |
| Slug-instability при rename секции        | Snapshot-тест slugs, любой rename падает CI                                                                                                               |
| Sampling cost (billable у клиента)        | `inferTarget` срабатывает только при `args.target === undefined`. `discover-context` opt-in (отдельный prompt). UI-kit fallback только при пустом detect. |
| 50-70 resources в `/resources` UI шумно   | Короткие descriptions ≤100 chars, опциональные emoji-prefix в name (post-M1)                                                                              |
| Bump 2.0.0 ломает потребителей            | Пакет в beta, активных потребителей кроме внутреннего sub-agent flow нет                                                                                  |

## Out of scope

- Level-3 (`### `) секции как resources — отложено.
- Stable slug aliases — пока не нужны.
- Resources `subscriptions` (`resources/subscribe`) — для статичной документации не нужны.
- Удаление copy-templates.mjs / loader — сохраняется как сейчас (Handlebars + `{{var}}` остаются в slim+ templates).

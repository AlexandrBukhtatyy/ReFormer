# Agent Instructions

Гайд для ИИ-агентов (Claude Code, Cursor, другие MCP-клиенты) по работе с монорепо ReFormer.

## ReFormer: документация и MCP

### Где искать документацию по пакету

| Пакет                      | docs/llms/                                                                                 | Что внутри                                    |
| -------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `@reformer/core`           | [packages/reformer/docs/llms/](packages/reformer/docs/llms/)                               | API, валидаторы, behaviors, типы, hooks.      |
| `@reformer/cdk`            | [packages/reformer-cdk/docs/llms/](packages/reformer-cdk/docs/llms/)                       | Headless: FormArray, FormWizard, FormField.   |
| `@reformer/ui-kit`         | [packages/reformer-ui-kit/docs/llms/](packages/reformer-ui-kit/docs/llms/)                 | Стилизованные компоненты на Tailwind + Radix. |
| `@reformer/renderer-react` | [packages/reformer-renderer-react/docs/llms/](packages/reformer-renderer-react/docs/llms/) | Рендерер схем для React.                      |
| `@reformer/renderer-json`  | [packages/reformer-renderer-json/docs/llms/](packages/reformer-renderer-json/docs/llms/)   | JSON-схема, реестр компонентов.               |
| `@reformer/mcp`            | [packages/reformer-mcp/](packages/reformer-mcp/)                                           | MCP-сервер: tools, resources, prompts.        |

### MCP-сервер

`@reformer/mcp` — единая точка справки. Регистрация в Claude Code:

```bash
claude mcp add --transport stdio reformer -- reformer-mcp
```

Доступно: resources `reformer://docs|api|examples|troubleshooting`; tools `report_issue`, `debug` (под `REFORMER_DEBUG=true`); prompt `debug`. Расширения см. в [PROMT.md](PROMT.md), задачи T1.x.

### Эталонные примеры

- Простая форма: [projects/react-playground/src/pages/demo/registration-form/RegistrationForm.tsx](projects/react-playground/src/pages/demo/registration-form/RegistrationForm.tsx)
- Multi-step wizard + FormArray: [projects/react-playground/src/pages/demo/complex-multy-step-form/CreditApplicationForm.tsx](projects/react-playground/src/pages/demo/complex-multy-step-form/CreditApplicationForm.tsx)
- JSON-renderer: [projects/react-playground/src/pages/demo/complex-multy-step-form-renderer-json/](projects/react-playground/src/pages/demo/complex-multy-step-form-renderer-json/)

### Команды документации

| Команда                                             | Назначение                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| `npm run generate:llms`                             | Регенерировать `llms.txt` во всех пакетах (`--workspaces --if-present`). |
| `npm run generate:llms -w @reformer/<pkg>`          | Регенерировать только для одного пакета.                                 |
| `node scripts/generate-llms-txt <pkg-path> --audit` | Аудит JSDoc: символы без описания / без `@example`.                      |

### Правила

1. **`llms.txt` — auto-generated.** Не редактируется руками. Источники правды: `docs/llms/*.md` и JSDoc в `src/`. После правок — `npm run generate:llms`.
2. **JSDoc на публичных API** обязателен по [docs/llms-convention.md](docs/llms-convention.md): описание + `@example` для callable (function/class/hook).
3. **Перед коммитом** регенерируй `llms.txt`; повторный запуск должен давать пустой `git diff` (идемпотентность).
4. **Не плодить кастомные JSDoc-теги** (`@ai-hint` и т. п.). Используй стандартные: `@param`, `@returns`, `@example`, `@see`, `@deprecated`, `@group`, `@typeParam`.

### Связанные документы

- [PROMT.md](PROMT.md) — бриф проекта (зачем).
- [docs/llms-convention.md](docs/llms-convention.md) — формальные правила документации.

---

## Beads workflow

This project uses **bd** (beads) for issue tracking. Run `bd prime` for full workflow context.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work atomically
bd close <id>         # Complete work
bd dolt push          # Dolt-remote sync (НЕ git working tree; для git-sync см. «Beads sync — этот проект» ниже)
```

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**

```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**

- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->

## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->

## Beads sync — этот проект (важно)

Секция «Session Completion» выше сгенерирована шаблоном bd и советует `bd dolt push` — **в этом проекте
это не тот канал**. Как работает на самом деле:

- **⚠️ На автокоммит рассчитывать НЕЛЬЗЯ — синхронизировать надо руками.** Раньше здесь было
  написано, что beads сам коммитит свои файлы. По факту (проверено 2026-07-20) в embedded-режиме
  этого не происходит: задачи пишутся в `.beads/embeddeddolt/`, который в `.gitignore`, а трекаемый
  `.beads/issues.jsonl` не обновляется вообще. За период 11–20 июля так «потерялись» из git 24 задачи —
  они существовали только в локальной БД и не пережили бы клон. Историю `chore(beads): sync issues jsonl`
  в git-логе создавали прошлые ручные синхронизации, а не автоматика.
- **Как синхронизировать (делать в конце сессии, где заводились/закрывались задачи):**

  ```bash
  bd export -o .beads/issues.jsonl          # выгрузить задачи из БД в трекаемый JSONL
  git add .beads/issues.jsonl .beads/interactions.jsonl
  git commit -m "chore(beads): sync issues jsonl"
  git push                                   # без push задачи не увидит никто, кроме тебя
  ```

  Проверка, что нужна синхронизация: число задач в JSONL против числа задач в базе **вместе
  с закрытыми** — `grep -c '"id"' .beads/issues.jsonl` и `bd list --all --limit 0 | grep -c "ReFormer-"`.
  Если в JSONL меньше, экспорт не делался. Сравнивать с `bd list --status=open` бессмысленно: в JSONL
  лежат и закрытые задачи, поэтому там почти всегда больше, и проверка молча проходит.

  Экспорт **не только дописывает**. У каждой задачи одна строка, и смена статуса, заголовка или
  описания переписывает её на месте — в `git diff --numstat` это видно как удалённые строки (закрытие
  задачи даёт «1 удалена, 1 добавлена»). Поэтому перед коммитом проверяется не второе число `numstat`,
  а то, что ни один идентификатор не пропал — вывод должен быть пустым:

  ```bash
  comm -23 <(git show HEAD:.beads/issues.jsonl | grep -o '"id":"[^"]*"' | sort -u) \
           <(grep -o '"id":"[^"]*"' .beads/issues.jsonl | sort -u)
  ```

- **`bd export` без `-o` печатает в stdout, а не пишет файл.** Частая ошибка: команда «отработала»,
  а `issues.jsonl` не изменился. Всегда указывай `-o .beads/issues.jsonl`.
- **Память (`bd remember`) в экспорт по умолчанию НЕ попадает** — там может быть чувствительный
  контекст агента. Не добавляй `--include-memories`/`--all` без явной необходимости.
- **Отправка на GitHub — обычным `git push`** (remote `origin`).
- **`bd dolt push` НЕ публикует git-коммиты.** Он пушит встроенную Dolt-БД в Dolt-remote и git-историю
  не трогает — поэтому после него на GitHub «ничего не появляется». Для отправки beads-изменений — `git push`.
- **Не коммить** машинно-локальные файлы: `.beads/.auto-import-issues.jsonl`, `.beads/.local_version`,
  `.beads/last-touched` (watermark/runtime; `embeddeddolt/` и `backup/` уже в `.beads/.gitignore`).
- **`.beads/interactions.jsonl` — append-only журнал аудита.** Каждая bd-команда сразу дописывает в него
  строку-событие, поэтому файл почти всегда в статусе modified. Коммитить его надо вместе с
  `issues.jsonl` в том же `chore(beads)`-коммите (сам он никуда не уедет).
- `git push` beads-изменений (как и любых) — только по явной просьбе пользователя.

<!-- bv-agent-instructions-v5 -->

---

## Beads Workflow Integration

This project uses a Beads tracker—either the Go `bd` CLI or the Rust `br` CLI—for issue tracking, plus [beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) (`bv`) for graph-aware triage. Issues are stored in `.beads/`. `bv` auto-discovers supported JSONL exports, including `.beads/issues.jsonl` and legacy `.beads/beads.jsonl`.

**Choose the tracker CLI from this repository's instructions and configuration.** Use `bd` commands in a Go Beads workspace and `br` commands in a beads_rust workspace. Do not run both trackers against the same workspace or infer the tracker solely from the JSONL filename.

### Using bv as an AI sidecar

bv is a graph-aware triage engine for Beads projects. Instead of parsing .beads/issues.jsonl / .beads/beads.jsonl directly or hallucinating graph traversal, use robot flags for deterministic, dependency-aware outputs with precomputed metrics (PageRank, betweenness, critical path, cycles, HITS, eigenvector, k-core).

**Scope boundary:** bv handles _what to work on_ (triage, priority, planning). The selected tracker CLI (`bd` or `br`) handles creating, claiming, modifying, and closing beads.

**CRITICAL: Use ONLY --robot-\* flags. Bare bv launches an interactive TUI that blocks your session.**

#### The Workflow: Start With Triage

**`bv --robot-triage` is your single entry point.** Its `triage` object contains:

- `quick_ref`: at-a-glance counts + top 3 picks
- `recommendations`: ranked actionable items with scores, reasons, unblock info
- `quick_wins`: low-effort high-impact items
- `blockers_to_clear`: items that unblock the most downstream work
- `project_health`: status/type/priority distributions, graph metrics
- `commands`: copy-paste shell commands for next steps

```bash
bv --robot-triage        # THE MEGA-COMMAND: start here
bv --robot-next          # Minimal: just the single top pick + claim command

# TOON output (--format toon): a compact tabular encoding. Measured on this
# repository it is 7% smaller than JSON for --robot-graph but 9-15% LARGER for
# nested payloads (--robot-triage, --robot-plan, --robot-insights,
# --robot-label-health); use --stats to see both sizes before adopting it.
bv --robot-graph --format toon
bv --robot-triage --format toon --stats
```

Recommendations can include blocked or assigned work; `triage.quick_ref.top_picks` reflects snapshot readiness. A suggested action records its original local ID, working directory, and tracker route. Use that route rather than a namespaced display ID or an unrelated current directory. Inspect current tracker state before execution: analysis does not reserve work or guarantee that a later claim succeeds.

#### Other bv Commands

| Command                                             | Returns                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `--robot-plan`                                      | Parallel execution tracks with unblocks lists                                         |
| `--robot-priority`                                  | Priority misalignment detection with confidence                                       |
| `--robot-insights`                                  | Full metrics: PageRank, betweenness, HITS, eigenvector, critical path, cycles, k-core |
| `--robot-alerts`                                    | Stale issues, blocking cascades, priority mismatches                                  |
| `--robot-suggest`                                   | Hygiene: duplicates, missing deps, label suggestions, cycle breaks                    |
| `--robot-diff --diff-since <ref>`                   | Changes since ref: new/closed/modified issues                                         |
| `--robot-graph [--graph-format=json\|dot\|mermaid]` | Dependency graph export                                                               |

Every robot command emits one JSON object; with `--graph-format=dot` or `mermaid` the diagram text is the `graph` field (`bv --robot-graph --graph-format=dot | jq -r .graph`), not the whole output.

#### Scoping & Filtering

```bash
bv --robot-plan --label backend              # Scope to label's subgraph
bv --robot-insights --as-of HEAD~30          # Historical point-in-time
bv --recipe actionable --robot-plan          # Pre-filter: ready to work (no blockers)
bv --recipe high-impact --robot-triage       # Pre-filter: top PageRank scores
```

### Tracker Commands for Issue Management

Use exactly one command family, matching the tracker configured for the repository.

#### Rust beads_rust (`br`)

```bash
br ready --json                       # Show issues ready to work (no blockers)
br list --status=open --json          # All open issues
br show <id> --json                   # Full issue details with dependencies
br create --title="..." --type=task --priority=2 --json
br update <id> --status=in_progress --json
br close <id> --reason="Completed" --json
br close <id1> <id2> --reason="Completed" --json
br sync --flush-only                  # Export DB to JSONL after Beads mutations
```

#### Go Beads (`bd`)

```bash
bd ready --json                       # Show issues ready to work
bd show <id> --json                   # Full issue details
bd create "..." -t task -p 2 --json
bd update <id> --claim --json         # Atomically claim work
bd close <id> --json
bd dep add <issue> <depends-on>
bd export -o .beads/issues.jsonl        # Refresh the compatibility export read by bv
```

### Workflow Pattern

1. **Triage**: Run `bv --robot-triage` to find the highest-impact actionable work
2. **Verify**: Check the selected tracker's `show`/`ready` output before claiming
3. **Claim**: Use `br update <id> --status=in_progress --json` or `bd update <id> --claim --json`
4. **Work**: Implement the task
5. **Complete**: Use the selected tracker's `close` command
6. **Refresh for bv**: Run `br sync --flush-only` or the `bd export` command above so the JSONL export is current

### Key Concepts

- **Dependencies**: Issues can block other issues. `br ready --json` and `bd ready --json` show unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers 0-4, not words)
- **Types**: task, bug, feature, epic, chore, docs, question
- **Blocking**: Use `br dep add <issue> <depends-on>` or `bd dep add <issue> <depends-on>` to add dependencies

### Git Policy

Tracker commands do not grant permission to commit or push application code. Follow this repository's own git and tracker instructions before staging, committing, syncing, or pushing. If the repository says "commit only when asked," that rule overrides any generic workflow advice.

<!-- end-bv-agent-instructions -->

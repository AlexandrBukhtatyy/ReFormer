# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

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

## File output locations — куда что писать

Никогда не оставляй артефакты в корне репозитория (`.png`, `.json`, `.log`, debug-файлы и т.п.). Два целевых места — оба в `.gitignore`.

### Скриншоты тестов → `projects/react-playground-e2e/screenshots/`

Все скриншоты от playwright (e2e тесты, smoke-проверки, MCP-валидация iter-N, визуальные регрессии) лежат в `projects/react-playground-e2e/screenshots/<context>/<scenario>.png`.

Структура подкаталогов по контексту:

- `screenshots/mcp-credit-v<N>/page<M>/<stage>-<scenario>.png` — итерации MCP-валидации.
- `screenshots/<feature-name>/<scenario>.png` — feature-specific визуальные тесты.

При вызове `mcp__playwright__browser_take_screenshot` **ВСЕГДА** указывай явный `filename` с абсолютным путём в эту папку. Без `filename` playwright MCP пишет в `<repo-root>/page-*.png` — это утечка в корень, чинить переносом в правильное место.

### Всё остальное временное → `.tmp/`

Всё, что НЕ скриншот теста: pre-fetched MCP responses, debug dumps, intermediate JSON, scratch markdown, draft-докcы, dev-серверные логи. Создавай подкаталоги по контексту: `.tmp/mcp-cache/...`, `.tmp/drafts/...`, `.tmp/dev-logs/...`. Если папки нет — `mkdir -p .tmp/<subdir>` перед использованием.

### Auto-scratch (не трогай руками)

- **`.playwright-mcp/`** — playwright MCP сам пишет туда `page-*.yml` snapshots и `console-*.log`. В `.gitignore`. Управляется самим MCP-сервером.

### Что нельзя

- **Никогда** не писать в корень `*.png`, `*.json` debug-дампы, `*.log`, `dev.log`. Если sub-agent или playwright MCP так сделал — orchestrator обязан **переместить файл в правильное место сразу же**, до следующего шага работы.
- **Никогда** не убирать gitignored папки командой `rm -rf` — там может быть текущая работа sub-agent'а.

## Specs are read-only — strict

**NEVER edit files under `docs/specs/` while doing implementation work.** Specs are the input contract; the implementation must adapt to the spec, not the other way around.

- Это касается ЛЮБОЙ работы: реализации формы, MCP-валидации, sub-agent оркестрации, экспериментов. Если спека «недостаточно подробная» для текущей задачи — это сигнал спросить пользователя, а не дописать спеку под себя.
- Под запрет попадают: добавление «canonical user-facing strings» таблиц, добавление «risk matrix», добавление verification-чеклистов, перенос полей между шагами, переименование полей, уточнение типов или единиц измерения. Всё это — артефакты твоей работы, и они должны жить в `dev-plan.md`/`dev-report.md`/MCP-prompt-output, а не в самой спеке.
- Sub-agent'ам дай тот же запрет в их prompt: «спека read-only, всё что нужно вытащить — вытащи в свой dev-plan/dev-report».
- Исключение: если пользователь **явно** просит «обнови спеку», «добавь в спеку X», «переформулируй спеку» — тогда можно. Подтверждение работы («продолжай», «ок») НЕ даёт разрешения трогать спеку.
- Если в спеке нашёл фактическую ошибку (опечатка, противоречие, неконсистентность с другими спеками) — не правь молча, **спроси**: «нашёл в спеке X — поправить?».
- Перед началом работы в репозитории: `git status docs/specs/` — там должно быть пусто. Если уже не пусто (например, sub-agent или прошлая сессия что-то дописала) — `git checkout -- docs/specs/<file>` и сообщить пользователю.

## Git commits — strict authorization

**NEVER make a `git commit` (or `git push`) unless the user has explicitly asked for it in the current request.**

- "Explicitly asked" means the user wrote something like "commit", "закоммить", "push", "запушь", "make a commit", or named a specific commit operation. Acknowledgement of completed work ("ok", "good", "продолжай") is NOT a commit request.
- This rule **overrides** the auto-generated session-completion workflow above. Do NOT auto-push at end of session, do NOT auto-commit after each stage of work, do NOT chain commits speculatively. Leave changes uncommitted in the working tree and surface them in your status update so the user can decide.
- If you believe a commit is appropriate, ASK first ("закоммитить?") and wait for confirmation. Do not stage-and-commit-and-then-ask.
- `git status`, `git diff`, `git log`, `git stash` — these are read-only/non-publishing and may be run freely. The restriction is on commit/push specifically.
- This rule applies even when prior turns in the conversation contained commits — the user's authorization for past commits does NOT carry forward to new changes.

## Build & Test

_Add your build and test commands here_

```bash
# Example:
# npm install
# npm test
```

## Architecture Overview

_Add a brief overview of your project architecture_

## Conventions & Patterns

_Add your project-specific conventions here_

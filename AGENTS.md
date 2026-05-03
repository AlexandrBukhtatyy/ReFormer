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

- Простая форма: [projects/react-playground/src/pages/examples/simple-form/RegistrationForm.tsx](projects/react-playground/src/pages/examples/simple-form/RegistrationForm.tsx)
- Multi-step wizard + FormArray: [projects/react-playground/src/pages/examples/complex-multy-step-form/CreditApplicationForm.tsx](projects/react-playground/src/pages/examples/complex-multy-step-form/CreditApplicationForm.tsx)
- JSON-renderer: [projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/](projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/)

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
bd dolt push          # Push beads data to remote
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

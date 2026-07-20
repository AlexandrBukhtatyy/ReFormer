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

- Простая форма: [projects/react-playground/src/pages/examples/registration-form/RegistrationForm.tsx](projects/react-playground/src/pages/examples/registration-form/RegistrationForm.tsx)
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

  Проверка, что нужна синхронизация: `grep -c '"id"' .beads/issues.jsonl` против `bd list --status=open`
  — если в JSONL меньше, экспорт не делался. Экспорт всегда **append**, старые записи не переписываются;
  перед коммитом полезно убедиться в этом: `git diff --numstat .beads/issues.jsonl` (второе число = 0).

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

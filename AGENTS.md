# Agent Instructions

Гайд для ИИ-агентов (Claude Code, Cursor, другие MCP-клиенты) по работе с монорепо ReFormer.

## ReFormer: документация и MCP

### Где искать документацию по пакету

| Пакет                      | docs/llms/                                                                                 | Что внутри                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `@reformer/core`           | [packages/reformer/docs/llms/](packages/reformer/docs/llms/)                               | API, валидаторы, behaviors, типы, hooks. Обзор — `39-overview.md`.           |
| `@reformer/cdk`            | [packages/reformer-cdk/docs/llms/](packages/reformer-cdk/docs/llms/)                       | Headless: FieldArray, FormWizard, FormField, FileUpload, Autocomplete, List. |
| `@reformer/ui-kit`         | [packages/reformer-ui-kit/docs/llms/](packages/reformer-ui-kit/docs/llms/)                 | Стилизованные компоненты на Tailwind + Radix.                                |
| `@reformer/renderer-react` | [packages/reformer-renderer-react/docs/llms/](packages/reformer-renderer-react/docs/llms/) | Рендерер схем для React.                                                     |
| `@reformer/renderer-json`  | [packages/reformer-renderer-json/docs/llms/](packages/reformer-renderer-json/docs/llms/)   | JSON-схема, реестр компонентов.                                              |
| `@reformer/form-registry`  | [packages/reformer-form-registry/docs/llms/](packages/reformer-form-registry/docs/llms/)   | Реестр форм для микрофронтендов: запись, монтирование, кэш, предпроверка.    |

### MCP-сервер

`@reformer/mcp` — единая точка справки: клиент сервиса ReFormer (нужен ключ `REFORMER_API_KEY`).
Регистрация в Claude Code:

```bash
claude mcp add --transport stdio reformer --env REFORMER_API_KEY=<ключ> -- npx -y @reformer/mcp
```

По умолчанию — два инструмента, `search` и `execute` (форма собирается конструктором по плану сервиса). С `REFORMER_SURFACE=tools`: 10 tools (`choose_api`, `get_context`, `get_symbol_docs`, `find_recipe`, `search_docs`, `list_symbols`, `plan_form`, `form_build`, `validate_form`, `report_issue`); resources `reformer://guide`, `reformer://status`, `reformer://catalog`, `reformer://docs/<пакет>[/<раздел>]`; prompts `start-here`, `add-feature`, `to-renderer`, `review`. Форма создаётся одним путём: грамматика `form_build {"grammar":"base"}` → `<dir>/form.intent.json` → `form_build {"dir":…}` (модуль собирает сервис, файлы пишет клиент); `generate_form` удалён в 7.0. Подробно — [packages/reformer-mcp/README.md](packages/reformer-mcp/README.md) и [обзор MCP](projects/reformer-doc/docs/mcp/overview.md).

### Эталонные примеры

- Простая форма: [projects/react-playground/src/pages/demo/registration-form/RegistrationForm.tsx](projects/react-playground/src/pages/demo/registration-form/RegistrationForm.tsx)
- Multi-step wizard + FieldArray: [projects/react-playground/src/pages/demo/complex-multy-step-form/CreditApplicationForm.tsx](projects/react-playground/src/pages/demo/complex-multy-step-form/CreditApplicationForm.tsx)
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

- [docs/llms-convention.md](docs/llms-convention.md) — формальные правила документации.

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

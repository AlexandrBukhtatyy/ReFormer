# План: убрать playground-зависимости из MCP-сервера и library docs

## Context

После публикации `@reformer/*` в npm у пользователя нет каталога `projects/react-playground/` — есть только `node_modules/@reformer/*`. Сейчас два места нарушают эту границу и сломаются у внешнего пользователя:

1. **Tool `find_example`** в `packages/reformer-mcp/src/tools/find-example.ts` использует `SCENARIO_MAP` с путями `'projects/react-playground/...'` и функцию `locateRepoRoot()`, которая ищет `package.json` с `name === 'reformer-monorepo'`. Из npm-установки эти пути не существуют → tool возвращает только fallback или падает на `existsSync`.
2. **Library docs** содержат **25 markdown-ссылок** вида `[X](../../../../projects/react-playground/...)` в 6 пакетах (`reformer`, `reformer-cdk`, `reformer-ui-kit`, `reformer-renderer-react`, `reformer-renderer-json`). Эти ссылки попадают в `llms.txt` и отдаются через MCP — у внешнего пользователя они некликабельны.

MCP-сервер — это упаковка библиотек, он должен оперировать **только** их собственной документацией (`docs/llms/*.md` + JSDoc/TSDoc). Любая привязка к примерам из монорепо — баг архитектуры.

**Решение:** заменить `find_example` на `find_recipe` (источник — library docs/JSDoc) и вычистить playground-ссылки из библиотечных `.md`.

**Не трогаем** (это документы монорепо, не распространяются в npm): `AGENTS.md`, `README.md` корня и пакетов, `docs/llms-convention.md`, `packages/reformer-mcp/README.md` (там тоже фраза про playground в описании старого tool — обновим в рамках README).

## Декомпозиция (одно issue, без отдельного эпика)

`bd create --type=task --priority=1 --title="Remove playground references from MCP server and library docs"`

### Шаг 1 — Новый tool `find_recipe`

**Создать** `packages/reformer-mcp/src/tools/find-recipe.ts`. Функция:

- Вход: `{ topic: string, package?: string }`.
- Алгоритм поиска (cascade):
  1. **Точное совпадение по имени файла.** Пройти `getPublicSymbols`-инфраструктуру не нужно — переиспользуем `KNOWN_PACKAGES` + резолв путей как в [docs-parser.ts](packages/reformer-mcp/src/utils/docs-parser.ts). Ищем `docs/llms/<topic>.md` или `<NN>-<topic>.md` (с любым числовым префиксом). Если match — вернуть весь файл.
  2. **Match по `## ` заголовку секции.** В каждом `docs/llms/*.md` всех пакетов искать заголовок, содержащий `topic` (case-insensitive). Возвращать секцию до следующего `##` через [`getSection`](packages/reformer-mcp/src/utils/docs-parser.ts).
  3. **Match по public-символу через JSDoc.** Если ни 1, ни 2 не сработали — `findSymbol(topic)` (см. [symbols-parser.ts](packages/reformer-mcp/src/utils/symbols-parser.ts)) → если есть `@example` — вернуть его.
  4. **Fallback:** список доступных тем (имена .md по всем пакетам без `NN-` префикса) + список public-символов (первые 20).
- Выход: markdown с `# <Title>`, `**Source:** <package> · <file>`, тело рецепта/секции/примера.

**Удалить** `packages/reformer-mcp/src/tools/find-example.ts` целиком. Никакого `SCENARIO_MAP`, `locateRepoRoot`, файловых I/O за пределы пакетов в `node_modules`/монорепо — только данные, которые уже подняты в кеш `docs-parser` / `symbols-parser`.

**Подключить:**
- [tools/index.ts](packages/reformer-mcp/src/tools/index.ts) — заменить `findExample*` экспорт на `findRecipe*`.
- [src/index.ts](packages/reformer-mcp/src/index.ts) — переименовать `findExampleToolDefinition` → `findRecipeToolDefinition`, кейс `'find_example'` → `'find_recipe'`.

### Шаг 2 — Очистка library docs (25 ссылок)

Файлы (полный перечень из аудита):

- `packages/reformer/docs/llms/{23-copy-from,24-sync-fields,25-reset-when,26-transform-value,27-revalidate-when,28-submit-and-reset,29-async-preload}.md` — 7 файлов, 7 ссылок (одна на каждый `BehaviorsExamples.tsx`/`RegistrationForm.tsx`/`useLoadCreditApplication`/…).
- `packages/reformer-cdk/docs/llms/{04-form-field,05-recipes}.md` — 3 ссылки.
- `packages/reformer-ui-kit/docs/llms/{01-overview,02-text-fields,03-choice-fields,04-layout-and-buttons,05-form-field-integration}.md` — 7 ссылок.
- `packages/reformer-renderer-react/docs/llms/05-cookbook.md` — 2 ссылки.
- `packages/reformer-renderer-json/docs/llms/{01-overview,03-registry,05-cookbook}.md` — 5 ссылок.

**Правило замены:** убрать markdown-ссылку, оставить упоминание имени файла как inline-кода, без href. Например:

```diff
- См. [CreditApplicationForm.tsx](../../../../projects/react-playground/.../CreditApplicationForm.tsx).
+ Эталонный паттерн в монорепо — `CreditApplicationForm.tsx` (раздел `## ...` ниже).
```

Если упоминание было только «See also»-списком — удалить элемент целиком (а не оставлять «голый» текст без href).

`llms.txt` всех пакетов автоматически обновится после `npm run generate:llms` (шаг 4).

### Шаг 3 — Обновить README MCP-сервера

[packages/reformer-mcp/README.md](packages/reformer-mcp/README.md):
- Заменить `find_example` → `find_recipe` (в таблице tools, в подразделе с примером JSON).
- Обновить описание: «найти рецепт по `topic` в библиотечной документации (docs/llms/) или JSDoc», убрать упоминание `react-playground`.
- В чек-листе verification (внизу): тестовые вызовы `find_recipe` вместо `find_example`.

### Шаг 4 — Регенерация и smoke-test

```bash
npm run build -w @reformer/mcp           # включает npm run generate:llms
npm run generate:llms                     # все пакеты
git diff --stat -- 'packages/*/llms.txt'  # повторный запуск идемпотентен → diff пуст
node scripts/generate-llms-txt packages/reformer --audit
# (audit 0/0 во всех 5 packages по-прежнему ожидается)
```

Smoke-test через Node:

```bash
node -e "import('./packages/reformer-mcp/dist/tools/find-recipe.js').then(async m => {
  console.log((await m.findRecipeTool({ topic: 'copyFrom' })).content[0].text.slice(0, 200));
})"
```

Ожидание: возвращён рецепт из `packages/reformer/docs/llms/23-copy-from.md` (через секцию или файл) либо `@example` блок из `copy-from.ts`.

Дополнительно проверить, что больше нет упоминания playground в выходе MCP:

```bash
grep -RE "react-playground" packages/*/llms.txt && echo "FAIL: still referenced" || echo "PASS: no playground refs"
```

### Шаг 5 — Commit

Один коммит, conventional message:

```
refactor(mcp): drop playground dependency from server and library docs

- replace find_example tool with find_recipe (sources: docs/llms/ and JSDoc only)
- delete SCENARIO_MAP and locateRepoRoot — server now works only from
  installed @reformer/* packages, no monorepo assumptions
- strip 25 markdown links to projects/react-playground/* from
  docs/llms/ in all 6 library packages
- regenerate llms.txt for all packages (idempotent)
- update reformer-mcp README to describe find_recipe
```

## Файлы

**Создаются:**
- `packages/reformer-mcp/src/tools/find-recipe.ts`

**Удаляются:**
- `packages/reformer-mcp/src/tools/find-example.ts`

**Правятся:**
- `packages/reformer-mcp/src/tools/index.ts`
- `packages/reformer-mcp/src/index.ts`
- `packages/reformer-mcp/README.md`
- 18 файлов `packages/*/docs/llms/*.md` (точечно — конкретные строки из аудита, всего 25 правок)

**Регенерируются автоматически:**
- `packages/*/llms.txt` (6 файлов)

## Verification (Definition of Done)

- `grep -R "react-playground" packages/*/llms.txt` — 0 совпадений.
- `grep -R "react-playground" packages/*/docs/llms/*.md` — 0 совпадений.
- `grep -R "react-playground\|locateRepoRoot\|SCENARIO_MAP" packages/reformer-mcp/src` — 0 совпадений.
- `npm run build -w @reformer/mcp` собирается.
- `npm run generate:llms` идемпотентен.
- `node scripts/generate-llms-txt packages/<pkg> --audit` для каждого из 5 пакетов: `Missing description: 0`, `Missing @example (callable only): 0`.
- Smoke-test `find_recipe({ topic: 'copyFrom' })` возвращает непустой markdown с источником `@reformer/core`.
- Smoke-test `find_recipe({ topic: 'wizard' })` возвращает рецепт wizard'а из `@reformer/cdk` (`05-recipes.md` — есть «Externally-controlled wizard»/«Conditional step visibility»).
- README показывает `find_recipe` без упоминания playground.
- Один аккуратный коммит без затрагивания корневого `AGENTS.md`/`README.md`/`docs/llms-convention.md`.

## Out of scope

- Создание промптов-помощников (`create-form`, `add-validation`, …) — отдельная задача, обсуждалась ранее.
- Vitest/integration-тесты MCP — отдельная задача.
- README пакетов в корне (`README.md`, `packages/reformer/README.md`) — там playground остаётся как ссылка на StackBlitz для разработчиков, это легитимно.
- AGENTS.md — это не в npm, ссылки на playground для разработчиков остаются.

# Вынос текстов MCP prompts в .md + Handlebars

## Context

В `packages/reformer-mcp/src/prompts/` сейчас 11 модулей, каждый содержит большой template literal (от ~80 до ~450 строк) прямо в TS-коде. Это мешает редактированию (нет markdown-подсветки, IDE-preview, prettier), плохо diff-ится и смешивает «контент» (тело prompt'а) с «логикой» (вычисление аргументов, построение блоков, регистрация в MCP).

Цель — вынести текстовые тела в отдельные `.md`-файлы с плейсхолдерами и рендерить их через Handlebars. Логика остаётся в TS, шаблоны становятся «глупыми» — просто подстановка переменных.

## Решения (зафиксированы)

1. **Scope**: все 11 prompts разом, в одном PR.
2. **Engine**: Handlebars (`handlebars@^4.7`, типы встроены — `@types/handlebars` не нужен).
3. **Синтаксис**: `{{name}}` с глобальным `noEscape: true` (контент — markdown/код, HTML-escape вреден).
4. **Strict mode**: `Handlebars.compile(..., { strict: true })` + наша pre-validation — опечатки в плейсхолдерах падают сразу, а не превращаются в пустую строку.
5. **Расположение**: `src/prompts/templates/<prompt-name>.md` рядом с TS-модулями.
6. **Build**: `tsc` + новый node-скрипт `scripts/copy-templates.mjs` (zero deps), копирующий `.md` в `dist/`. `tsup` не вводим — слишком большое изменение build-chain.
7. **Логика остаётся в TS**: `${getSection(...)}`, `${getFullDocs(...)}`, тернарные блоки (`stackBlock`, `rendererBlock`) — всё вычисляется на TS-стороне как готовые строки, передаётся в Handlebars как переменные. Никаких `{{#if}}` в шаблонах.

## Этапы

### Этап 0. Baseline snapshot (до любых правок)

Цель — иметь референс для diff'а после миграции.

- Временный (не коммитить) скрипт `packages/reformer-mcp/scripts/snapshot-prompts.mjs`: импортирует каждый `get*Prompt` из `dist/prompts/*.js`, вызывает с фиксированными fake-args, пишет `messages[0].content.text` в `.tmp/baseline/<name>.txt`.
- Запустить после `npm run build`. После Этапа 7 — сравнить с `.tmp/post-migration/`, ожидаем zero diff (или whitespace-only).

### Этап 1. Зависимость и build-pipeline

Файлы: [packages/reformer-mcp/package.json](packages/reformer-mcp/package.json), новый [packages/reformer-mcp/scripts/copy-templates.mjs](packages/reformer-mcp/scripts/copy-templates.mjs).

- `npm i handlebars@^4.7` в `packages/reformer-mcp` (типы встроены).
- Новый `scripts/copy-templates.mjs` (~15 строк): `fs.cpSync(src, dst, { recursive: true, filter: f => f.endsWith('.md') })` из `src/prompts/templates/` → `dist/prompts/templates/`. Стиль повторяет существующий `scripts/generate-llms-txt`.
- `package.json.scripts.build`: `"npm run generate:llms && tsc && node scripts/copy-templates.mjs"`.
- `package.json.scripts.dev`: оставить `tsc --watch`. Loader (Этап 2) читает из `src/` как fallback — dev-режим не требует копирования.
- `files: ["dist", "README.md"]` — без изменений; `.md` поедут внутри `dist/`.

### Этап 2. Loader / Renderer

Новый файл: [packages/reformer-mcp/src/utils/prompt-template-loader.ts](packages/reformer-mcp/src/utils/prompt-template-loader.ts).

API: `renderPromptTemplate(name: string, vars: Record<string, unknown>): string`.

Поведение:
- Path-resolution мирроит [packages/reformer-mcp/src/utils/docs-parser.ts](packages/reformer-mcp/src/utils/docs-parser.ts) — три кандидата:
  1. `__dirname + '../prompts/templates/<name>.md'` — runtime в `dist/`
  2. `__dirname + '../../src/prompts/templates/<name>.md'` — monorepo dev (`tsc --watch`)
  3. `process.cwd() + '/packages/reformer-mcp/src/prompts/templates/<name>.md'` — cwd fallback
- Два кеша: raw text (`Map<string, string>`) и compiled `Handlebars.TemplateDelegate`.
- Compile options: `{ noEscape: true, strict: true }`.
- Pre-validation: regex-скан шаблона на `{{ ([\w.]+) }}` и `{{{ … }}}`, пересечение с `Object.keys(vars)`, `throw` со списком пропущенных. Belt-and-suspenders: `strict: true` ловит большую часть случаев, но даёт менее читаемое сообщение.
- Любой throw из Handlebars оборачиваем с контекстом `template=<name>`.

### Этап 3. Папка шаблонов и нэйминг

Новая директория: `packages/reformer-mcp/src/prompts/templates/`.

10 файлов 1:1 с `*PromptDefinition.name` (kebab-case): `create-form.md`, `add-validation.md`, `add-behavior.md`, `add-form-array.md`, `add-wizard.md`, `plan-form.md`, `review.md`, `to-renderer.md`, `to-renderer-json.md`, `debug.md`. (`index.ts` — без шаблона.)

### Этап 4. Миграция 11 prompts (канонический пример — `create-form`)

Рецепт на каждый файл:

1. Создать `templates/<name>.md`, перенести тело строки из `text:`.
2. Заменить плейсхолдеры:
   - `${args.description}` → `{{description}}`
   - `${target}` → `{{target}}` (+ `{{targetLabel}}` если был тернарный helper — вычисляется в TS)
   - `${stackBlock}`, `${layoutBlock}`, `${rendererBlock}`, `${layoutSection}` → одноимённые `{{…}}`
3. Все `${getSection(...)}` / `${getFullDocs(...)}` — **остаются в TS**: `const quickStart = getSection(...)` и передаются как `{ quickStart, formSchema, imports, ... }`.
4. Условные ветки (тернарии для `rendererBlock` от `target` и т.п.) — **полностью в TS**. В шаблон уходит уже готовый фрагмент-строка как одна переменная.
5. TS-модуль ужимается до: импортов, `*PromptDefinition` (без изменений) и `get<Name>Prompt(args)`, который:
   - вычисляет derived (`target`, `targetLabel`)
   - дёргает `detectProjectStack()` / `getSection()` / `getFullDocs()`
   - собирает vars
   - возвращает `{ messages: [{ role: 'user', content: { type: 'text', text: renderPromptTemplate('<name>', vars) } }] }`

Порядок миграции:
1. `review.md` — самый маленький (86 строк), мало плейсхолдеров. PoC для loader+build.
2. `create-form.md` — каноничный (все типы плейсхолдеров).
3. Остальные: `to-renderer`, `to-renderer-json`, `debug`, `add-validation`, `add-behavior`, `add-wizard`, `add-form-array`.
4. `plan-form.md` **последним** — самый большой (454 строки, наибольший риск).

### Этап 5. Handlebars-коллизии (audit)

Риск: литералы `{{` / `}}` в кодовых блоках (Vue/Liquid примеры, JSX, JSON).

- Перед миграцией каждого файла: `grep -n '{{' src/prompts/<name>.ts`.
- Если хиты есть — оборачивать кодовые блоки в `{{{{raw}}}}…{{{{/raw}}}}` (встроенный raw-block helper Handlebars).
- Высокий риск: [packages/reformer-mcp/src/prompts/add-form-array.ts](packages/reformer-mcp/src/prompts/add-form-array.ts) (JSX `RendererFormArraySection`), [packages/reformer-mcp/src/prompts/to-renderer.ts](packages/reformer-mcp/src/prompts/to-renderer.ts), [packages/reformer-mcp/src/prompts/to-renderer-json.ts](packages/reformer-mcp/src/prompts/to-renderer-json.ts) (JSON), [packages/reformer-mcp/src/prompts/plan-form.ts](packages/reformer-mcp/src/prompts/plan-form.ts).

`noEscape: true` глобально — HTML-escape не вмешивается, остаются только парсер-коллизии `{{`.

### Этап 6. Wiring index.ts

[packages/reformer-mcp/src/index.ts](packages/reformer-mcp/src/index.ts) и [packages/reformer-mcp/src/prompts/index.ts](packages/reformer-mcp/src/prompts/index.ts) — **без изменений**. Сигнатуры геттеров и `*PromptDefinition` сохраняются, `ListPromptsRequestSchema` / `GetPromptRequestSchema` switch'и работают как есть.

### Этап 7. Verification

1. `npm run build` — должен пройти.
2. Запустить `scripts/snapshot-prompts.mjs` → `.tmp/post-migration/`.
3. `diff -r .tmp/baseline .tmp/post-migration` — ZERO diff (или только whitespace; любое содержательное расхождение — расследовать).
4. `npm run dev` smoke: запустить сервер, прогнать `prompts/list` и `prompts/get` по каждому из 10 имён через MCP inspector. Проверить fallback path #2 (monorepo dev) работает без copy-step.
5. Проверить — в пакете нет `.test.ts`/`.spec.ts` для prompts (актуально на Этапе 0). Если появились — обновить.
6. `npm pack --dry-run` — `.md` из `dist/prompts/templates/` попали в tarball.

## Critical files

**Новые:**
- [packages/reformer-mcp/src/utils/prompt-template-loader.ts](packages/reformer-mcp/src/utils/prompt-template-loader.ts) — loader+renderer
- [packages/reformer-mcp/scripts/copy-templates.mjs](packages/reformer-mcp/scripts/copy-templates.mjs) — build copy step
- `packages/reformer-mcp/src/prompts/templates/*.md` — 10 шаблонов

**Меняются:**
- [packages/reformer-mcp/package.json](packages/reformer-mcp/package.json) — `+handlebars`, расширенный `scripts.build`
- [packages/reformer-mcp/src/prompts/create-form.ts](packages/reformer-mcp/src/prompts/create-form.ts) и остальные 9 prompt-модулей — тело геттера ужимается до сбора vars + вызова loader'а

**Reused (без изменений, как референс):**
- [packages/reformer-mcp/src/utils/docs-parser.ts](packages/reformer-mcp/src/utils/docs-parser.ts) — паттерн path-resolution + кеш
- [packages/reformer-mcp/src/utils/project-detector.ts](packages/reformer-mcp/src/utils/project-detector.ts) — поставляет `stackBlock` / `layoutBlock` / `rendererBlock` как готовые строки
- [packages/reformer-mcp/src/index.ts](packages/reformer-mcp/src/index.ts) — MCP-регистрация остаётся как есть

## Риски и митигации

| Риск | Митигация |
|---|---|
| `{{` в JSX/Vue/JSON-кодовых блоках | grep-audit перед миграцией каждого файла; `{{{{raw}}}}` блоки |
| Опечатка в имени переменной → пустая строка | `strict: true` + наша pre-validation с явным списком пропущенных |
| `tsc --watch` не копирует `.md` | loader fallback #2 читает из `src/` напрямую в dev |
| Drift между TS-геттером и vars шаблона | `strict: true` падает при первом вызове в snapshot-тесте |
| `+handlebars` ~22KB gzipped | приемлемо, dev-tool, не браузерный bundle |
| HTML-escape ломает markdown | `noEscape: true` глобально |
| `.md` не попадают в npm tarball | `dist/` целиком в `files`; проверка через `npm pack --dry-run` |

## Out of scope

- Handlebars helpers/partials — loader остаётся минимальным.
- Перенос `getSection`/`getFullDocs` в HB-helpers — переинтродуцирует coupling.
- Шаблонные строки в `project-detector.ts` — отдельная задача, объём небольшой, оставляем inline.

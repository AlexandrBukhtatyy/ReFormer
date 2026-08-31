# LLMs Documentation Convention

Правила документирования библиотек `@reformer/*` для ИИ-агентов (Claude Code, Cursor и других MCP-клиентов через `@reformer/mcp`).

## 1. Принципы

- **Источников правды два**: `docs/llms/*.md` (длинные руководства) и JSDoc/TSDoc на публичных символах в `src/`.
- **`llms.txt` — производный артефакт**: генерируется из этих двух источников билд-скриптом (`generate:llms`). Руками не редактируется, в шапке файла стоит `# AUTO-GENERATED. Edit docs/llms/*.md or JSDoc and run npm run generate:llms`.
- **Парсер `@reformer/mcp` ожидает стабильный формат** — все правила ниже сформулированы так, чтобы парсер из [packages/reformer-mcp/src/utils/docs-parser.ts](../packages/reformer-mcp/src/utils/docs-parser.ts) работал по любому пакету одинаково.
- **Минимум кастомного синтаксиса**: используем стандартный Markdown и стандартные JSDoc-теги. Никаких `@ai-hint` или подобных проприетарных тегов не вводим.

## 2. Структура `docs/llms/` в пакете

Каждый пакет `@reformer/*` содержит каталог `docs/llms/` с нумерованными `.md`-файлами:

```
packages/<package>/
├── docs/
│   └── llms/
│       ├── 01-overview.md          # обязательный
│       ├── 02-<feature>.md
│       ├── 03-<feature>.md
│       └── NN-troubleshooting.md   # обязательный (последний)
├── src/
└── llms.txt                         # AUTO-GENERATED
```

Правила:

- **Имя файла**: `NN-<kebab-case-topic>.md`, где `NN` — двузначный номер (`01`, `02`, …, `99`). Номер задаёт порядок выдачи в `llms.txt`.
- **`01-overview.md` — обязателен**. Это вход для агента, не знакомого с пакетом.
- **Последний файл — troubleshooting** (`NN-troubleshooting.md`), даже если содержит один FAQ.
- Между ними — тематические разделы (один файл = один компонент / hook / валидатор / behavior / архитектурный аспект).

Образец, на который ориентируемся: [packages/reformer-cdk/docs/llms/](../packages/reformer-cdk/docs/llms/).

## 3. Структура одного `.md`-файла

Парсер MCP матчит секции по точным именам заголовков. Используем **фиксированный словарь имён** для секций, по которым агент будет ходить:

| `## Заголовок`                                                  | Когда нужен                        | Что внутри                                                   |
| --------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------ |
| `## Overview`                                                   | в `01-overview.md`                 | Одна-две фразы: что делает пакет, для каких задач.           |
| `## Installation`                                               | в `01-overview.md`                 | `npm install` команда, peer-deps, требуемые версии.          |
| `## Import Patterns`                                            | в `01-overview.md` или per-feature | Правильные импорты с пометками `// recommended`.             |
| `## Quick Start`                                                | в `01-overview.md`                 | Минимальный рабочий пример.                                  |
| `## Architecture`                                               | по необходимости                   | Высокоуровневая схема пакета.                                |
| `## Key Concepts`                                               | per-feature                        | Bulleted list с **bolded** ключевыми терминами и пояснением. |
| `## Components` / `## Hooks` / `## Validators` / `## Behaviors` | per-feature                        | Markdown-таблица: `\| Name \| Purpose \|`.                   |
| `## API Reference`                                              | в `NN-<feature>.md`                | API-сигнатуры из JSDoc, обычно генерируется в `llms.txt`.    |
| `## Common Patterns`                                            | per-feature                        | Рецепты: «как сделать X». Каждый рецепт — fenced code.       |
| `## Anti-patterns`                                              | per-feature                        | Что нельзя делать и почему.                                  |
| `## Examples`                                                   | per-feature                        | Fenced code-блоки с полными работающими примерами.           |
| `## Troubleshooting / FAQ`                                      | в `NN-troubleshooting.md`          | Частые ошибки, решения, ссылки на issues.                    |

Дополнительные правила:

- **Заголовки** только `#` (h1, один на файл, имя темы) и `##` / `###`. Глубже не уходим.
- **Fenced code** — обязательно с указанием языка: `tsx`, `typescript`, `bash`, `json`. Без языка парсер не подсветит и хуже извлечёт.
- **Таблицы** через `| … |` синтаксис. Используем для перечисления компонентов / hooks / validators.
- **Ссылки на эталонные примеры** из `projects/react-playground/src/pages/demo/` — приветствуются в секциях `Examples` и `Common Patterns`. Формат: `[CreditApplicationForm](../../../../projects/react-playground/src/pages/demo/complex-multy-step-form/CreditApplicationForm.tsx)`.
- **Front-matter (YAML)** не используется.
- **Пометки важности** в тексте: `(CRITICALLY IMPORTANT)`, `(DEPRECATED)`. Без кастомных callout-блоков.

## 4. JSDoc / TSDoc на публичных API

Публичный API — всё, что экспортируется из `src/index.ts` пакета (или из `index.ts` подмодулей, если они реэкспортируются).

Каждый публичный символ (функция, тип, класс, hook, компонент, константа) **обязан** иметь JSDoc-блок со следующими полями:

| Тег                        | Обязателен                                                           | Назначение                                                                                                   |
| -------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `описание` (первая строка) | ✅                                                                   | Одна фраза: что делает символ. На русском или английском (придерживаемся языка пакета).                      |
| `@param`                   | ✅ для каждого параметра                                             | Имя + назначение. Тип берётся из TS — повторять не нужно.                                                    |
| `@typeParam`               | ✅ для каждого generic                                               | Имя + назначение.                                                                                            |
| `@returns`                 | ✅ если функция возвращает не `void`                                 | Что возвращается.                                                                                            |
| `@example`                 | ✅ для callable (function, class, hook); рекомендуется для остальных | Минимальный рабочий сниппет. См. правила ниже.                                                               |
| `@see`                     | по необходимости                                                     | Ссылка `{@link OtherSymbol}` или markdown-ссылка на раздел `docs/llms/`.                                     |
| `@group`                   | рекомендуется                                                        | Логическая группировка (`React Hooks`, `Validators`, `Behaviors`). Используется для сортировки в `llms.txt`. |
| `@deprecated`              | при удалении                                                         | Текст с предложением замены.                                                                                 |

**Что считаем callable**: `function`, `class`, и константа, чьё значение — функция/компонент. Hooks (`useXxx`) обычно объявлены через `function` или `const = (…) => …` — оба варианта callable.

**Когда `@example` не обязателен**: интерфейсы (`interface`), type-aliasы (`type X = ...`), enums, чисто типовые экспорты. Если сам тип очевиден по сигнатуре, описания достаточно. Сложные типы (например, дискриминированные unions с не-очевидным использованием) — `@example` остаётся рекомендуемым.

Образец (взят из [packages/reformer/src/hooks/useFormControl.ts](../packages/reformer/src/hooks/useFormControl.ts)):

````typescript
/**
 * React-хук для подписки на состояние {@link FieldNode}.
 *
 * @typeParam T - Тип значения поля
 * @param control - FieldNode для подписки
 * @returns Состояние поля {@link FieldControlState}
 *
 * @group React Hooks
 *
 * @example Текстовое поле с валидацией
 * ```tsx
 * import { useFormControl } from '@reformer/core';
 *
 * function EmailField({ control }) {
 *   const { value, error, setValue, blur } = useFormControl(control);
 *   return <input value={value} onChange={(e) => setValue(e.target.value)} onBlur={blur} />;
 * }
 * ```
 */
export function useFormControl<T extends FormValue>(control: FieldNode<T>): FieldControlState<T>;
````

### 4.1 Правила для `@example`

- **Fenced block с языком** (` ```tsx `, ` ```typescript `, ` ```bash `).
- **Самодостаточный**: импорты + минимальная обвязка. Агент должен иметь возможность скопировать блок в новый файл и почти запустить.
- **Короткий**: 5–30 строк. Длинные сценарии (multi-step forms, FormArray + FormWizard) выносим в `docs/llms/`/`projects/react-playground/` и ссылаемся через `@see`.
- **Заголовок (опционально)**: первая строка после `@example` — короткое описание сценария (`@example Текстовое поле с валидацией`).
- Если у символа есть несколько типичных сценариев — допускается несколько `@example` подряд.

### 4.2 Когда JSDoc не нужен

- На внутренних функциях (`/internal/`, не экспортируются).
- На приватных методах класса.
- На локальных типах, не реэкспортируемых наружу.

## 5. Формат генерируемого `llms.txt`

`llms.txt` лежит в корне каждого пакета (`packages/<package>/llms.txt`) и состоит из четырёх блоков в строго заданном порядке.

````
# <Package Display Name> - LLM Integration Guide
# AUTO-GENERATED. Edit docs/llms/*.md or JSDoc and run npm run generate:llms.

> <one-line description from package.json>
> Package: @reformer/<name>  •  Version: <version>

## Table of Contents
- 01-overview.md
- 02-<feature>.md
- ...

## 1. Overview
<содержимое 01-overview.md, секция Overview>

## 2. Installation
<содержимое секции Installation из 01-overview.md>

## 3. Quick Start
<содержимое секции Quick Start>

<...далее секции из docs/llms/*.md в порядке нумерации файлов и в порядке секций внутри файла, имена секций сохраняются...>

## API Reference
<сгенерировано из JSDoc публичных экспортов; группировка по @group, внутри — алфавитный порядок>

### <SymbolName>

<краткое описание из JSDoc>

**Signature:**
```typescript
<сигнатура из TS-типа>
````

**Parameters:**

- `param` — описание

**Returns:** ...

**Examples:**

```tsx
<содержимое первого @example>
```

[Source: src/path/to/file.ts](src/path/to/file.ts)

```

Правила:

- **AUTO-GENERATED шапка** — обязательна, вторая строка файла.
- **Стабильный порядок**: файлы по номеру, внутри файла — порядок секций как в исходнике; символы — по `@group`, затем алфавитно. Это даёт идемпотентность: повторная генерация не меняет файл (важно для diff'ов в PR).
- **Кодовые блоки** — с языком, как в исходниках.
- **Парсер MCP** ходит по `## NN. <SectionName>` и `### <SubSection>`, поэтому имена секций должны строго совпадать со словарём из §3.

## 6. Чек-лист перед коммитом изменений в документации

- [ ] У публичного символа, который добавил/изменил, есть JSDoc + хотя бы один `@example`.
- [ ] Если изменил/добавил `.md` в `docs/llms/`, имя файла — `NN-<kebab-case>.md`, заголовки совпадают со словарём из §3.
- [ ] `npm run generate:llms -w <package>` выполнен; обновлённый `llms.txt` закоммичен.
- [ ] Повторный `npm run generate:llms -w <package>` не даёт diff (идемпотентность).
- [ ] Если в публичном API произошёл breaking change — добавлен `@deprecated` или запись в `NN-troubleshooting.md`.

## 6.5. `llms-index.json` — машиночитаемый индекс

Рядом с `llms.txt` тот же билд-скрипт кладёт `llms-index.json` — структурированную выжимку
из тех же двух источников. Его читает `@reformer/mcp`: раньше сервер разбирал TypeScript-AST
установленных пакетов в рантайме, что стоило 784 мс на старте и требовало `typescript` (23 MB)
в рантаймных зависимостях. С индексом — 17 мс и без `typescript`.

Ключевое решение: индекс лежит **в каждом библиотечном пакете**, а не внутри `@reformer/mcp`.
Сервер публикуется отдельно от библиотек, и запечённый в нём снапшот немедленно разъехался бы
по версиям с тем, что реально установлено у потребителя.

Что попадает в индекс:

| Поле | Откуда |
| --- | --- |
| `topics[].id` | стем файла `NN-<topic>.md` (не заголовок: `slugify` вырезает кириллицу) |
| `topics[].purpose` / `keyConcepts` / `api` / `patterns` / `examples` / `troubleshooting` / `seeAlso` | секции по словарю §3 — на уровнях `##` И `###` |
| `topics[].antiPatterns` | секции `Anti-patterns`, разобранные по маркерам `// ❌` и `// ✅` в `{why, bad, correctNote, correct}` |
| `topics[].sections[].slug` | ровно те слаги, что сервер выводит из `llms.txt` (`reformer://docs/<pkg>/<slug>`) |
| `symbols[]` | JSDoc публичных экспортов: сигнатура, summary, канонический `@example`, `related`, темы |
| `symbols[].usage` | частота символа в эталонных формах монорепо — сигнал популярности для ранжирования |

Тел секций в индексе НЕТ: они уже есть в `llms.txt`, который сервер кэширует и адресует по
`reformer://docs/<pkg>/<slug>`. Дублировать их — удвоить вес пакета без выигрыша.

`llms-index.json` обязан быть в поле `files` пакета — иначе у потребителя его не будет.
Инварианты (слаги резолвятся, покрыта вся публичная поверхность, ядро DSL на месте)
проверяет `packages/reformer-mcp/tests/index-artifacts.test.ts`.

## 7. Что НЕ редактируем руками

- `llms.txt` в любом пакете. Источники — `docs/llms/*.md` и JSDoc.
- `llms-index.json` в любом пакете. Тот же генератор, те же источники.
- `dist/` любого пакета. Это сборка.

## Связанные документы

- [PROMT.md](../PROMT.md) — бриф задачи (контекст, почему эта конвенция нужна).
- [docs/plans/bright-brewing-forest.md](plans/bright-brewing-forest.md) — план реализации.
- [packages/reformer-mcp/src/utils/docs-parser.ts](../packages/reformer-mcp/src/utils/docs-parser.ts) — парсер, под который рассчитан формат.
```

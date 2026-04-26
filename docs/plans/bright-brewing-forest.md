# Оптимизация PROMT.md

## Context

В корне репозитория лежит `PROMT.md` — четырёхстрочная заметка с идеей: «у нас есть `reformer-mcp`, хочу один MCP-сервер для агентов, и нужно придумать как документировать код для ИИ». Текст содержит опечатку, дублирует мысль в двух предложениях, не учитывает, что MCP-сервер уже реализован, и смешивает две разные задачи (доработка сервера и конвенция документации) без явных критериев приёмки.

Адресат итогового файла — ИИ-агент (Claude Code или другой MCP-клиент), который по нему будет планировать и выполнять реализацию. Нужно дать структурированный бриф: цель, текущее состояние, две связанные задачи с шагами и критериями, ссылки на конкретные файлы.

## Текущее состояние, на которое опирается новый промт

- MCP-сервер уже работает: [packages/reformer-mcp/src/index.ts](packages/reformer-mcp/src/index.ts), tools — [report-issue.ts](packages/reformer-mcp/src/tools/report-issue.ts), [debug.ts](packages/reformer-mcp/src/tools/debug.ts); prompt — [debug.ts](packages/reformer-mcp/src/prompts/debug.ts); resources регистрируются в `index.ts` (`reformer://docs|api|examples|troubleshooting`).
- Парсер `llms.txt`: [packages/reformer-mcp/src/utils/docs-parser.ts](packages/reformer-mcp/src/utils/docs-parser.ts) — ищет файл `llms.txt` только у `@reformer/core`.
- AI-ориентированная документация уже есть в части пакетов:
  - [packages/reformer-cdk/docs/llms/](packages/reformer-cdk/docs/llms/) (overview, form-array, form-navigation)
  - [packages/reformer-ui-kit/docs/llms/](packages/reformer-ui-kit/docs/llms/)
  - [packages/reformer-renderer-react/docs/llms/](packages/reformer-renderer-react/docs/llms/)
- В исходниках уже встречается TSDoc/JSDoc с тегом `@example` (особенно в `packages/reformer/src/`).
- **Источников правды два**: `docs/llms/*.md` и JSDoc/TSDoc в `src/`. Файл `llms.txt` — производный артефакт, который должен **генерироваться** из этих двух источников билд-скриптом, а не редактироваться вручную.
- Без AI-документации: `@reformer/renderer-json` (вообще без README).
- Эталонные примеры использования:
  - [projects/react-playground/src/pages/examples/simple-form/RegistrationForm.tsx](projects/react-playground/src/pages/examples/simple-form/RegistrationForm.tsx)
  - [projects/react-playground/src/pages/examples/complex-multy-step-form/CreditApplicationForm.tsx](projects/react-playground/src/pages/examples/complex-multy-step-form/CreditApplicationForm.tsx)

## Файлы

- `d:\Work\ReFormer\PROMT.md` — полностью перезаписать содержимым из секции «Итоговый текст PROMT.md» ниже.

Других файлов задача не трогает.

## Итоговый текст PROMT.md

````markdown
# Бриф: ReFormer × ИИ-агенты

## Цель
Сделать так, чтобы ИИ-агенты (Claude Code, Cursor и другие MCP-клиенты) разрабатывали формы на `@reformer/*` быстро и без типичных ошибок: правильно использовали сигналы, `useFormControl`, `useMemo`, валидаторы, behaviors и headless-компоненты CDK.

Достижение цели идёт по двум связанным направлениям:
1. **MCP-сервер** `@reformer/mcp` — единая точка справки для агента.
2. **Документация в библиотеках** — источник правды, из которого MCP-сервер автоматически отдаёт ответы.

## Текущее состояние

- MCP-сервер реализован и работает: `packages/reformer-mcp/`. Уже есть:
  - tools: `report_issue`, `debug` (опционально, под флагом `REFORMER_DEBUG`)
  - resources: `reformer://docs`, `reformer://api`, `reformer://examples`, `reformer://troubleshooting`
  - prompt: `debug` (чек-лист анализа кода форм)
  - парсер `llms.txt` (`src/utils/docs-parser.ts`), но только для `@reformer/core`
- AI-документация (`docs/llms/`) есть у `@reformer/cdk`, `@reformer/ui-kit`, `@reformer/renderer-react`.
- В исходниках уже есть JSDoc/TSDoc с тегами `@example` (особенно в `packages/reformer/src/`) — это справка уровня символа.
- **Источников правды два**: `docs/llms/*.md` и JSDoc/TSDoc в `src/`. Файл `llms.txt` — **производный артефакт**, генерируется из них билд-скриптом. Сервер должен и парсить JSDoc прямо, и читать сгенерированный `llms.txt` как индекс.
- AI-документации нет: `@reformer/renderer-json` (нет даже README).
- На уровне репозитория нет общего гайда для агентов (CLAUDE.md/AGENTS.md).
- Эталонные примеры — `projects/react-playground/src/pages/examples/simple-form/RegistrationForm.tsx`, `projects/react-playground/src/pages/examples/complex-multy-step-form/CreditApplicationForm.tsx`.

## Задача 1 — Расширить MCP-сервер до всех библиотек

**Цель:** через один сервер агент получает справку по всем `@reformer/*`, а не только по core.

Сервер опирается на **два источника правды** в каждом пакете и один производный артефакт:
1. `docs/llms/*.md` — длинные руководства, рецепты, anti-patterns. **Источник правды.**
2. **JSDoc/TSDoc в `src/`** — справка уровня символа (функция, тип, компонент) с тегом `@example`. **Источник правды.**
3. `llms.txt` — индекс/выжимка, **сгенерированная** из (1) и (2) скриптом из Задачи 2. Сервер использует его как быстрый индекс, но за полным ответом всегда идёт в (1) или (2).

**Шаги:**
1. Расширить `docs-parser.ts`, чтобы он искал и сливал `llms.txt` из всех пакетов `@reformer/*`, у которых он есть, а не только из `@reformer/core`. Резолвинг — те же три пути (node_modules, монорепо, cwd), но обходом по списку пакетов.
2. Добавить per-package resources вида `reformer://docs/{package}`, `reformer://api/{package}` (или эквивалентную параметризацию), чтобы агент мог запрашивать документацию конкретного пакета.
3. Реализовать парсинг JSDoc/TSDoc из исходников пакетов:
   - либо через `typescript`-AST/`ts-morph` (если он уже доступен), либо через готовую утилиту вроде `typedoc --json`;
   - извлекать описание, сигнатуру, теги `@example`, `@param`, `@returns`, `@deprecated`;
   - кэшировать результат на старте сервера (распарсить один раз).
4. Добавить tool `get_symbol_docs`, принимающий `{ package, symbol }` и возвращающий описание + все `@example` для запрошенного символа (например `getReformerForm`, `FormArray.Root`).
5. Добавить tool `find_example`, принимающий название сценария (`wizard`, `array`, `async-validation`) и возвращающий ссылку + сниппет из `projects/react-playground/src/pages/examples/` **либо** из `@example` в исходниках, если сценарий покрыт там.
6. Зарегистрировать ресурс `reformer://api/{package}` так, чтобы он возвращал список всех публичных символов с короткими описаниями (генерируется из JSDoc), — это позволит агенту узнать, что вообще есть.
7. Дополнить prompt `debug` или добавить prompt `review`, использующий чек-лист из всех пакетов (не только core).

**Критерии приёмки:**
- В `mcp-inspector` видны ресурсы со ссылками на `cdk`, `ui-kit`, `renderer-react`, `core`.
- Тестовый запрос «как сделать FormArray» возвращает текст из `packages/reformer-cdk/docs/llms/02-form-array.md`.
- `find_example("wizard")` возвращает путь к `CreditApplicationForm.tsx` и релевантный сниппет.
- `get_symbol_docs({ package: "@reformer/core", symbol: "getReformerForm" })` возвращает описание и хотя бы один `@example` из исходника.
- `reformer://api/@reformer/core` содержит список публичных функций/типов с описанием из JSDoc.
- Существующие tools (`report_issue`, `debug`) не сломаны.
- Сборка `npm run build -w @reformer/mcp` проходит, smoke-тест `node packages/reformer-mcp/dist/index.js` стартует без ошибок.

## Задача 2 — Конвенция документирования библиотек для ИИ-агентов

**Цель:** единый формат AI-документации в каждом пакете, чтобы Задача 1 могла работать одинаково по всем пакетам, а будущие пакеты — подключались без правки сервера.

Источников правды **два**:
- `docs/llms/*.md` — длинные сценарные руководства, рецепты, anti-patterns.
- **JSDoc/TSDoc на публичных символах в `src/`** — справка уровня символа, обязательно с `@example`.

`llms.txt` в каждом пакете — **производный артефакт**, генерируется скриптом из этих двух источников и коммитится в репозиторий (чтобы скачивающий пакет из npm получал готовый файл, а парсер MCP мог быстро его прочитать без AST-разбора).

**Шаги:**
1. Зафиксировать конвенцию в `docs/llms-convention.md` (новый файл):
   - структура `docs/llms/` (нумерованные разделы overview/api/recipes/troubleshooting);
   - обязательные секции в каждом `.md` (`# Purpose`, `# When to use`, `# Anti-patterns`, `# Examples`);
   - **правила JSDoc/TSDoc** для публичных API: краткое описание, теги `@param`, `@returns`, обязательный `@example` с минимально рабочим сниппетом, `@see` на соответствующий раздел `docs/llms/`. Стандартные теги достаточно — кастомных вроде `@ai-hint` не вводим;
   - формат сгенерированного `llms.txt`: фиксированная структура (header пакета, оглавление `docs/llms/`, список публичных символов с одной строкой описания и ссылкой на `@example` по имени файла), стабильный порядок для воспроизводимости diff-ов.
2. Реализовать генератор `llms.txt` (новый пакет/скрипт, например `scripts/generate-llms-txt/` или внутренний пакет `@reformer/internal-docs-gen`):
   - на вход — путь к пакету;
   - читает `docs/llms/*.md`, парсит `src/` через `ts-morph` (или `typedoc --json`), извлекает публичные экспорты с их JSDoc;
   - выводит `llms.txt` в корень пакета.
3. Подключить генератор как npm-script `build:llms` в каждом `@reformer/*` и добавить его в общий `build`. Запретить ручную правку `llms.txt` через комментарий в шапке файла (`# AUTO-GENERATED. Edit docs/llms/*.md or JSDoc and run npm run build:llms.`).
4. Привести к конвенции пакеты с пробелами:
   - `@reformer/renderer-json` — создать `docs/llms/` и JSDoc на публичных API.
   - `@reformer/renderer-react` — дописать недостающие разделы и JSDoc.
5. Пройтись по публичным экспортам каждого пакета и убедиться, что у каждого есть JSDoc + хотя бы один `@example`. Образец — существующие комментарии из `packages/reformer/src/`.
6. Сгенерировать `llms.txt` для всех `@reformer/*` через новый скрипт и закоммитить.
7. На уровне репозитория добавить `AGENTS.md` со ссылками: где искать документацию пакета, как зарегистрировать MCP-сервер, какие команды запускать, как пользоваться tools `get_symbol_docs` и `find_example`, и явное правило «`llms.txt` не редактируем — правим источники».

**Критерии приёмки:**
- У каждого `@reformer/*` есть `docs/llms/` с минимальным набором секций по конвенции и сгенерированный `llms.txt` с пометкой «AUTO-GENERATED».
- У каждого публичного символа в `src/` есть JSDoc и хотя бы один `@example` (выборочная проверка по экспортам из `index.ts`).
- `docs/llms-convention.md` существует и описывает обязательные секции, правила JSDoc и формат генерируемого `llms.txt`.
- Запуск `npm run build:llms -ws` идемпотентен: повторный запуск после чистого билда не меняет файлы (`git diff` пуст).
- `AGENTS.md` существует в корне репозитория и содержит правило «не редактировать `llms.txt` руками».
- Парсер из Задачи 1 успешно подхватывает оба источника во всех пакетах.

## Зависимости между задачами

Задача 1 (сервер) опирается на формат, зафиксированный в Задаче 2 (конвенция + генератор). Рекомендуемый порядок:
1. Задача 2, шаг 1 — зафиксировать конвенцию и формат генерируемого `llms.txt`.
2. Задача 2, шаги 2–3 — реализовать генератор и подключить его как `build:llms`.
3. Задача 1, шаги 1–6 — расширять сервер уже под стабильный формат.
4. Задача 2, шаги 4–7 — докоммитывать документацию пакетов и регенерировать `llms.txt`. Парсер MCP подхватит изменения автоматически.

## Out of scope

- Замена транспорта MCP (stdio остаётся).
- Публикация пакетов в npm — только локальная работа в монорепо.
- Перевод существующей документации на другой язык — текущая смесь RU/EN сохраняется.
````

## Verification

1. Открыть `PROMT.md` — он содержит две явно выделенные задачи с шагами и критериями приёмки, ссылки на конкретные файлы из репозитория, секцию текущего состояния.
2. Передать `PROMT.md` Claude Code и попросить «реализуй задачу 1, шаг 1» — агент должен идти прямо в `packages/reformer-mcp/src/utils/docs-parser.ts` без догадок о структуре.
3. Запустить `git diff PROMT.md` — изменения только в этом файле, других правок нет.

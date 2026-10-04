# Tools

Callable tools exposed by the server (use ListTools to enumerate at runtime). Names and
arguments are exact.

## get_context

Собранный контекст под ОДИН шаг работы: оператор + сигнатура + канонический пример + правила,
анти-паттерны и ссылки, дедуплицированные и урезанные по бюджету.

- `task` (string, required) — задача своими словами, по-русски или по-английски.
- `topics` (string[], optional) — id тем из `reformer://catalog`; без них темы выводятся из задачи.
- `target` (string, optional) — `core` | `cdk` | `ui-kit` | `renderer-react` | `renderer-json`.
- `profile` (string, optional) — `minimal` (~400 tok) | `implementation` (по умолчанию, ~1000)
  | `debug` (~1800, анти-паттерны впереди примера) | `full` (без потолка).
- `maxTokens` (number, optional) — жёсткий потолок, перекрывает профиль.

**Для точечного вопроса «каким API это делается» дешевле и точнее `choose_api`.** Это замерено,
а не предположение: как ЕДИНСТВЕННЫЙ вызов `get_context` даёт first-pass 69.6% против 95.7% у
связки `choose_api` + точечный поиск, при вдвое большей цене задачи. `get_context` полезен, когда
нужен контекст под целый шаг сразу либо жёсткий потолок токенов.

Форма ответа отражает уверенность: если правило не сработало и ни один символ не подтверждён
найденными секциями, блока `## API` не будет — вместо него выдача честно скажет об этом и
поведёт секциями. Пустой блок безопаснее уверенной догадки.

## choose_api

Какой оператор ReFormer решает требование, сформулированное своими словами. Отвечает на
вопрос, которого не закрывает поиск по документации: **какой из двух похожих** —
`computeFrom` vs `copyFrom`, `copyFrom` vs `syncFields`, `enableWhen` vs `hideWhen`,
`resetWhen` vs `enableWhen`, `validateWhen` vs `enableWhen`, `resetWhen` vs `onChange`.

Последняя пара — про триггер, и её путают чаще всего. `resetWhen` держится **условием**
(«пока способ оплаты не карта»), а «очистить поле, когда изменилось управляющее» — это
**факт изменения**, то есть `onChange`. Очистка массива тоже `onChange`: у `ModelArray`
есть собственный `.clear()`, а `resetValue` к нему неприменим.

- `requirement` (string, required) — ОДНО требование, по-русски или по-английски. Например:
  «поле B доступно только когда A заполнено», «total = price \* quantity»,
  «confirmPassword must match password».
- `target` (string, optional) — `core` | `renderer-react` | `renderer-json`; сужает запасной
  поиск, если правило не сработало.

Возвращает рекомендованный символ с сигнатурой, каноническим примером, объяснением «почему
именно он», списком «а вот когда НЕ он» и анти-паттернами, которые документация записала
для этой подмены. Детерминирован: то же требование — тот же ответ.

Замерено на корпусе eval (46 задач): с `choose_api` первым шагом first-pass 80.4% → 95.7%,
токенов на задачу median 916 → 299, нерешённых задач не осталось.

## get_symbol_docs

Full JSDoc for one public symbol of any `@reformer/*` package: description, signature,
params, `@returns`, every `@example`, source path.

- `symbol` (string, required) — e.g. `"createForm"`, `"validateModel"`, `"FormArray"`.
- `package` (string, optional) — e.g. `"@reformer/core"`; omit to search all.

Use before writing code against an unfamiliar symbol.

## find_recipe

A worked example / how-to for a scenario. Cascade: docs/llms filename → `##` section →
symbol `@example` → **full-text search** (same index as `search_docs`) → fallback list.
An unknown topic is no longer a dead end: it comes back as ranked `reformer://docs/…`
candidates with snippets, and the top hit is inlined when it matches a section heading.

- `topic` (string, required) — keyword. Aliases resolve intuitive terms: `wizard`→multi-step,
  `form-array`→arrays, `cycle`→cycle-detection, `copy`→copy-from, `sync`→sync-fields (value
  propagation between fields — a **behavior**), and the validation contract:
  `validate`/`validation`/`cross`/`cross-field`/`validate-async`/`validate-when`→`validation`
  (the `validate`/`validateAsync`/`validateWhen`/`cross`/`apply`/`applyEach` operators + the external
  `validateModel(model, schema)` runner), `json-schema`, `unified-contract` (the contract of a form in
  one place: one schema, one assembly, one behavior), etc.
- `package` (string, optional).

Use to copy a correct pattern instead of guessing.

## search_docs

Full-text search across every documentation section of all `@reformer/*` packages — for when
you can't name the symbol or recipe topic but can describe the task in words. Returns ranked
sections with their `reformer://docs/<pkg>/<slug>` resource URI + a matched snippet; read the
URI to get the full section.

- `query` (string, required) — e.g. `"conditional required validation"`, `"reset form after submit"`.
- `package` (string, optional) — one package or `*`.
- `limit` (number, optional) — default 10, max 25.

Reach for `find_recipe` (curated topic→recipe) or `get_symbol_docs` (one symbol) when you
already know the topic or name; `search_docs` is the fallback when you don't.

## list_symbols

The API surface by kind and package — discovery when you don't know a name.

- `kind` (optional) — `function` | `class` | `interface` | `type` | `const` | `enum`.
- `package` (optional) — one package or `*`.
- `nameContains` (optional) — case-insensitive substring of the symbol name (e.g. `"validate"`,
  `"FileUpload"`). Strongly recommended: the unfiltered surface is 800+ symbols.

E.g. all functions of `@reformer/core` enumerate every validator and behavior. Then
`get_symbol_docs` the one you want.

## validate_form

Одна дверь во все проверки формы. Вид проверки — аргумент `kind`, результат всегда одной
формы: диагностики `RF0xx` с местом, тем что сделать и готовым следующим вызовом.

- `kind: "code"` — сгенерированный TypeScript. Ловит то, чего не видит `tsc`: неизвестный
  символ `@reformer/*` (`RF002`, с подсказкой похожих имён), импорт не из того пакета ИЛИ
  не из того подпути (`RF003` — `validate` живёт только в `@reformer/core/validation`),
  оператор валидации/поведения вне своей схемы (`RF004`/`RF005` — правило просто не
  зарегистрируется, и поле молча не будет валидироваться), `@deprecated` и прежний контракт формы
  (`RF010`): фабрики `createCoreForm` / `createReactForm` / `createJsonForm`, хуки `useReactForm` /
  `useJsonForm`, `JsonFormRenderer`, ключи узла `value:` / `array:`, оператор `each`,
  `makeValidationConfig`, поле `renderBehavior` — с названной заменой и адресом рецепта
  `find_recipe unified-contract`.
- `kind: "json-schema"` — документ схемы (JSON-DSL): структура узлов, синтаксис операторов,
  неизвестные имена компонентов и источников данных. Принимает оба формата — текущий
  (`"format": 2`: ключ `model`, словарь `parts`, оператор `$part`) и прежний.
- `kind: "behaviors"` — циклы в вычисляемых полях (`RF006`), по объявленным
  `{ target, reads[] }`.
- `kind: "bundle"` — `intent` + схема сверяются МЕЖДУ СОБОЙ: каждый `$model` есть в
  модели (пути внутри части — от группы, к которой она подключена), каждый `$component`
  зарегистрирован, каждая часть `$part` объявлена, каждая цель правила существует, селекторы
  видимости присутствуют в схеме.
- `kind: "layout"` — ИМЕНА файлов модуля формы против канона (`files[]` + `target`). Набор один
  на все таргеты; файлы прежнего контракта (`form.render.ts`, `wizard.tsx`, `renderer.*`,
  `validation.ts`) — предупреждения с подсказкой, куда перенести содержимое.

Ограничения проверки печатаются ВСЕГДА, включая чистый отчёт: «✅ ошибок нет» не должно
читаться как «код верен» — разбор построчный, без TypeScript-AST (это сознательный отказ:
`typescript` весит 23 MB и вынесен из обязательных зависимостей).

Прежние `validate_json_schema` и `check_behaviors` заменены этим инструментом.

## plan_form

Спека (markdown) или описание → `FormIntent`: машиночитаемый план формы (поля, массивы,
правила, поведение, разметка, подформы `parts`), который человек читает и правит до генерации
кода.

- `specPath` (string, optional) — путь к спеке, абсолютный или от корня репозитория.
- `description` (string, optional) — свободное описание, если спеки нет.
- `target` (string, optional) — `core` | `renderer-react` | `renderer-json`.

Разбор эвристический и честно об этом говорит: типы полей и компоненты угаданы по тексту.

## generate_form

`FormIntent` → бандл файлов единого контракта формы плюс кросс-проверка файлов между собой.
Набор один на все таргеты: `model.ts` (фабрика модели, шаблоны строк массивов — `arrayOf`),
`form.schema.ts` (одно дерево узлов: TS-билдер для `core` и `renderer-react`, документ формата 2
в `defineJsonSchema<T>` для `renderer-json`), `form.validation.ts` (подформы — `apply`, массивы —
`applyEach`, шаги визарда — по `selector`), `form.behavior.ts` (единственное поведение: связи над
моделью и правила узлов схемы); `renderer-json` получает ещё `registry.ts`. Манифест печатает и
образец сборки `index.tsx` — `createForm` + `useFormBundle`.

Возвращает МАНИФЕСТ — файлы пишет клиент через свой Write и свой permission-гейт: сервер живёт
в своём процессе и корня репозитория не знает.

Подформа в intent: разметка объявляется один раз в `parts: { <имя>: LayoutNode }` и ставится узлом
`{ kind: "part", ref: "<путь группы>", part: "<имя>" }`; пути полей внутри части — от группы.

- `intent` (object, required) — обычно из `plan_form`; неполный нормализуется с warnings.
- `target` (string, optional) — перекрывает `intent.target`.

## report_issue

Record a ReFormer problem + its fix as a JSON report on disk — one file per report,
`<project root>/.reformer/issue_reports/<timestamp>-<slug>.json`.

- `error` (string, required), `solution` (string, required), optional `tags`, `context`.

The directory is configurable via the `REFORMER_ISSUE_REPORTS_DIR` env var (relative values
resolve against the server cwd). Project root = nearest `package.json` with dependencies above
cwd, searched from outside `node_modules` (an npx run from `node_modules/@reformer/mcp` still writes
to the app); when there is none, reports land in cwd itself. The default `.reformer/` gets its own
`.gitignore`, so reports never reach your commits.

Use when you discover and fix a non-obvious ReFormer error, to help future runs.

---

_A `debug` tool exists only when the server runs with `REFORMER_DEBUG=true`; ignore it in normal use._

# Тестирование `@reformer/mcp`

Сервер проверяется на нескольких уровнях: от тестов пакета, которые идут за минуту, до стендов, где
форму собирает настоящий агент. Здесь описано, что ловит каждый уровень, как его запустить и где он
идёт в CI. Методика стендов качества и их цифры — в [docs/mcp-eval/](../../../docs/mcp-eval/README.md).

| Уровень           | Что ловит                                                            | Команда                                                 | В CI                          |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------- |
| Тесты пакета      | инструменты, сборку формы, поверхность сервера, каналы node и worker | `npm run test -w @reformer/mcp`                         | `test.yml`, строгий режим     |
| Типы тестов       | ошибки типов в `src/` и `tests/` — vitest типы не проверяет          | `npm run typecheck:tests -w @reformer/mcp`              | `test.yml`                    |
| Тексты промптов   | промпт учит снятому API; промпт не рендерится                        | `npm run check:mcp-prompts`, `npm run check:mcp-render` | `test.yml`                    |
| Упаковка          | под `npx` вне монорепо сервер не находит справку и рецепты           | `npm run check:packaging -w @reformer/mcp`              | `test.yml`                    |
| Извлечение знания | сервер хуже отдаёт нужное API или стал дороже по токенам и вызовам   | `npm run mcp:evaluate`                                  | `test.yml`, гейт              |
| Калибровка        | путь «спека → intent → модуль» ломается на эталонных формах          | `npm run mcp:calibrate -- --gate`                       | `mcp-quality.yml`             |
| Сценарии          | агент с этим сервером не доходит до рабочей формы                    | `npm run mcp:verify`, `npm run mcp:scenarios`           | `mcp-quality.yml`, без модели |
| Ручная проверка   | то, что проще увидеть глазами                                        | `scripts/mcp-call.mjs`, MCP Inspector, Claude Code      | —                             |

Все команды запускаются из корня репозитория.

## Тесты пакета

### Запуск

```bash
npm run test -w @reformer/mcp                              # весь набор
npm run test -w @reformer/mcp -- tests/form-build.test.ts  # один файл
npm run test -w @reformer/mcp -- -t 'грамматика'           # по имени теста
REFORMER_TEST_STRICT=1 npm run test -w @reformer/mcp       # как в CI
npm run test:watch -w @reformer/mcp                        # watch
```

Своего конфига vitest у пакета нет: работают умолчания, тесты — `tests/*.test.ts`, корень — каталог
пакета. Весь набор идёт около минуты.

`npm test` запускает vitest через обёртку [scripts/run-vitest.mjs](../../../scripts/run-vitest.mjs).
Vitest 4 иногда не завершает процесс после прогона
([vitest-dev/vitest#8766](https://github.com/vitest-dev/vitest/issues/8766)). Если вывод молчит
60 секунд, обёртка снимает процесс и определяет код выхода по выводу. Если итоговой строки нет, она
сверяет отчитавшиеся файлы со списком `vitest list`. Поэтому после последнего теста команда иногда
молчит минуту: это обёртка ждёт, тест не завис. Порог задают `VITEST_IDLE_KILL_MS` (по умолчанию
`60000`) и `VITEST_MIN_RUN_MS` (`5000`). Тесту, который долго молчит, поднимите порог или запустите
`npx vitest run` из каталога пакета.

Тесты импортируют код из `src/`, так что большинству сборка не нужна. Через собранный `dist/` идут
те, что проверяют публикуемый артефакт: сервер под Node по stdio, бандл воркера, метка сборки,
агент Ollama на настоящем сервере.

### Что где проверяется

| Группа                   | Файлы `tests/`                                                                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Сборка формы и intent    | `form-build`, `generate-form*`, `intent-*`, `judge`, `behavior-*`, `text-nodes`, `document`, `unified-contract`, `form-from-spec` (спека → intent → бандл → живая форма)                                        |
| Инструменты              | `plan-form`, `validate-form*`, `validate-json-schema`, `find-recipe*`, `search-docs`, `get-context`, `api-decision` (`choose_api`), `tool-filters`, `facade`, `report-issue`, `tool-errors`, `repeat-and-shape` |
| Кит и ядро               | `ui-kit-*`, `kit-components`, `component-names`, `core-operators`, `operator-catalog`, `symbols-aliases`                                                                                                        |
| Справка и индексы        | `docs-sections`, `index-artifacts`, `index-loader`, `context-budget`, `prompt-doc-links`, `prompt-imports`, `package-locator`                                                                                   |
| Сервер и каналы          | `surface-golden`, `server-catalog`, `resources-catalog`, `node-server`, `knowledge-status`, `build-stamp`, `browser-knowledge`, `worker-bundle`, `worker-transport`, `worker-texts`                             |
| Приборы стендов качества | `eval-*`, `run-records`, `verify-contract`: модель подменена записанными ответами, сеть не нужна                                                                                                                |
| Сам набор                | `test-preconditions`                                                                                                                                                                                            |

Вспомогательное лежит в `tests/support/`:

- `preconditions.ts` — условный запуск тестов (см. ниже);
- `catalogs.ts` — справочники генератора: `component-catalog.json` ui-kit и `llms-index.json` ядра.
  Оба файла в git, поэтому снимки генератора детерминированы;
- `hostile-intents.ts` — входы intent, на которых сервер когда-то падал внутренней ошибкой
  (`-32603`). Сборка обязана отвечать на них диагностикой.

Спека для `plan_form` и снимков — `tests/fixtures/spec-loan-request.md`.

### Предусловия и строгий режим

Часть тестов не имеет смысла без артефакта: справки пакетов, собранного `dist`, каталога кита.
Локально такой тест пропускается, чтобы пакет можно было проверять без полной сборки. В CI тот же
пропуск опасен: сломанная сборка справки молча выключила бы десятки тестов, а прогон остался бы
зелёным. Поэтому при `REFORMER_TEST_STRICT=1` невыполненное предусловие роняет тест с подсказкой,
что собрать.

| Предусловие                                               | Как получить                                                          | Где нужно                                                          |
| --------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| справка и индексы пакетов (`llms.txt`, `llms-index.json`) | лежат в git; после правки справки пакета — `npm run build -w <пакет>` | тесты инструментов знания, справки, каналов                        |
| собранный сервер и бандл воркера                          | `npm run build -w @reformer/mcp`                                      | `node-server`, `worker-bundle`, `build-stamp`, `eval-ollama-agent` |
| props-схемы ui-kit в каталоге кита                        | `npm run generate:catalog -w @reformer/ui-kit`                        | `validate-json-schema`                                             |
| POSIX                                                     | на Windows тест пропускается                                          | `eval-claude-agent`                                                |

Строгий режим рассчитан на Linux в CI: на Windows `eval-claude-agent` в нём упадёт.

Условный пропуск оформляется только через `precondition` из
[tests/support/preconditions.ts](../tests/support/preconditions.ts):

```ts
import { precondition } from './support/preconditions';

const hasDist = precondition(
  'сборка сервера',
  existsSync(distEntry),
  'npm run build -w @reformer/mcp'
);

describe.runIf(hasDist)('сервер под Node', () => {
  // …
});
```

`test-preconditions.test.ts` проверяет, что каждый файл с `runIf`, `skipIf`, `describe.skip`,
`it.skip` или `test.skip` зовёт `precondition`. Голый `skipIf` или `cond ? describe : describe.skip`
обходил строгий режим и выключал тесты молча.

### Снимки

Два набора снимков. Любую правку того, что они фиксируют, видно в ревью построчно.

- `tests/__golden__/surface/` — поверхность сервера: инструменты профилей node и browser, промпты,
  шаблоны ресурсов, инструкции сервера, грамматика intent (`base` и `all`), начало справки
  (`reformer://guide`). Это то, что агент оплачивает при подключении и читает раньше любого ответа.
  Рядом стоят потолки размера (`TOOLS_TOKENS_CEILING`, `STATIC_TOKENS_CEILING`): они выше
  `static` в [eval/baselines/baseline.json](../eval/baselines/baseline.json) с запасом, а точный гейт
  размера держит `mcp:evaluate`. Снимки воркера пишет `worker-texts.test.ts`.
- `tests/__golden__/generate-form/` — модули, которые пишет `form_build`: три intent (заявка на заём
  из фикстуры, регистрация и кредит из `eval/calibration/cases/`) под три таргета.

Правка намеренная — обновите снимок и разберите дифф:

```bash
cd packages/reformer-mcp
npx vitest run tests/surface-golden.test.ts -u
npx vitest run tests/generate-form-golden.test.ts -u
```

Если поверхность выросла, обновите и baseline `mcp:evaluate` (см. ниже), иначе гейт в CI упадёт.

### Тяжёлые и медленные тесты

- Тесты, которые разбирают TypeScript-AST всех пакетов, берут `AST_HEAVY_TIMEOUT_MS` (30 с) из
  [tests/timeouts.ts](../tests/timeouts.ts). Под параллельной нагрузкой такой тест идёт 6–7 секунд
  вместо 0,35. Глобальный таймаут не поднимается: он скрыл бы по-настоящему медленные тесты.
- Свойства генератора (`generate-form-property.test.ts`) идут на случайных допустимых intent
  (fast-check, seed зафиксирован). Самая дорогая часть — десять случайных форм через `tsc` с
  настоящими типами — занимает десятки секунд. Она включается только с `REFORMER_TEST_SLOW=1`
  и идёт в ночном `mcp-quality.yml`:

  ```bash
  REFORMER_TEST_SLOW=1 npm run test -w @reformer/mcp -- tests/generate-form-property.test.ts
  ```

### Типы тестов

Vitest снимает типы и не проверяет их. Ошибки типов в тестах и `src/` ловит отдельный шаг:

```bash
npm run typecheck:tests -w @reformer/mcp   # tsc -p tests/tsconfig.json
```

### Как добавить тест

1. Файл `tests/<тема>.test.ts`, код — из `../src/…`.
2. Нужен артефакт — условие через `precondition` и `describe.runIf`/`it.runIf`.
3. Тест разбирает AST пакетов — таймаут `AST_HEAVY_TIMEOUT_MS`.
4. Правка меняет поверхность или вывод генератора — обновите снимки с `-u` и проверьте дифф.
5. Тест прибора стенда — модель подменяется записанными ответами, сеть не используется.
6. Перед коммитом — `npm run test` и `npm run typecheck:tests` пакета.

## Тексты промптов и упаковка

```bash
npm run check:mcp-prompts                  # промпты не учат снятому API ядра
npm run build -w @reformer/mcp
npm run check:mcp-render                   # каждый промпт из dist/prompts рендерится
npm run check:packaging -w @reformer/mcp   # сервер работает так, как его получит потребитель
```

- `check:mcp-prompts` ищет в текстах промптов снятое API ядра (`validateFormModel`,
  `ModelValidator`, `validators: [...]` на поле). Упоминать его можно только в отрицательном
  контексте («removed», «❌»). Такой код компилируется, поэтому ни `tsc`, ни ESLint его не видят.
- `check:mcp-render` рендерит каждый промпт из барреля `dist/prompts` и проверяет, что в шаблонах
  нет неэкранированных `{{…}}`. Нужна сборка пакета.
- `check:packaging` пакует `@reformer/mcp`, `@reformer/core` и `@reformer/cdk`, ставит тарболы в
  чистый проект во временном каталоге ОС и проверяет `reformer://guide` и `find_recipe` по файловым
  рецептам. Вне монорепо: внутри него Node находит недостающие файлы, поднимаясь по каталогам, и
  проверка ложно зеленеет. Нужны собранные mcp, core и cdk и сеть: зависимости ставятся из npm.

## Стенды качества

Стенды меряют сервер целиком, а не отдельную функцию. Запускаются из корня, сырьё и отчёты пишут в
`.tmp/` корня.

| Стенд             | Вопрос                                                                    | Методика                                                |
| ----------------- | ------------------------------------------------------------------------- | ------------------------------------------------------- |
| Извлечение знания | отдаёт ли сервер нужное API и за сколько вызовов и токенов                | [README.md](../../../docs/mcp-eval/README.md)           |
| Калибровка        | собирается ли рабочая форма по эталонам на известном маршруте, без модели | [calibration.md](../../../docs/mcp-eval/calibration.md) |
| Сценарии          | что получится, если задание получит настоящий агент                       | [scenarios.md](../../../docs/mcp-eval/scenarios.md)     |

```bash
# Извлечение знания: гейт против eval/baselines/baseline.json
npm run mcp:evaluate
npm run mcp:evaluate -- --save packages/reformer-mcp/eval/baselines/baseline.json  # намеренное изменение

# Калибровка: нужны собранный пакет и бандл конструктора
npm run build -w @reformer/mcp
npm run mcp:build -w reformer-builder-playground
npm run mcp:calibrate -- --gate          # против eval/baselines/calibration-baseline.json
npm run mcp:calibrate -- --e2e           # плюс T3: формы монтируются в playground, идут e2e эталонов
npm run mcp:calibrate -- --save-baseline

# Сценарии без модели
npm run mcp:verify -- --golden           # эталоны выполняют свои контракты
npm run mcp:verify -- --negative         # сломанные формы падают на своей проверке
npm run mcp:scenarios -- --matrix smoke  # весь путь, агент replay
npm run mcp:mutate                       # сервер ломается намеренно — приборы обязаны покраснеть
```

Прогоны с моделью (`--agent claude-code`, `--agent ollama`) идут только локально: они тратят лимит и
не детерминированы. Claude Code на macOS запускается только с `CLAUDE_CODE_OAUTH_TOKEN`
(`claude setup-token`), Ollama берётся с `OLLAMA_BASE_URL` (по умолчанию `http://localhost:11434`).
Флаги, бюджет и разбор прогона — в [scenarios.md](../../../docs/mcp-eval/scenarios.md).

Записи прогонов всех стендов — в одном формате. Они остаются в `.tmp/mcp-runs/<батч>/` вместе с
сырьём и в git не едут. В git едет история метрик: `npm run mcp:history -- add <батч>` добавляет
точки батча в [eval/runs/history.json](../eval/runs/README.md), а `npm run mcp:report` строит по ней
дашборд с графиками и отметками событий. Записи читают `npm run mcp:compare -- <A> <B>` и
`npm run mcp:log -- latest` (прогон одним диалогом: задание, шаги модели, вызовы и ответы
сервера).

## CI

| Workflow                                                      | Когда                                                                                        | Что проверяет в `@reformer/mcp`                                                                                                                                                                                |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [test.yml](../../../.github/workflows/test.yml)               | из `ci.yml` (push в `develop`, PR в `main` и `develop`) и из `release.yml` перед публикацией | `check:mcp-prompts` → сборка → тесты с `REFORMER_TEST_STRICT=1` → `typecheck:tests` → `check:mcp-render` → `mcp:evaluate` → … → `check:packaging`                                                              |
| [mcp-quality.yml](../../../.github/workflows/mcp-quality.yml) | push в `main`, каждую ночь в 03:17 UTC, вручную                                              | сборка всех пакетов и бандла конструктора → медленные свойства генератора (`REFORMER_TEST_SLOW=1`) → `mcp:calibrate --gate` → `mcp:verify --golden` → `mcp:verify --negative` → `mcp:scenarios --matrix smoke` |

Прогоны с моделью в CI не идут ни в одном workflow.

## Ручная проверка

Сначала соберите сервер: `npm run build -w @reformer/mcp`.

Один запрос к собранному серверу по stdio — `scripts/mcp-call.mjs` в корне репозитория:

```bash
node scripts/mcp-call.mjs tools/list
node scripts/mcp-call.mjs resources/read '{"uri":"reformer://status"}'
node scripts/mcp-call.mjs tools/call '{"name":"form_build","arguments":{"grammar":"base"}}'
```

Веб-интерфейс с инструментами, ресурсами и промптами — MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node packages/reformer-mcp/dist/index.js
npx @modelcontextprotocol/inspector -e REFORMER_DEBUG=true node packages/reformer-mcp/dist/index.js
```

В Claude Code:

```bash
claude mcp add --transport stdio reformer -- node "$PWD/packages/reformer-mcp/dist/index.js"
claude mcp list
```

На что смотреть:

- Эталон поверхности — снимки в [tests/\_\_golden\_\_/surface/](../tests/__golden__/surface/):
  `tools.node.json` (stdio-сервер), `tools.browser.json` (воркер конструктора), `prompts.json`,
  `resource-templates.json`. Список инструментов в этом документе не дублируется.
- `reformer://status` показывает, какие пакеты сервер нашёл, есть ли у них справка и индексы и
  может ли `form_build` проверять типы. Смотрите его первым, если инструмент отвечает «documentation
  not found» или сборка не проверяет типы.
- Сервер пишет журнал только в stderr: stdout занят протоколом.
- Отладка — переменными окружения сервера (таблица — в
  [README](../README.md#переменные-окружения)): `REFORMER_DEBUG=true` включает инструмент и промпт
  `debug` и ресурс `reformer://debug`; `REFORMER_TRACE_FILE=<абсолютный путь>` пишет журнал вызовов,
  с `REFORMER_TRACE_FULL=1` — с аргументами и ответами целиком.

Сравнить промпты до и после правки можно так: `scripts/snapshot-prompts.mjs` пишет вывод каждого
промпта в файл.

```bash
npm run build -w @reformer/mcp
node packages/reformer-mcp/scripts/snapshot-prompts.mjs .tmp/before
# … правка …
npm run build -w @reformer/mcp
node packages/reformer-mcp/scripts/snapshot-prompts.mjs .tmp/after
diff -r .tmp/before .tmp/after
```

## Если что-то не так

| Симптом                                                    | Причина и что делать                                                                                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| локально часть тестов пропущена                            | нет артефакта. Запустите с `REFORMER_TEST_STRICT=1` — тест назовёт, что собрать                                                                 |
| `npm test` молчит минуту после последнего теста            | обёртка ждёт простоя vitest, см. «Запуск»                                                                                                       |
| снимок разошёлся                                           | правка намеренная — `-u` и разбор диффа; ненамеренная — регресс                                                                                 |
| `mcp:evaluate` красный после намеренной правки поверхности | обновите baseline тем же прогоном (`--save`) и закоммитьте вместе с правкой                                                                     |
| тесты сервера или воркера видят старое поведение           | `dist` собран до правки: `npm run build -w @reformer/mcp`. Пакеты `@reformer/*` тоже потребляются из `dist` — после их правки пересоберите и их |
| тесты справки падают после правки документации пакета      | `llms.txt`/`llms-index.json` пакета не пересобраны: `npm run build -w <пакет>`                                                                  |

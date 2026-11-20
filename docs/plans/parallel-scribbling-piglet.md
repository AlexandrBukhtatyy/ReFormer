# Правка через MCP там, где ReFormer только внедряется

## Context

Создание форм через MCP работает хорошо. На правке у sonnet проходит 34–36 сценариев из 36
(батч `20261119T213538Z-4881`). Но все затравки правки собирает сам сервер
(`writeSeedBundle` → `form_build` эталонного intent), так что эти цифры ничего не говорят о
проекте, куда ReFormer только приходит. Выяснили, что там происходит:

- **(A) Рукописная форма на ReFormer, `form.intent.json` нет.** `formStart`
  ([guided.ts:562](../../packages/reformer-mcp/src/core/tools/guided.ts#L562)) модуль не читает
  и молча строит план новой формы по тексту задания. Первая удачная сборка в `form_edit` или
  `form_build` через `restoreServerFiles` ([guided.ts:307](../../packages/reformer-mcp/src/core/tools/guided.ts#L307))
  удаляет рукописные `form.schema.ts`, `form.validation.ts`, `form.behavior.ts`, `model.ts`
  (на renderer-* ещё и `index.tsx`). Копии не остаётся.
- **(B) Сгенерированные файлы потом поправили руками.** Удаляются так же: `originOf` ≠
  `generated`, а `edited` и `handwritten` для удаления одно и то же. Обычный `form_build` такие
  файлы отсоединяет и оставляет ([form-build.ts:192](../../packages/reformer-mcp/src/core/tools/form-build.ts#L192)),
  но тогда правила нового поля в отсоединённый файл не попадают.
- **(C) Форма на react-hook-form, Formik или useState.** Переноса нет нигде: ни в MCP, ни в
  билдере, ни в документации, ни в задачах. Пути «код → intent» тоже нет.

Попутно нашлось:

- **Старый план создания.** После создания через guided в каталоге остаётся `form.plan.json`
  создания. Новый `formStart` с заданием-правкой тогда не включает режим правки, потому что
  условие `previous === null || previous.mode === 'edit'` не выполняется
  ([guided.ts:584-588](../../packages/reformer-mcp/src/core/tools/guided.ts#L584-L588)).
- **Разметка на core.** `index.tsx` с `MARKUP_MARK` перезаписывается молча, даже если его
  правили руками.

Решение пользователя: сначала замер, потом решения. Потерю файлов закрыть сразу, это дёшево и
понятно без замера. Вне рамок плана: свои компоненты проекта вместо `@reformer/ui-kit`.

## Часть 1. Защита от потери ручного кода (guided)

Замену файлов сборкой оставляем: если файл отсоединить, guided заходит в тупик (урок батча
`f59e`). Но **перед заменой сохраняем копию и прямо говорим об этом**.

[packages/reformer-mcp/src/core/tools/guided.ts](../../packages/reformer-mcp/src/core/tools/guided.ts):

- `handFilesOf(directory, target)` использует тот же предикат, что `restoreServerFiles`: файлы
  `SERVER_FILES` (на renderer-* ещё `index.tsx`) с `originOf(...) !== 'generated'`. Отдельно
  перечисляются файлы, которые сборка отсоединит и оставит как есть (`form.schema.json` и
  другие производные), чтобы текст предупреждения был точным.
- `keepCopies(directory, names)` пишет `<имя>.orig`. Если копия с тем же текстом уже есть,
  ничего не делает. Если текст другой, пишет `<имя>.2.orig` и так далее. `FormDirectory`
  принимает только плоские имена, поэтому копии лежат рядом.
- **`formStartTool`** вызывает обе функции до записи плана. Список уходит в новое поле плана
  `handFiles`: его добавить в `GuidedPlan` и `parsePlan`
  ([plan.ts](../../packages/reformer-mcp/src/core/guided/plan.ts)). Строка ответа идёт до этапов:
  - **(A), intent нет:** «⚠️ <dir> already holds a form the server did not write: X. The
    server does not read code — the form is only what you put in with the builder; the first
    build replaces these files, copies: X.orig. Put in every field and rule of that form, not
    only the change.»
  - **(B), режим правки:** «⚠️ Changed by hand after the server built them: X. The next build
    replaces them, copies: X.orig. A hand change the task keeps goes in with add_rule …; read
    it in the copy.» В профиле DSL названия операций переводит `asBuilderCalls`.
- **`restoredLine`** для имён из `plan.handFiles` пишет «Written by hand before this plan: X
  — replaced by the build; the copy is X.orig».
- **Строка `Done:`** в `statusLines` называет копии, чтобы агент передал их пользователю.
- **Подстраховка:** если `plan.handFiles === undefined` (план записан до защиты),
  `restoreServerFiles` тоже делает копию.
- **Случай f59e и f2fs.34 не возвращается.** Файлы, которые модель пишет после `formStart`, в
  `handFiles` не попадают: для них поведение и текст остаются прежними.

Сопутствующие правки:

- [validate/layout.ts:56](../../packages/reformer-mcp/src/core/validate/layout.ts#L56): `orig`
  в `IGNORED_FILE_RE`, чтобы копии не давали замечаний к раскладке и не валили `workspace.layout`
  на стенде.
- [generated-marker.ts:29](../../packages/reformer-mcp/src/core/generate/generated-marker.ts#L29)
  `MARKER_NOTE`: «guided её отменит» → «заменит сборкой, копия — <файл>.orig». Хэш считается по
  телу, старые файлы останутся `generated`. Если строка маркера попадает в golden-снимки
  `tests/__golden__`, их надо обновить.

### 1b. Старый план создания: сначала тест, затем исправление

Тест: guided-создание до `Done` → `formStart` с заданием-правкой → ждём `mode: 'edit'`. Если
тест красный, режим правки должен включаться и при **завершённом** плане создания (форма
собрана, этапы закрыты). При незавершённом план продолжается как сейчас.

### Тесты

Новый блок `describe('файлы, написанные не сервером')` в `tests/guided.test.ts`:

1. Модуль руками без intent → предупреждение, копии `.orig` совпадают с оригиналами, заполнен
   `plan.handFiles`.
2. Собрать модуль `formBuildTool`, поправить тело `form.validation.ts` → `formStart` в режиме
   правки → `add_field phone` → ✓. Файл снова `generated`, `.orig` равна правленой версии.
3. То же через `formBuildGuidedTool`.
4. Повторный `formStart`: тот же текст — второй копии нет; другой текст — `.2.orig`.
5. Core: `index.tsx` с `MARKUP_MARK` не считается ручным.
6. В существующие тесты (около строк 1857 и 3307) добавить проверку, что `.orig` не
   появляется.
7. Строка `Done:` называет копии.
8. Тест из 1b.

В `tests/validate-form.test.ts`: `*.orig` не даёт диагностик раскладки.

## Часть 2. Стенд: затравки, которые собрал не сервер

[eval/scenarios/catalog.mjs](../../packages/reformer-mcp/eval/scenarios/catalog.mjs) — новые
ключи `scenario.json`:

- `seedFiles: { "<куда от рабочего каталога>": "<откуда от каталога сценария, с {target}>" }`
  — копирование как есть.
- `seedEdits: [{file, find, replace}]` — применяются после сборки затравки. Цикл `mutations`
  из негативных фикстур вынести в общую `applyEdits`; если `find` не найден, она падает.
- `seedContract` — контракт самой затравки, для `--golden`.
- `split: "brownfield"`. Без явного включения такие сценарии не идут, иначе замер «с MCP и
  без» с шаблоном `*` молча сменит состав. Включить в `smoke.json` через
  `includeBrownfield: true`.

Остальное:

- **`resolveSeeds`** принимает сценарий без `seed`, если есть `seedFiles`.
- **`writeSeedBundle`** раскладывает `seedFiles` (легаси — только в рабочий каталог прогона).
- **`writeReferenceBundle`** у таких сценариев перед сборкой эталона убирает файлы затравки.
- **[run.mjs](../../packages/reformer-mcp/eval/scenarios/run.mjs):** `seedWorkspace` вызывается
  и для `seedFiles`/`seedEdits`; `seed.intent.json` копируется, только если он есть;
  `FORM_WORDS` выбираются через `seedsForm(scenario)`.
- **[verify/index.mjs](../../packages/reformer-mcp/eval/verify/index.mjs):** `forbidImports`
  из контракта превращается в гейт `static.foreign`, помощник — в `stack.mjs`. Без него форма,
  оставшаяся на RHF, пройдёт `static.tsc`: `react-hook-form` и `zod` лежат в корневом
  `node_modules`.
- **Легаси** лежит в `<рабочий каталог>/legacy/registration/`, вне `form/`, поэтому проверки
  `form/` его не видят. Устанавливать RHF в рабочий каталог не нужно.
- **[tests/eval-harness.test.ts:198](../../packages/reformer-mcp/tests/eval-harness.test.ts#L198)**:
  обновить список сценариев, стеки и правило затравки (`seed` или `seedFiles`). Добавить тесты
  `applyEdits`, `seedFiles` с `{target}` и `static.foreign`.

## Часть 3. Сценарии (split brownfield, уровень 1, на контрактах регистрации)

| Сценарий | Затравка | Задание и контракт | Стеки |
|---|---|---|---|
| `registration/adopt-edit` (A) | `seedFiles {form: "seed/{target}"}` — рукописные no-mcp бандлы `registration-create.{core,renderer-react}.no-mcp.sonnet.r1` из `.tmp/mcp-runs/20261119T213538Z-4881/` (прошли контракт), скопировать в каталог сценария | `../edit/prompt.md`, `../edit/contract.json`, эталон `../edit/reference.intent.json`; `seedContract: ../create/contract.json` | core, renderer-react (renderer-json без MCP не проходит) |
| `registration/tweaked-edit` (B) | `seed: registration-create` + `seedEdits` в `form.validation.ts`: ручная проверка email — одноразовый домен `@mailinator.com` запрещён | задание `../edit/prompt.md` дословно («остальное не меняй»); контракт наследует `../edit` и добавляет гейт-пробу `email-disposable`; эталон — intent правки + `pattern` у email | все три |
| `registration/migrate-rhf` (C), операция `migrate` | `seedFiles {"legacy/registration": "legacy"}`: `RegistrationForm.tsx` (useForm + zodResolver; подписи и кнопка как в контракте) и `schema.ts` (zod, асинхронная проверка капчи, «Пароли не совпадают»); `form/` пуст. Стиль взять из `projects/forms-benchmark/src/libs/formik/registration` и `libs/rhf/credit` | «перенеси на ReFormer с тем же поведением; в модуле только `@reformer/*` и `react`; `legacy/` не трогай»; контракт наследует `../create` + `forbidImports: [react-hook-form, @hookform/, zod, formik, yup]` | все три |

Проба ручной правки (B) — гейт. Её же добавить в `seedContract`, чтобы доказать, что правка в
затравке действует:
`{ "id": "email-disposable", "gate": true, "set": { "email": "ivan@mailinator.com" }, "expect": { "valid": false, "invalid": ["email"] } }`

**Негативные фикстуры** в `eval/verify/fixtures/negative/`:

- `adopt-not-done` (seedOnly);
- `tweak-not-done` (seedOnly);
- `tweak-lost` (из эталона убран `pattern` → красная `runtime.probe.email-disposable`);
- `migrate-not-done` (seedOnly → `workspace.entry`);
- `migrate-kept-rhf` (импорт RHF в `index.tsx` → `static.foreign`).

**Потом, по итогам замера:**

- `order/migrate-formik` — перенос поведения: compute, copyFrom, enableWhen.
- `registration/adopt-single-file` — рукописная форма одним файлом, раскладка не каноническая.

## Часть 4. Замер и решения

**Матрица** `eval/scenarios/matrices/brownfield-sonnet.json`:

- claude-code, sonnet;
- плечи `no-mcp`, `mcp-default`, `mcp-dsl`;
- три новых сценария плюс двойники `registration-edit` и `registration-create`, в том же батче;
- `includeBrownfield: true`, 3 повтора, параллельно 2, `maxUsdBatch: 60`.

Около 126 прогонов, примерно $30. Батч запускает пользователь (нужен
`CLAUDE_CODE_OAUTH_TOKEN`):

```bash
npm run mcp:scenarios -- --matrix brownfield-sonnet
npm run mcp:approaches -- <батч> --save packages/reformer-mcp/eval/runs/approaches/brownfield-sonnet.json
npm run mcp:history -- add <батч>
```

**Итог** — раздел «## Brownfield: форма, которую писал не сервер» в
`docs/mcp-eval/scenarios.md`: метод, сравнение с двойниками, решение. `benchmark.mdx` не
трогаем.

**Таблица решений.** Сигнал — отставание от двойника на 2 прогона и больше.

| Итог | Следующий шаг (отдельная задача) |
|---|---|
| Все плечи на уровне двойника | Ничего, защиты достаточно |
| A, `mcp-dsl`: потеряны базовые поля и пробы (собрана одна дельта) | Режим «принять форму»: `formStart` без intent отдаёт исходники модуля, этап `transcribe`, сверка с ключами `model.ts` |
| A, core: tsc в ручном `index.tsx` или отказ markup | `{"op":"markup"}` заменяет ручную разметку, оставляя копию |
| B, `mcp-dsl`: красная только `email-disposable` | `formStart` показывает разницу файла с выводом сборки; validation ждёт, пока проверки из копии не перенесены |
| A/B, `mcp-default`: tsc в отсоединённых файлах или правила нового поля не дошли | Ответ сборки объясняет, как перенести правку в intent; трёхстороннее слияние — только если этого мало |
| C, `mcp-dsl` хуже `no-mcp` | `formStart({sourcePath})`: исходник старой формы как спецификация плана |
| `no-mcp` заметно лучше обоих MCP-плеч везде | В инструкции сервера: «форму, которую писал не сервер, правь руками» |

## Порядок работы

0. Завести в beads эпик и задачи по частям 1, 1b, 2, 3 и 4; `git status docs/specs/` пуст.
1. Часть 1 и тесты.
2. 1b: тест, исправление по результату.
3. Часть 2.
4. Часть 3: затравки, контракты, эталоны, фикстуры.
5. `--golden`, `--negative`, smoke.
6. Батч (запускает пользователь), раздел документации, решение по таблице.

Без коммитов, пока пользователь не попросит.

## Проверка

```bash
npm test -w @reformer/mcp                     # guided.test.ts, eval-harness.test.ts, validate-form.test.ts
npm run typecheck:tests -w @reformer/mcp
npm run build -w @reformer/mcp
npm run mcp:verify -- --golden --scenario 'registration-*'   # эталоны и seedContract новых сценариев
npm run mcp:verify -- --negative                              # необработанные затравки падают
npm run mcp:scenarios -- --matrix smoke
```

Ручная проверка защиты: в `.tmp/brownfield-check/form/` положить рукописный бандл
`registration-create.renderer-react.no-mcp.sonnet.r1/bundle`. Через `mcp__reformer__execute`
выполнить `formStart` и одну правку. Ожидается предупреждение, файлы `*.orig` с исходным текстом
и собранный модуль.

## Риски

- **Копии `.orig` в папке формы.** Мусор, но безвредный: раскладка их игнорирует.
- **Якорь `seedEdits` устареет при смене генератора.** `applyEdits` упадёт громко.
- **Затравка A — каноническая раскладка, лучший случай для MCP.** Вариант одним файлом отложен.

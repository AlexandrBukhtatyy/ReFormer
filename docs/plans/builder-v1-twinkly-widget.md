# Замена builder v1 на builder v2: удалить v1, снять суффикс `-v2`

## Context

В монорепе два билдера: `projects/reformer-builder` (v1, пакет `@reformer/builder`, публикуется в npm —
latest 2.0.0, develop 3.0.0-beta.6, деплоится на Pages в `/ReFormer/builder/`) и
`projects/reformer-builder-v2` (v2, `@reformer/builder-v2`, `private: true`, bin `reformer-builder2`).
Вся работа последних недель идёт в v2 (ветка `ui_builder_v2`, коммиты уже под scope `reformer-builder`);
v1 заморожен с 2026-08-31. В `docs/implementation-plan.md` v2 так и записано: «v2 пишется рядом,
v1 замораживается, публикация потом и из `reformer-builder`». Задача — сделать этот шаг: v1 удалить,
v2 переименовать на его место и снять суффикс везде (каталог, имя пакета, bin, тексты, конфиги CI).

Исследование (3 агента + ручная проверка, всё с file:line) показало, что v1 никем не импортируется как
модуль — связь только через пути в CI, size-limit, `$schema` каталогов ui-kit и alias в react-playground.
v2 от v1 не зависит. Два скрытых дефекта, которые переименование вскрывает: (1) `react-playground`
уже сломан — его alias `@builder-src` указывает на `reformer-builder-v2/src/host/*`, а `host/`
переехал в `shell/platform/` (root `npm run typecheck` красный: TS2307 в
`projects/react-playground/src/pages/debug/ui_builder/compile.ts:35-37`); (2) у v2 нет обработки
`base` для Pages, а deploy-docs.yml её требует.

## Решения пользователя (зафиксированы)

| Вопрос                | Решение                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Публикация            | v2 становится публичным `@reformer/builder`: снять `private`, перенести publishConfig/keywords/homepage/repository/LICENSE/.releaserc.json |
| Pages                 | Сохранить деплой `/ReFormer/builder/`: добавить `base: process.env.BUILDER_BASE ?? '/'` в vite.config v2                                    |
| Порты                 | Лаунчер 4322 → **4321** (наследует v1); vite dev остаётся **5174** (5173 занят react-playground, e2e ждёт его там)                        |
| WIP в v1 (17 файлов)  | Выбросить вместе с v1 (assistant.enabled + vite-plugin runtime-bundle-dev относятся к архитектуре v1)                                    |

Не трогаем: `docs/plans/**` (история, prettier-ignored), внутри билдера `docs/{decisions-log.md,
work-graph.json, work-plan.md, implementation-plan.md, core-contracts.md}` — нарратив «v1/v2» остаётся;
метка `builder-v2` в beads остаётся; `docs/specs/` не затронуты (там билдер не упоминается).
Не сметать чужие грязные файлы: `projects/react-playground/src/pages/debug/builder-tests/**` (M + untracked
`test-03/`, `test-04-break/`), untracked `docs/plans/tender-nibbling-riddle.md`,
`projects/reformer-builder-v2/src/plugins/templates/stores/builtin.ts` (1 строка, переедет как есть).
Все `git add` — только по явным путям, без `git add -A` в корне.

## Этап 0 — подготовка

1. Закрыть всё, что держит хендлы в обоих каталогах (vite dev 5173/5174, vitest watch, TS-сервер VS Code
   на этих папках) — на Windows `git mv`/`Remove-Item` падают с EPERM.
2. `git status --short` — убедиться, что грязный набор ровно тот, что описан выше.
3. Базовые числа: `npm run test -w @reformer/builder-v2` (число тестов), `git ls-files projects/reformer-builder-v2 | wc -l`.
4. Убедиться, что `packages/reformer-mcp/dist/core` собран (`generate:knowledge` его читает); иначе
   `npm run build -w @reformer/mcp`.

## Этап 1 — удалить v1

```powershell
git rm -r -f --quiet projects/reformer-builder        # -f: 15 файлов с локальными правками
Remove-Item -Recurse -Force projects\reformer-builder # остатки: node_modules, dist, .tmp, untracked vite-plugins/runtime-bundle-dev.ts
Test-Path projects\reformer-builder                   # False
```

## Этап 2 — переместить v2 (чистый rename ДО правок содержимого)

```powershell
git mv projects/reformer-builder-v2 projects/reformer-builder
git mv projects/reformer-builder/bin/reformer-builder2.mjs   projects/reformer-builder/bin/reformer-builder.mjs
git mv projects/reformer-builder/bin/reformer-builder2.d.mts projects/reformer-builder/bin/reformer-builder.d.mts
Remove-Item -Recurse -Force projects\reformer-builder\dist, projects\reformer-builder\node_modules\.tmp  # старый dist и tsbuildinfo
```

`git mv` каталога — один `rename()` на диске, ignored-содержимое (`node_modules`, `src/plugins/ai/knowledge/generated/`)
едет вместе. Если EPERM — `Move-Item` + `git add -A -- projects/reformer-builder projects/reformer-builder-v2`
(детекция rename контентная, результат тот же). `node_modules/@reformer/builder` (симлинк на
`projects/reformer-builder`) после переезда уже указывает на v2; `@reformer/builder-v2` висит до этапа 6.

## Этап 3 — идентичность пакета (`projects/reformer-builder/`)

- **package.json**: `name: @reformer/builder`; убрать `private`; `description` на английском (как у v1)
  про офлайн-SPA, `.ui_builder/` и плагины; `bin: { "reformer-builder": "./bin/reformer-builder.mjs" }`;
  `files: ["dist","bin","runtime-config.schema.json","README.md","LICENSE"]`; добавить из v1
  `keywords`, `repository` (`directory: projects/reformer-builder`), `homepage`
  (`https://alexandrbukhtatyy.github.io/ReFormer/builder/`), `bugs`, `publishConfig: {access: public}`.
  `scripts` и `devDependencies` v2 — без изменений (v1-скрипты `prepack`/`generate:kit-*`/`build:config-schema`
  не нужны: `runtime-config.schema.json` в v2 — трекаемый файл в корне). `version` остаётся `0.0.0`.
- **.releaserc.json**: копия v1 (`git show HEAD:projects/reformer-builder/.releaserc.json`) —
  `semantic-release-monorepo`, branches `main` + `develop/beta`, `tagFormat: builder-v${version}`,
  conventionalcommits, npm, github. Шаг dist-tag в release.yml находит пакеты по `projects/*/.releaserc.json`.
- **LICENSE**: копия v1 (`git show HEAD:projects/reformer-builder/LICENSE`, MIT).

## Этап 4 — правки внутри билдера

| Файл                                                        | Правка                                                                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `vite.config.ts`                                            | Добавить `base: process.env.BUILDER_BASE ?? '/'` с комментарием v1 (Pages-подкаталог через env, локально `/`). Комментарий у `server` (L12-13) → «5173 — react-playground; strictPort, чтобы не уезжать на случайный порт». `port: 5174` оставить. |
| `bin/reformer-builder.mjs`                                  | `reformer-builder2` → `reformer-builder` (L3, 22, 83, 91, 134, 139, 146, 149, 310, 324, 330, 349); L3 убрать «(v2)»; L6-7 ссылку на путь v1 → «перенос лаунчера v1 (история git)»; L112 `port: 4321`, комментарий про 4322 переписать; L152 в справке `4322` → `4321`. |
| `bin/reformer-builder.d.mts`                                | L2 имя файла.                                                                                                                                                |
| `src/shell/boot/launcher.test.ts`                           | L19 `import('../../../bin/reformer-builder.mjs')` — реальный импорт, без правки тест падает; L2 doc.                                                        |
| `src/shell/boot/runtime-config.ts`                          | L7 путь bin. `RUNTIME_BUNDLE_PATH` (L35) не трогать.                                                                                                        |
| `runtime-config.schema.json` + `src/shell/boot/runtime-config.test.ts:23` | `$id` → `https://reformer.dev/schemas/reformer-builder-config`, `title` → «ReFormer Builder config»; литерал в тесте синхронно.                 |
| `README.md`                                                 | L1 `# @reformer/builder`; `npx reformer-builder` (L4, 11, 26); `--port 4321`; L33 `$schema` → `@reformer/builder/...`. Добавить короткий блок «Отличия от 2.x»: нет `--catalog`, конфиг из `.ui_builder/config.json`/`--config`, киты — плагинами из `.ui_builder/plugins/`. |
| `index.html:7`                                              | `<title>ReFormer Builder</title>`.                                                                                                                           |
| `src/shell/platform/services/i18n/locales/{en,ru}.json:4`   | `"app.title": "ReFormer Builder"`; синхронно `i18n.test.ts:12,18,65`.                                                                                        |
| `eslint.config.js:27`                                       | `npm run lint --workspace @reformer/builder`.                                                                                                                |
| `src/main.tsx:13`                                           | `npx reformer-builder`.                                                                                                                                      |
| `docs/project-structure.md`                                 | L55 `projects/reformer-builder/`; L209 `--workspace @reformer/builder`; L245-246 имена bin/npx.                                                              |
| `docs/plugin-and-shell.md:591`                              | Путь `projects/reformer-builder/vite-plugins/scope-kit-css.ts` → «v1, история git: `git show c18e4f0e:projects/reformer-builder/vite-plugins/scope-kit-css.ts`». |
| `docs/decisions-log.md`                                     | Append-only запись: v1 удалён, v2 занял его место, публикация как `@reformer/builder` 3.x, порт 4321, base для Pages, WIP v1 не перенесён.                 |
| Provenance-комментарии (опционально)                        | `src/plugins/editor-monaco/runtime/monaco-runtime.ts:12`, `src/shell/platform/source/testing.ts:6`, `src/shell/platform/workspace/storage/idb.ts:5`, `opfs.ts:23` — «v1 (история git)». |

Не трогать: `'preview.surface.v2'`, `'codegen.target.v2'`, `'templates.store.v2'` в тестах плагинов
(это «второй id точки расширения», не проект); `'v2'` как содержимое файла в `workspace.test.ts:347`;
имена IndexedDB `reformer-builder.workspace`/`reformer-builder.handles` (уже без суффикса);
`structure.test.ts` (ROOT через `import.meta.url`).

## Этап 5 — монорепа

**Корневой `package.json`**: удалить `dev:builder-v2` (L17); в `typecheck` (L21) убрать хвост
`&& tsc --noEmit -p projects/reformer-builder-v2/tsconfig.app.json`. `workspaces` — glob, без правок.

**react-playground** (чинит уже красный typecheck). В v2 модули импортируют через алиас:
`shell/platform/modules/registry.ts:45` и `transpilers.ts:21` → `@/shell/platform/primitives/disposable`,
`compile-cache.ts:37` → type-import `@/shell/platform/workspace/storage/build-cache`. В playground `@/*`
ведёт в его собственный `src/`, поэтому одной замены путей мало — нужен более длинный алиас
(TS берёт самый длинный шаблон; у playground нет `src/shell/`, конфликта нет):

- `projects/react-playground/tsconfig.app.json`: L32 `"@builder-src/*": ["../reformer-builder/src/*"]`;
  добавить `"@/shell/*": ["../reformer-builder/src/shell/*"]`; `include` (L38-43) →
  `../reformer-builder/src/shell/platform/modules`, `.../shell/platform/plugin/typescript-transpiler.ts`,
  `.../shell/platform/primitives/disposable.ts`, `.../lib/form-fixture`, `.../lib/form-inspect`, `.../lib/form-mock`.
- `projects/react-playground/vite.config.ts:38`: alias → `../reformer-builder/src`; добавить
  `'@/shell': path.resolve(__dirname, '../reformer-builder/src/shell')` **выше** ключа `'@'` (vite
  матчит алиасы по порядку); комментарий L35 «билдера v2» → «билдера».
- `projects/react-playground/src/pages/debug/ui_builder/compile.ts:35-37`: `@builder-src/shell/platform/modules/loader`,
  `.../modules/registry`, `.../plugin/typescript-transpiler`; комментарии `compile.ts:6`, `index.tsx:8`
  (`host/modules/*` → `shell/platform/modules/*`). TS7006 на `compile.ts:136` уйдёт сам.

**Каталоги ui-kit** (`$schema` на схему контракта; файл v2 `src/lib/catalog/component-catalog.schema.json`
байт-в-байт равен v1):

- `packages/reformer-ui-kit/scripts/generate-catalog.ts:505` — `SCHEMA_REF` →
  `../../projects/reformer-builder/src/lib/catalog/component-catalog.schema.json` (+ комментарий L4).
- Перегенерировать: `npm run generate:catalog -w @reformer/ui-kit`; ожидаемый diff
  `component-catalog.json` — одна строка (L2). Если больше — каталог уже дрейфовал: откатить, поправить
  L2 руками, дрейф завести отдельной задачей. Проверка: `npm run check:catalog -w @reformer/ui-kit`.
- `packages/ui-kits/reformer-hexa-ui/catalog.json:2` — правка руками (генератора у пакета нет).

**CI**: `.github/workflows/test.yml:146-149` — переписать комментарий (храповик `TOOL_SURFACE_BUDGET`
теперь в `src/plugins/ai/model/types.ts`, тест `src/plugins/ai/tools/tool-surface.test.ts`), команда
L150 без изменений. `release.yml:82-85` — убрать фразу про `contract.ts` и инлайн `@reformer/ui-kit/catalog`
(специфика v1), обоснование «BUILDER_BASE не выставляем» оставить; L25/L113 без изменений.
`deploy-docs.yml`, `.size-limit.json:138-145` (пути уже `projects/reformer-builder/dist/...`, хэши
knowledge-чанков у v2 совпадают с v1), `commitlint.config.js:32`, `CONTRIBUTING.md:83`,
`projects/reformer-doc/docusaurus.config.ts:205-211` — без изменений.

**Живые доки с путями, которые станут битыми**: `docs/mcp-eval/builder-toolset.md:10` →
`projects/reformer-builder/src/plugins/ai/model/types.ts`; `docs/mcp-eval/builder-render-rules.md:5-6, 64-65`
→ `src/plugins/ai/tools/set-render-rules.ts`, `src/plugins/ai/tools/render-rules-eval.test.ts`.

**Опциональная чистка прозы** (комментарии с путями v1; можно оставить или переписать на «v1, история git»):
`packages/reformer-ui-kit/src/styles/class-catalog.ts:16`, `packages/reformer-mcp/src/core/generate/builders.ts:9`,
`packages/reformer-mcp/tests/form-from-spec.test.ts:17`, `packages/reformer-mcp/eval/runner.mjs:141`,
`packages/reformer-mcp/eval/strategies/builder-facade.mjs:57`, `packages/reformer-form-registry/src/net.ts:4`,
`src/storage/indexeddb.ts:4`, `src/storage/storage-contract.test.ts:225`. Если трогать
`packages/reformer-form-registry/docs/llms/04-cache-storage.md:43` — обязательно `npm run generate:llms`
(pre-push и CI проверяют дрейф `llms.txt`).

## Этап 6 — `npm install`

```powershell
npm install                                   # обновит lock: уйдут node_modules/@reformer/builder-v2 и projects/reformer-builder-v2*
Get-ChildItem node_modules/@reformer          # builder -> projects/reformer-builder; builder-v2 нет
npm ls @reformer/builder --depth=0
```

Lock и так был несогласован (v2 записан под голым именем `reformer-builder-v2`, без `name`) — churn
большой, смотреть только секции `projects/reformer-builder*`.

## Верификация (по порядку, PowerShell)

1. `npm run generate:knowledge -w @reformer/builder`
2. `npm run typecheck` (корень) — зелёный впервые с переезда `host/` → `shell/platform/`
3. `npm run lint -w @reformer/builder` (границы слоёв живут только здесь), затем `npm run lint`
4. `npm run test -w @reformer/builder` — число тестов как в базе; следить за `launcher.test`,
   `runtime-config.test`, `i18n.test`, `structure.test`
5. `npm run test:browser -w @reformer/builder` (опционально, нужен Chromium Playwright)
6. Сборки: `npm run build -w @reformer/builder` → в `dist/index.html` ассеты с `/assets/`;
   `$env:BUILDER_BASE='/ReFormer/builder/'; npm run build -w @reformer/builder` → ссылки
   `/ReFormer/builder/assets/...`; `npm run preview -w @reformer/builder`, открыть
   `http://localhost:4173/ReFormer/builder/`, открыть схему в Monaco (воркеры грузятся), в консоли только
   ожидаемый 404 на `/__reformer-builder/runtime.json` (штатно → `null`, как у v1);
   `Remove-Item Env:BUILDER_BASE`; финально пересобрать с base `/` для шага 9.
   В Git Bash `BUILDER_BASE=/ReFormer/builder/` переписывается MSYS в `C:/Program Files/Git/...` —
   только PowerShell или `MSYS_NO_PATHCONV=1`.
7. `npm run size` — два builder-лимита (215/280 kB) по свежему dist
8. `npx prettier --check <изменённые файлы>`; `npx eslint <изменённые ts/tsx> --fix` до `git add`
9. Лаунчер: `node projects/reformer-builder/bin/reformer-builder.mjs --help` (4321, имя без «2»),
   `--version`, `--no-open` → `http://127.0.0.1:4321/` открывается;
   `Invoke-WebRequest http://127.0.0.1:4321/__reformer-builder/runtime.json` → `{"config":null}`
10. `npm pack --dry-run -w @reformer/builder` → `dist/**`, `bin/reformer-builder.mjs`,
    `bin/reformer-builder.d.mts`, `runtime-config.schema.json`, `README.md`, `LICENSE`; без `private`
11. Grep-гейты (0 совпадений):
    - `rg -n "reformer-builder-v2|reformer-builder2|builder-v2" -g '!node_modules' -g '!dist' -g '!package-lock.json' -g '!docs/plans/**' -g '!.beads/**' -g '!**/.tmp/**' -g '!projects/reformer-builder/docs/**'`
    - `rg -n "4322" projects/reformer-builder -g '!docs/**' -g '!node_modules'`
    - `rg -n "host/(modules|plugin|primitives)" projects/react-playground/src`
    - `Test-Path projects\reformer-builder-v2` → False
12. `git status --short` — только запланированные пути плюс три сохранённых чужих изменения

## Коммит (только по явной авторизации пользователя)

Сообщение — через Write в `<scratchpad>/commit-msg.txt`, `npx --no commitlint < файл`, `git commit -F`.
Header ≤100, строки тела ≤100, тема строчными. Один коммит (или вариант B: сначала чистый
`refactor(reformer-builder): v2 переезжает на место v1` с этапами 1-2, затем правки — чище для
`git log --follow`):

```
feat(reformer-builder)!: билдер v2 становится пакетом @reformer/builder

v1 (projects/reformer-builder) удалён, projects/reformer-builder-v2 переименован на его место
без суффикса: пакет @reformer/builder, bin reformer-builder, порт 4321, публикация в npm и
деплой на Pages (/ReFormer/builder/, base через BUILDER_BASE) — как у v1. Незакоммиченные
правки v1 (assistant.enabled, runtime-bundle-dev) намеренно не переносятся.

Каталоги ui-kit и hexa-ui ссылаются на схему контракта по новому пути (src/lib/catalog);
демо ui_builder в react-playground перешло с host/* на shell/platform/*.

BREAKING CHANGE: контракт CLI изменён. Флага --catalog больше нет — сторонний ui-kit
подключается плагином из .ui_builder/plugins/; конфиг читается из .ui_builder/config.json
(или --config) вместо runtime-конфига v1; $id схемы конфига без суффикса «2».
```

Версии: develop → `3.0.0-beta.7` (3.0.0-beta.6 уже мажорный prerelease над 2.0.0), main → `3.0.0`,
тег `builder-v3.0.0`.

## Beads — триаж после удаления (рекомендации, закрывать по подтверждению)

- Закрыть как v1-only: `ReFormer-7ie` (MVP v1), `ReFormer-549` (e2e для v1; у v2 есть `test:browser`),
  `ReFormer-s0j` (сменные киты v1 — в v2 через `.ui_builder/plugins/`, при желании завести преемника).
- Закрыть как сделанное этой работой: `ReFormer-g7qk` (alias playground → builder-v2).
- Оставить, поправить описание: `ReFormer-mmy` (путь схемы теперь `src/lib/catalog/...`).
- Оставить (ассистент перенесён в `plugins/ai`, храповик там же): `ReFormer-y7r` (P0), `nir`, `kuj`,
  `6sj`, `la6`, `gxk` — перепроверить каждую на v2 перед действиями.
- Завести follow-up: `test:browser` билдера в CI (нужен `npx playwright install chromium` в test.yml).

## Риски и что не делаем

- **Пробел scope-kit-css**: сборочный скоупинг CSS сторонних китов (`@kaspersky/*`) из v1 уходит;
  рантайм-аналог в v2 описан в `plugin-and-shell.md`, но не реализован. `@reformer/kit-hexa-ui` остаётся
  в workspace с поправленным `$schema`, в билдере до плагина китов не используется.
- **Доки v1 уходят из дерева** (`docs/{brainstorms,instructions,plans,rfcs,specs}`, 9 файлов) —
  доступны через `git show c18e4f0e:projects/reformer-builder/docs/...`.
- **Неоднозначность имён**: кодовая база «v2» публикуется как пакет 3.x; тег `builder-v2.0.0` — это v1.
  Сказать в README/release notes.
- **`.npmrc`** недоступен для чтения в этой сессии (deny rule), а grep агента там нашёл «builder» —
  проверить руками, нет ли builder-специфичных строк.
- **CI `npm run size`** в test.yml идёт без сборки билдера, а `.size-limit.json` глобит его dist —
  пре-существующее, путями не меняется; проверить по последнему зелёному прогону, вне scope.
- **Связь playground с внутренностями билдера** становится теснее (`@/shell/*`); правильное решение —
  вынести `lib/` + `modules/` в пакет (изначальная забота `ReFormer-g7qk`), вне scope.
- **Windows**: EPERM от открытых хендлов (этап 0); MSYS-конверсия `BUILDER_BASE` (верификация 6);
  удалённые `node_modules/.tmp/*.tsbuildinfo` (этап 2) — чтобы не остался устаревший инкремент.

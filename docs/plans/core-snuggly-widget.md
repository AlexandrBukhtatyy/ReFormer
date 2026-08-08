# Удаление мёртвого кода в `@reformer/core`

## Context

Пакет [packages/reformer/](packages/reformer/) (`@reformer/core@6.0.0`, ~11.6k строк, 74 файла в `src/`) пережил три волны рефакторинга: удаление дерево-движка валидации (Ф7), переход на M1 (`createForm({ model, schema })`), модуляризацию `src/core/**` → `src/form/**` + `src/state/**` (коммит `293079c6`). После каждой волны оставались хвосты: методы-фасады без исполнителей, типы удалённых операторов, конфиги, указывающие на несуществующие пути.

Аудит (5 сканеров по независимым измерениям + адверсариальная верификация каждого кандидата) дал **89 кандидатов → 69 подтверждено, 18 опровергнуто, 2 спорных**; после дедупликации — **38 уникальных находок, ~495 строк**.

Отдельно проведена кросс-пакетная перепроверка по всем **9 воркспейсам**, зависящим от core: собраны все импорты из `@reformer/core*` (70 уникальных символов), проверены вызовы методов, структурные объявления тех же имён, промты `reformer-mcp`, codegen `reformer-builder`, манифесты `form-registry`, строковые реестры `renderer-json`. **Ни один кандидат на удаление не имеет потребителя внутри монорепо.** Namespace-импортов core и реэкспортов `export ... from '@reformer/core'` нет — транзитивной утечки публичной поверхности не существует. Проверка повторена на HEAD после коммита `5e39ebdc` (развязка ui-kit от renderer-react) — тот коммит не изменил ни одного импорта core, выводы в силе.

**Неустранимый риск:** внешние npm-консументы `@reformer/core@6.0.0` вне монорепо невидимы. Поэтому 323 строки публичной поверхности идут через deprecation-цикл, а не под немедленное удаление.

**Цель:** снять мертвечину итеративно — каждый этап отдельным коммитом после прогона тестов, от безопасного к semver-breaking.

---

## Ключевые находки

| Кластер | Суть | Строк | Класс |
|---|---|---|---|
| **A** | `ArrayNode.applyValidationSchema`/`applyBehaviorSchema` — **методы-пустышки**: guard `'applyValidationSchema' in node` на `GroupNode` тождественно false, `createItem` строит только `GroupNode` | 84 | INTERNAL + PUBLIC |
| **B** | Мёртвая половина `FormStatusMachine`: `dispatch`, `StatusEvent`, `getStatus()`, `canValidate()` (императивные API не прижились, живут `setErrors`/`startValidation`/…) | 57 | PUBLIC |
| **C** | «Лгущие» контракты: `FormSchemaNode.validators/asyncValidators/when/testId`, `SetValueOptions.onlySelf`, `FieldNode.validate(options)` — объявлены, рантайм игнорирует | 25 | смешанный |
| **D** | Легаси-типы удалённых операторов — `AsyncValidator`, `ConditionFn`, `ValidateAsyncOptions` (уже `@deprecated` в исходнике) | 34 | PUBLIC |
| **E** | `@internal`-псевдонимы, утёкшие в публичные `.d.ts`; `ArrayConfig` **расходится с рантаймом** | 38 | PUBLIC |
| **F** | Write-only и дублирующие члены нод: `ArrayNode.watchItems`/`watchLength`, `FormSubmitter.isSubmitting()`, `FormNode.untouched`/`pristine`/`enabled` | 97 | PUBLIC |
| **G** | Избыточные guard'ы + dev-warn под `import.meta.env.DEV`, вырезаемый из бандла | 14 | INTERNAL |
| **H** | Doc-rot: JSDoc-примеры зовут несуществующие `setComponentProps`/`control.remove`, утекли в **публикуемый** `llms.txt` | 17 | INTERNAL |
| **I** | Рассинхрон конфигов: `knip.json` указывает на несуществующий `src/core/**`, дубль `test:` в vite.config, coverage-гейт без провайдера | 34 | INTERNAL |
| **J** | [tests/test-utils/index.ts](packages/reformer/tests/test-utils/index.ts) целиком — **крупнейшая единичная находка**, 0 импортёров | 82 | INTERNAL |
| **K** | Мёртвые слоты в барелях (функция жива, экспорт-строка мертва) | 6 | PUBLIC |
| **L** | `resetUniqueIdCounter` — единственная находка вообще без оговорок | 7 | INTERNAL |

**Орфанных файлов в `src/` нет** — транзитивный обход от 27 build-entry покрывает 74 из 75 файлов; единственный недостижимый (`validation/validators/index.ts`) живёт через два теста. Мертвечина точечная, массового груза нет.

---

## Этап 0 — baseline

Зафиксировать зелёное состояние до правок (все команды из корня репо):

```bash
git status docs/specs/                              # ДОЛЖНО быть пусто (specs read-only)
npx tsc --noEmit -p packages/reformer/tsconfig.json  # проверено: сейчас exit 0
npm test -w @reformer/core
npm run lint
```

Записать число прошедших тестов — сверять после каждого этапа.

---

## Этап 1 — безопасная чистка (~41 строка, поведение не меняется)

**Коммит:** `chore(reformer): remove dead tree-engine remnants and redundant guards`

1. [array-node.ts:504-513](packages/reformer/src/form/nodes/array-node.ts#L504-L513) — ветки `createItem`, применяющие validation/behavior schema. Guard'ы на инстансе `GroupNode` тождественно false: `createItem` строит только `new GroupNode(...)` ([:499](packages/reformer/src/form/nodes/array-node.ts#L499)) либо кидает `Error` ([:518](packages/reformer/src/form/nodes/array-node.ts#L518)).
   ⚠️ Импорты `WithValidationSchema`/`WithBehaviorSchema` ([:22-23](packages/reformer/src/form/nodes/array-node.ts#L22-L23)) и приватные поля ([:71-72](packages/reformer/src/form/nodes/array-node.ts#L71-L72)) **оставить** — их держат сами методы `applyValidationSchema`/`applyBehaviorSchema`, они уходят только в этапе 6.
2. [create-form.ts:98-99](packages/reformer/src/form/create-form.ts#L98-L99) + [:155-157](packages/reformer/src/form/create-form.ts#L155-L157) — harvest собирает `validators`/`asyncValidators`, а `buildModelConfig` их деструктурирует в `_v`/`_av` и выбрасывает. Правки взаимозависимы, в одном патче: убрать сбор, упростить до `const nodeCfg = bySignal.get(sig) ?? {}`.
3. [type-guards.ts:81-83, 115-117, 149-151](packages/reformer/src/form/type-guards.ts#L81-L83) — избыточные `null/undefined`-guard'ы: следующим выражением каждая функция зовёт `isFormNode`, у которого свой guard.
   ⚠️ Guard внутри самого `isFormNode` ([:46-48](packages/reformer/src/form/type-guards.ts#L46-L48)) **не трогать** — там он несёт смысл (`typeof null === 'object'`).
4. [unique-id.ts:57-63](packages/reformer/src/form/unique-id.ts#L57-L63) — `resetUniqueIdCounter` (JSDoc + функция). `let counter = 0` на строке 37 и `uniqueId` (53-55) остаются.
5. [form-proxy-builder.ts:120-124](packages/reformer/src/form/form-proxy-builder.ts#L120-L124) — удалить блок dev-warn под `import.meta.env.DEV`. Vite при сборке библиотеки заменяет флаг на `false`, блок вырезан из бандла (`rg 'Cannot set field' packages/reformer/dist` → 0), до консумента не доходит никогда. Ловушка `set` продолжает возвращать `false`.
6. [create-form.ts:163-170](packages/reformer/src/form/create-form.ts#L163-L170) — осиротевший JSDoc «Создать форму из FormModel… Массивы пока не поддержаны»: `buildModelConfig` закрывается на 161, а следующий JSDoc (171) документирует `collectLeafPaths`. Блок ни к чему не привязан, текст ложный.
7. [group-node.ts:378-380](packages/reformer/src/form/nodes/group-node.ts#L378-L380) — JSDoc `getProxy` со ссылками на удалённые `BehaviorApplicator`/`ValidationApplicator`.

**Проверка перед коммитом:** `tsc --noEmit` + `npm test -w @reformer/core` + `npm run lint`. Число тестов должно совпасть с baseline.

---

## Этап 2 — сломанные JSDoc-примеры, утекшие в публикуемый `llms.txt`

**Коммит:** `fix(reformer): correct JSDoc examples leaking into published llms.txt`

`llms.txt` входит в `package.json "files"` → **физически уезжает в npm-тарбол**, и MCP-консумент получает по нему нерабочий пример.

* [hooks/types.ts:178,183](packages/reformer/src/form/hooks/types.ts#L178) и [useFormControl.ts:247](packages/reformer/src/form/hooks/useFormControl.ts#L247): `setComponentProps` → `updateComponentProps` (реальное имя — [field-node.ts:551](packages/reformer/src/form/nodes/field-node.ts#L551)).
* [hooks/types.ts:248](packages/reformer/src/form/hooks/types.ts#L248) и [useFormControl.ts:303](packages/reformer/src/form/hooks/useFormControl.ts#L303): `control.remove(index)` → `control.removeAt(index)` ([array-node.ts:147](packages/reformer/src/form/nodes/array-node.ts#L147)).
* [unique-id.ts:47](packages/reformer/src/form/unique-id.ts#L47): пример `import { uniqueId, SubscriptionKey } from '@reformer/core'` **не компилируется** — `SubscriptionKey`/`SubscriptionKeyType` наружу не экспортируются ([form/index.ts:44](packages/reformer/src/form/index.ts#L44) отдаёт только `uniqueId`). Либо починить пример, либо доэкспортировать тип (см. открытый вопрос O3).

**Обязательно:** `npm run generate:llms -w @reformer/core`, иначе `llms.txt:5315, 5320, 8401, 8123` продолжат уезжать в тарбол. Отдельный коммит — потому что регенерируемый артефакт даёт шумный diff.

---

## Этап 3 — мёртвые тест-хелперы (82 строки)

**Коммит:** `chore(reformer): remove unused test helpers`

* Удалить [tests/test-utils/index.ts](packages/reformer/tests/test-utils/index.ts) целиком: `mockComponent`, `delay`, `nextTick`, `mockAsyncValidatorSuccess`, `mockAsyncValidatorFail`, `createMockAsyncValidator`, `TestFormBasic`, `TestFormNested`, `TestFormWithArray`. Импортёров ноль: все 17 попаданий на `test-utils` — это `../../test-utils/types`.
* Поправить [tests/test-utils/README.md:18,24](packages/reformer/tests/test-utils/README.md#L18) и [tests/README.md:33](packages/reformer/tests/README.md#L33) — там показан импорт, который никогда не работал.
* ⚠️ [tests/test-utils/types.ts](packages/reformer/tests/test-utils/types.ts) **не трогать** — `ComponentInstance` импортируют 17 тестов.

---

## Этап 4 — рассинхрон конфигов + починка coverage-гейта

**Коммит:** `chore(reformer): fix stale tooling config and wire coverage gate`

1. [knip.json:6](knip.json#L6): `src/core/validation/validators/*.ts` → `src/form/validation/validators/*.ts` (либо снять override). Каталога `src/core` не существует, glob матчит ноль файлов, и workspace-`entry` **переопределяет** дефолтное определение точек входа → текущий отчёт knip искажён в сторону ложноположительных. **После правки обязательно перечитать новый отчёт** (`npm run knip`) — часть текущих Unused exports исчезнет, могут всплыть новые.
2. [packages/reformer/vite.config.ts:13-26](packages/reformer/vite.config.ts#L13-L26) — удалить блок `test: { coverage: … }`. Источник истины — `vitest.config.ts`; [scripts/run-vitest.mjs](scripts/run-vitest.mjs) спавнит `npx vitest run` без `--config`, победа за `vitest.config.ts`. Ценность не в 14 строках, а в снятии ловушки: правка порогов в vite.config сегодня не даёт эффекта.
   ⚠️ Именно **13-26**, не 11-24: `plugins:` на 12, `test:` открывается на 13, закрывается на 26.
3. **Починить coverage-гейт** (решение принято): добавить `@vitest/coverage-v8` в devDependencies [packages/reformer/package.json](packages/reformer/package.json), скрипт `"coverage": "vitest run --coverage"`, шаг в `.github/workflows/test.yml`. Сейчас [vitest.config.ts:14-29](packages/reformer/vitest.config.ts#L14-L29) объявляет thresholds 80%, провайдера нет ни в одном `package.json` монорепо, CI покрытие не гоняет — `vitest --coverage` упадёт.
   ⚠️ **Первый прогон может не добрать до 80%.** Если так — зафиксировать фактические цифры как стартовые пороги и завести issue на доведение до 80%, а не отключать гейт.
4. Удалить неиспользуемые devDependencies [packages/reformer/package.json:177,178,179,181](packages/reformer/package.json#L177): `@types/react-dom`, `@vitejs/plugin-react`, `@vitest/utils`, `react-dom`. В `packages/reformer/{src,tests}` нет ни одного `.tsx`; `react-dom` объявлен ещё в 8 воркспейсах → из `node_modules` не исчезнет.
   ⚠️ **Не трогать** `react` ([:180](packages/reformer/package.json#L180)), `react-dom` в `rollupOptions.external` ([vite.config.ts:84](packages/reformer/vite.config.ts#L84)) и в `peerDependencies` ([:166](packages/reformer/package.json#L166)).
   ⚠️ Затрагивает lock-файл → после правки полный `npm install` + сборка.

---

## Этап 5 — разметка `@deprecated` (6.x minor, **без удалений**)

**Коммит:** `chore(reformer): deprecate unused public surface`

Риск по коду нулевой — это разметка + документация. Проставить `@deprecated` с указанием замены на всё из кластеров A4-A7, B, C, D, E, F, K и внести запись в [CHANGELOG.md](packages/reformer/CHANGELOG.md).

Приоритет разметки: **F** (97 строк, есть прямые замены) → **B** (57) → **A4-A7** (70, методы-пустышки) → **D** (уже размечено в исходнике, нужна только запись в CHANGELOG) → **C**, **E**.

Таблица миграций для CHANGELOG:

| Удаляемое | Замена |
|---|---|
| `ArrayNode.watchItems` | `watchField`/`computeFrom` из `@reformer/core/state` |
| `ArrayNode.watchLength` | сигнал `length` ([array-node.ts:109](packages/reformer/src/form/nodes/array-node.ts#L109)) + `useArrayLength` |
| `ArrayNode.applyValidationSchema` / `applyBehaviorSchema` | `defineFormBehavior` + `createForm({ model, schema, behavior })` |
| `FormStatusMachine.getStatus()` | `machine.status.value` |
| `FormSubmitter.isSubmitting()` | `form.submitting.value` — ровно так уже делает CDK ([FormWizard.tsx:136](packages/reformer-cdk/src/components/form-wizard/FormWizard.tsx#L136)) |
| `ArrayConfig` | `ConfigWithSchema` ([types/index.ts:118](packages/reformer/src/form/types/index.ts#L118)) — `ArrayConfig` описывает `{ itemSchema, initial }`, а рантайм (`NodeFactory.isArrayConfig`) распознаёт `{ schema, initialItems }` |

Дополнительно в этом же этапе: **runtime-warn** при передаче аргумента в `FieldNode.validate(options)` ([field-node.ts:308](packages/reformer/src/form/nodes/field-node.ts#L308)). Без него удаление параметра в 7.0 даст JS-консументу тихую смену поведения — `debounce` молча откатится к config-значению.

**Обязательно:** `npm run generate:llms -w @reformer/core` + проверить doc-сайт.

---

## Этап 6 — физическая срезка (7.0, SEMVER-MAJOR)

**Коммит:** `feat(reformer)!: remove deprecated API`

Порядок внутри этапа обязателен — иначе `tsc` или сборка падают.

1. **Связка бареля валидаторов:** сначала [validators.ts:5](packages/reformer/src/form/validators.ts#L5) (+ переписать шапку 1-4, она описывает именно эту строку), **потом** [index.ts:18](packages/reformer/src/index.ts#L18). Обратный порядок ломает сборку.
   Контекст: обе строки введены одним коммитом `27359315` как несущий элемент бандл-фикса («shared static registry»). Предпосылка мертва — реальных объявлений `ValidationRegistry`/`BehaviorRegistry` в `src` ноль, сиблинг `export * as behaviors` уже удалён в `56de4edc`, и «shared chunk» по факту не достигается (`grep -c 'validators/' dist/index.js` → 0). Сабпат `@reformer/core/validators` не пострадает — его несёт [validators.ts:6](packages/reformer/src/form/validators.ts#L6) + 21 гранулярный entry.
2. **`array-node.ts`:** A4 (`applyValidationSchema`, 541-570) → A5 (`applyBehaviorSchema`, 572-599) → A3 (приватные поля 71-72) → A2 (импорты 22-23) → A6/A7 (`WithValidationSchema`/`WithBehaviorSchema` в [types/index.ts:85-99](packages/reformer/src/form/types/index.ts#L85-L99)).
3. **`status-machine.ts`:** B3 (`dispatch`, 184-216) → B4 (`StatusEvent`, 17-26) → B1/B2 (`getStatus`/`canValidate`, 218-230) → B5 (реэкспорт [form/index.ts:41-42](packages/reformer/src/form/index.ts#L41-L42)).
   ⚠️ Сам класс **живой** — `FieldNode` держит его в `private readonly statusMachine` и зовёт `setErrors`/`startValidation`/`completeValidation`/`disable`/`enable`.
4. **Кластер C:** сначала поля `FormSchemaNode` (C3), только потом `SchemaValidator` ([schema-node.ts:35-46](packages/reformer/src/form/types/schema-node.ts#L35-L46)) — он типизирует эти поля, мёртв транзитивно.
5. **Кластеры D, E, F, K** — в любом порядке после пунктов 1-4.

**Побочный эффект F1-F3, обязателен в CHANGELOG:** [form-proxy-builder.ts:97](packages/reformer/src/form/form-proxy-builder.ts#L97) отдаёт приоритет `prop in proxyTarget`, поэтому сегодня поле модели с именем `untouched`/`pristine`/`enabled` затеняется членом ноды. После удаления `form.untouched` начнёт возвращать `FieldNode`. Расширить [tests/core/utils/form-proxy-shadowing.test.ts](packages/reformer/tests/core/utils/form-proxy-shadowing.test.ts) кейсами `untouched`/`pristine`/`enabled` — сейчас там только `status`/`id`/`value`.

**После каждого из пунктов 1-2** — пересобрать `dist` и сверить набор чанков (коммит `27359315` связывал эти строки с шарингом чанков; предпосылка мертва, но регрессия формы бандла возможна).

---

## Открытые вопросы (требуют решения до соответствующих этапов)

* **O1 — `registerSignalNode`** ([signal-node-registry.ts:42](packages/reformer/src/form/signal-node-registry.ts#L42)). Снаружи пакета не вызывается, внутри — один вызов. НО JSDoc позиционирует функцию как **шов для сторонних сборщиков форм**, а парная `getNodeForSignal` активно используется извне. Вопрос: поддерживаем ли сценарий стороннего сборщика поверх core? Если да — снять с аудита и покрыть тестом; если нет — убрать **обе** половины синхронно. Односторонняя правка — худший вариант.
* **O2 — `GroupNode.fields`** ([group-node.ts:367-369](packages/reformer/src/form/nodes/group-node.ts#L367-L369)) — публичный getter живой `Map`, в которую кладут узлы снаружи класса ([create-form.ts:247](packages/reformer/src/form/create-form.ts#L247)). Часть ли это поддерживаемого контракта? Если нет — в 7.0 можно поднять `resetToInitial`/`dispose` в abstract-контракт `FormNode` и снять 4 duck-typing-guard'а. Если да — guard'ы легитимны, вопрос закрыт. **Пока считаем guard'ы живыми** (аудит их опроверг как мертвечину).
* **O3 — `SetValueOptions.onlySelf`** ([form-node.ts:24-25](packages/reformer/src/form/nodes/form-node.ts#L24-L25)) — опция публично обещана типом, но ни одна из 4 реализаций `setValue` её не читает. Реализовать или удалить?

## Отдельные issue (не удаление — баги, найденные попутно)

* Node-level warning не переживает `field.validate()`: финальная очистка [field-node.ts:482-486](packages/reformer/src/form/nodes/field-node.ts#L482-L486) безусловно стирает warning'и. Контракт не зафиксирован тестами ни в ту, ни в другую сторону.
* `ModelApi.set` — побайтовый алиас `patch` ([form-model.ts:376-377](packages/reformer/src/state/form-model.ts#L376-L377)), а [state/types.ts:159-164](packages/reformer/src/state/types.ts#L159-L164) обещает «все ключи T». Либо реализовать, либо починить JSDoc.
* Две реализации `computeFrom` с разной семантикой: [form/behaviors.ts:236](packages/reformer/src/form/behaviors.ts#L236) (с `markDerived` + cycle guard) vs [state/behaviors-value.ts:38](packages/reformer/src/state/behaviors-value.ts#L38) (без). Обе публичны, обе с живыми потребителями; у state-варианта bulk `set`/`patch` затирает вычисленное поле. Нужен тест на инвариант «bulk-set не затирает computed».
* `packages/reformer/tests/**` не покрыт `tsc` — нужен `tsconfig.test.json` с `noEmit: true`, включённый в цепочку [package.json:20](package.json#L20).

---

## Верификация

После **каждого** этапа, до коммита:

```bash
npx tsc --noEmit -p packages/reformer/tsconfig.json
npm test -w @reformer/core          # число прошедших тестов сверить с baseline
npm run lint
```

Дополнительно на этапах, меняющих публичную поверхность или сборку (4, 5, 6):

```bash
npm run build -w @reformer/core     # включает generate:llms
node scripts/check-exports-dist.mjs # каждый subpath из exports существует в dist
node scripts/check-dist-deps.mjs
npm run typecheck                   # весь монорепо: cdk, renderer-react/json, ui-kit, form-registry, playground, builder
npm run knip                        # после этапа 4 — перечитать отчёт целиком
```

Итоговая ручная проверка после этапа 6 — прогнать e2e на реальной форме: `npm run dev` + сценарии из [projects/react-playground-e2e/](projects/react-playground-e2e/), скриншоты в `projects/react-playground-e2e/screenshots/`.

## Ожидаемый результат

| Категория | Строк | Этапы |
|---|---|---|
| DEAD-INTERNAL — без breaking | ~172 | 1-4 |
| DEAD-PUBLIC — через deprecation-цикл | ~323 | 5-6 |
| **Итого** | **~495** (≈4.3% пакета) | |

Коммиты делаются по ходу этапов — это согласовано в текущем запросе; правило строгой авторизации коммитов из `CLAUDE.md` считается удовлетворённым для этой работы. `git push` — отдельно по явной просьбе.

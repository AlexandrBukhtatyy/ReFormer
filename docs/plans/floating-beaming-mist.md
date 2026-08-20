# Ревизия структуры `packages/reformer/src`

## Context

Задача — привести раскладку `@reformer/core` в соответствие с логическими слоями: модель, форма
(с группировкой по подсистемам) и платформенные биндинги.

Разделение модель/форма уже существует (июль 2026, `ReFormer-by9`, план
[snappy-bouncing-rossum.md](snappy-bouncing-rossum.md)): `src/state/**` — реактивный субстрат,
`src/form/**` — формы и валидация. Граница закреплена ESLint-правилом
[eslint.config.js:110-128](../../eslint.config.js#L110-L128) и **держится идеально**: рёбер
`state → form` ноль.

Просело то, что правило не покрывает:

1. **React живёт внутри form-слоя.** `form/hooks/` — 6 файлов с runtime-импортом `react`; через
   `form/index.ts` они утекают в корневой `@reformer/core`, хотя ни модель, ни форма от React не
   зависят.
2. **Корень `form/` плоский** — 17 файлов вперемешку: подсистема валидации, подсистема поведений,
   сборка формы, шов, submit, утилиты.
3. **Валидаторы на два уровня глубже своего публичного сабпата** и обслуживаются тремя barrel-ами.
   Расхождение уже случилось: `UrlValidatorOptions` и `PhoneValidatorOptions` объявлены, но до
   потребителя не доезжают — их экспортирует только тот barrel, до которого публичная цепочка не
   доходит (и который knip считает мёртвым кодом).
4. **В `state/` лежит чужак.** `subscription-manager.ts` имеет **ноль** потребителей внутри слоя —
   все три это узлы формы (`field-node.ts:21`, `group-node.ts:28`, `array-node.ts:21`), и вся его
   документация написана про `FieldNode`.
5. **Ядро модели — один файл на 571 строку** с восемью размеченными секциями и тремя независимыми
   механизмами.
6. **25+ JSDoc-тегов указывают на пути, снесённые год назад** (`@module core/model/…`,
   `@module core/utils/…`). Хуже: шапка `form/types/contracts.ts` описывает раскладку, которой
   никогда не существовало.

### Объём после оценки плана

Из первоначального замысла **исключены** три блока — обоснование в разделе «Что не делаем и почему»:
переименование `state/` → `model/`, перенос `aggregate-signals`/`status-machine`/`form-proxy-builder`
в `nodes/`, и переструктурирование каталога `tests/`.

Добавлен блок ESLint-правил: без него ревизия лечит симптом, а причина дрейфа (граница, которую никто
не проверяет) остаётся.

Итог: ~45 файлов движения вместо ~110, вся архитектурная ценность сохранена.

## Целевая структура

```
src/
├── index.ts                    зонтик (состав экспортов неизменен — 44 штуки)
├── signals.ts                  владелец рантайма @preact/signals-core
├── runtime-token.ts
│
├── state/                      имя не меняется
│   ├── index.ts                barrel + entry сабпата /state
│   ├── create-model.ts         createModel + eachLeafSignal            (~65)
│   ├── model-nodes.ts          Leaf/Group/ArrayNode + clone/deepEqual  (~230)
│   ├── model-signals-proxy.ts  $-дерево, containerSignal, signalAt     (~125)
│   ├── model-value-proxy.ts    makeFormModel, nodeValue, arrayProxy    (~125)
│   ├── types.ts
│   ├── behaviors-value.ts
│   ├── derived-registry.ts
│   └── safe-effect.ts
│
├── form/                       после ревизии — без runtime-импортов react
│   ├── index.ts
│   ├── create-form.ts
│   ├── create-core-form.ts
│   ├── signal-node-registry.ts
│   ├── form-submitter.ts
│   ├── aggregate-signals.ts
│   ├── status-machine.ts
│   ├── form-proxy-builder.ts
│   ├── type-guards.ts
│   ├── unique-id.ts
│   │
│   ├── validation/             → сабпат /validation
│   │   ├── schema.ts           ← validation-schema.ts   (entry)
│   │   ├── strategy.ts         ← validation-strategy.ts
│   │   ├── config.ts           ← validation-config.ts
│   │   └── error-handler.ts    ← error-handler.ts
│   │
│   ├── validators/             → сабпат /validators
│   │   ├── index.ts            единый barrel (entry)
│   │   ├── required.ts … max-total-file-size.ts   (27 фабрик)
│   │   ├── date-utils.ts
│   │   └── file-utils.ts
│   │
│   ├── behaviors/              → сабпат /behaviors
│   │   ├── index.ts            ← behaviors.ts (entry)
│   │   └── node.ts             ← behaviors-node.ts
│   │
│   ├── nodes/
│   │   ├── form-node.ts  field-node.ts  group-node.ts  array-node.ts  model-array-node.ts
│   │   └── subscription-manager.ts   ← из state/
│   ├── types/
│   └── factories/
│
└── platforms/
    └── react/
        ├── index.ts            barrel слоя (заготовка под сабпат /react)
        └── hooks/              ← было form/hooks/
```

## Шаги

**Зависимость одна: B после A** (каталог `form/validation/` должен опустеть, прежде чем заселяться
заново). Остальные блоки независимы по смыслу, но A, B, C и D правят один и тот же `form/index.ts` —
значит выполнять последовательно, а не параллельно.

**Правило коммитов, обязательное для всех блоков:** `git mv` и правка содержимого — **разные
коммиты**. Совмещение ломает `git log --follow` на файлах, где живут самые ценные комментарии
(разбор off-by-one в `date-utils.ts`, обоснование EPSILON в `multiple-of.ts`, объяснение
безопасности цикла в `validation/schema.ts:328-330`, разбор `containerSignal` в модели). Каждый блок —
отдельный PR: диф на 45 файлов ещё рецензируется, на 110 — уже нет.

### A. Валидаторы: `form/validation/validators/` → `form/validators/`

1. `git mv` **каталогом целиком** — 30 файлов разом. Побочный выигрыш: нынешний
   `validation/validators/index.ts` и есть нужный итоговый barrel (надмножество среднего — содержит
   те самые `UrlValidatorOptions`/`PhoneValidatorOptions`), так что слияние получается бесплатно.
2. Удалить `form/validators.ts` и `form/validation/index.ts`; каталог `form/validation/` пустеет.
   **Коллизия подтверждена по трём резолверам** (TS с `moduleResolution: bundler`, Vite
   `tryFsResolve`, плюс явные ссылки в `vite.config.ts:35` и `knip.json:10`): все отдают приоритет
   файлу `validators.ts` над каталогом `validators/`. Если оставить оба, три теста молча уедут на
   старый файл, который реэкспортирует уже удалённый `./validation/index`. Снос — в том же изменении.
3. Импорт типов в 27 фабриках, всегда строка 9: `'../../types/validation-schema'` →
   `'../types/validation-schema'`. `date-utils.ts` и `file-utils.ts` не трогать — у них нет
   относительных импортов.
4. `vite.config.ts`: entry `validators` → `src/form/validators/index.ts`; 21 гранулярный entry →
   `src/form/validators/<name>.ts`. **Ключи entry не менять.** Два ограничения на форматирование:
   - 4 entry, разбитые сейчас на 3 строки, после укорочения пути влезают в `printWidth: 100` —
     схлопнуть, иначе `npm run format:check` покраснеет;
   - `resolve(` обязан остаться **на одной строке с ключом**: [scripts/check-exports-dist.mjs:69](../../scripts/check-exports-dist.mjs#L69)
     парсит конфиг регекспом, и при переносе проверка молча деградирует до «entry не найдены».
5. `knip.json`: две записи схлопнуть в `src/form/validators/*.ts`.
6. Тесты — 6 файлов, 8 импортов: `tests/core/validation/{required,pattern,multiple-of}.test.ts`,
   `date-age.test.ts` (3 импорта), `file-validators.test.ts`, `tests/core/utils/create-form-arrays.test.ts`.

Публичный эффект: `@reformer/core/validators` наконец отдаст `UrlValidatorOptions` и
`PhoneValidatorOptions`. Аддитивно, рантайма не тянет (оба — `export type`).

### B. Группировка `form/`: `validation/` и `behaviors/`

**После A.**

1. Валидация:
   ```
   git mv src/form/validation-schema.ts   src/form/validation/schema.ts
   git mv src/form/validation-strategy.ts src/form/validation/strategy.ts
   git mv src/form/validation-config.ts   src/form/validation/config.ts
   git mv src/form/error-handler.ts       src/form/validation/error-handler.ts
   ```
2. Поведения — **та же коллизия «файл шадоуит каталог», что и в A**. Оба `git mv` в одном шаге:
   ```
   git mv src/form/behaviors.ts      src/form/behaviors/index.ts
   git mv src/form/behaviors-node.ts src/form/behaviors/node.ts
   ```
3. Внутренние импорты переехавших файлов (глубина +1):
   - `validation/schema.ts:21`, `validation/strategy.ts:18`: `../index` → `../../index`;
     `schema.ts:331` `export * from './validation-strategy'` → `'./strategy'`;
     `strategy.ts:20` → `'./schema'`; `strategy.ts:19` `../state/form-model` → `../../state/create-model`
     (после блока D — см. ниже; до него путь остаётся прежним)
   - `validation/config.ts:18,24` → `./schema`, `./strategy`
   - `validation/error-handler.ts:19`: `./types/contracts` → `../types/contracts`
   - `behaviors/index.ts:24`: `../index` → `../../index`
   - `behaviors/node.ts:14`: `./signal-node-registry` → `../signal-node-registry`
4. Импортёры: `form/index.ts:31,32` → `./validation/config`; `:39` → `./behaviors/node`;
   `:42` → `./validation/error-handler`; `create-core-form.ts:23,28` → `./validation/{config,schema}`;
   `nodes/field-node.ts:23`, `nodes/array-node.ts:16` → `../validation/error-handler`.
   Путь `./behaviors` в `create-form.ts:28` и `create-core-form.ts:21` **не меняется** — резолвится
   в `behaviors/index.ts`.
5. `vite.config.ts`: `behaviors` → `src/form/behaviors/index.ts`, `validation` →
   `src/form/validation/schema.ts`. **Ключи entry не менять.** `knip.json:8,9` — оба пути.
6. Тесты — **4 файла, 6 импортов**: `validate-model-schema.test.ts:23`,
   `form-validation-strategy.test.ts:13,14`, `create-core-form.test.ts:10,13`,
   `error-handler.test.ts:10`.
   Семь тестов в `tests/behaviors/` править **не нужно** — путь `../../src/form/behaviors`
   резолвится в новый `behaviors/index.ts` без изменений.

Побочно решается коллизия имён из инвентаризации: живой рантайм становится `validation/schema.ts`,
а `@deprecated`-типы остаются `types/validation-schema.ts` — два разных файла с одним именем
перестают существовать.

### C. React-биндинги → `platforms/react/`

1. `git mv src/form/hooks src/platforms/react/hooks` (7 файлов).
2. Обновить относительные импорты внутри хуков (глубина +2): `../nodes/*` → `../../../form/nodes/*`,
   `../types/index` → `../../../form/types/index`, `../validation-strategy` →
   `../../../form/validation/strategy`, `../../index` → `../../../index`.
3. Создать `src/platforms/react/index.ts` — barrel слоя: `useFormControl`, `useFormControlValue`,
   `useArrayLength`, `useFormValidation`, `useFormBundle` + типы `FieldControlState`,
   `ArrayControlState`, `UseFormValidationArgs`, `UseFormValidationResult`, `FormBundleLike`.
   `useSignalSubscription` наружу не отдавать — он и сейчас не публичен.
4. **Убрать хуки из `form/index.ts`** (строки 33-34, 57-62), добавить
   `export * from './platforms/react/index'` в `src/index.ts`. Состав экспортов зонтика не меняется —
   меняется источник.
5. `vitest.config.ts:28`: exclude `'src/form/hooks/types.ts'` → `'src/platforms/react/hooks/types.ts'`.
6. Тесты — 3 файла: `tests/hooks/useFormControl.test.ts:16`,
   `useFormControl-rules-of-hooks.test.ts:34`, `useFormControl-parity.test.ts:26`.

Что **останется** в `form/` от React: два **type-only** импорта — `types/deep-schema.ts:12`
(`ComponentType`) и `types/schema-node.ts:27` (`ElementType`). Стираются при компиляции,
рантайм-зависимости не создают; это часть контракта схемы, а не биндинг. Правило из блока E их
разрешает явно.

### D. Разбор `state/`

1. **Выселить чужака.** `git mv src/state/subscription-manager.ts src/form/nodes/subscription-manager.ts`.
   Три импортёра переходят на `./subscription-manager`; тест —
   `tests/core/utils/subscription-manager.test.ts:2`.

   Публичная поверхность: убрать `export { SubscriptionManager }` из `state/index.ts:58` (и упоминание
   из docblock `:19-20`), добавить в `form/index.ts`. **Состав зонтика не меняется**; сабпат `/state`
   теряет один экспорт — проверено грепом по всему репозиторию, внешних потребителей у него нет
   (только три узла формы, свой barrel и собственный тест).

2. **Разбить `form-model.ts` (571 стр.).** Связность проверена по коду — зависимости строго
   односторонние, циклов не возникает:

   ```
   model-nodes.ts ← model-signals-proxy.ts ← model-value-proxy.ts ← create-model.ts
   ```

   | Новый файл | Что переезжает | Строк |
   |---|---|---|
   | `model-nodes.ts` | `isPlainObject`, `joinPath`, `isIndexKey`, `clone`, `deepEqual`, `ModelNode`, классы `LeafNode`/`GroupNode`/`ArrayNode`, `buildNode` | ~230 |
   | `model-signals-proxy.ts` | `signalsCache`, `containerSignal`, `signalsProxy`, `isModelContainerSignal`, `resolveSignalAt` | ~125 |
   | `model-value-proxy.ts` | `nodeValue`, `arrayValueProxy`, `RESERVED`, `facadeCache`, `rootByFacade`, `makeFormModel` | ~125 |
   | `create-model.ts` | `walkLeaves`, `eachLeafSignal`, `createModel` | ~65 |

   `nodeValue` / `arrayValueProxy` / `makeFormModel` **взаимно рекурсивны** — обязаны остаться в одном
   файле (`model-value-proxy.ts`). Разрезать их нельзя.

   Наружу из `model-nodes.ts` нужен ещё `isIndexKey` — им пользуются оба прокси-файла.

   **Плоско, без подкаталога `internal/`**: в TS нет приватности каталога, knip будет спорить о
   статусе таких файлов, а зеркало `dist/state/internal/**.d.ts` всё равно уедет в npm — то есть
   «внутренность» была бы декларативной. Префикс `model-` при этом обязателен: файл `nodes.ts` в
   `state/` читался бы как тёзка `form/nodes/`, а это ровно та путаница, которую ревизия устраняет.

3. **Три модуль-локальных `WeakMap`** (`signalsCache`, `facadeCache`, `rootByFacade`) после разбиения
   живут в разных файлах. От их единственности зависит идентичность модели
   (`model.personalData.$.lastName === model.$.personalData.lastName`, `arr[i] === arr.at(i)`) и то,
   что на контейнерный узел приходится ровно один агрегирующий `computed`. Это **главный риск блока** —
   см. верификацию.

4. `state/index.ts`: `createModel` и `eachLeafSignal` из `./create-model`, `isModelContainerSignal`
   из `./model-signals-proxy`. Заодно добавить `eachLeafSignal` в barrel — сейчас его нет, из-за чего
   `validation/strategy.ts` лезет в файл напрямую в обход barrel'а. Список экспортов не сужается.
5. Тест: `form-validation-strategy.test.ts:15` → `../../../src/state/create-model`.

Что **остаётся** в `state/` и почему: `derived-registry.ts` (используется `model-nodes.ts` в
`GroupNode.set` — bulk-set не затирает compute-поля) и `safe-effect.ts` (используется
`behaviors-value.ts:16`). Оба задействованы и формой, но модель ими пользуется по-настоящему — в
отличие от `subscription-manager`.

### E. ESLint: закрепить результат

Без этого блока ревизия — разовая уборка: причина дрейфа в том, что границы никто не проверяет.

⚠️ **Правило нельзя добавлять отдельным блоком для `src/state/**`.** В flat-config последующий блок,
задающий `@typescript-eslint/no-restricted-imports` для тех же файлов, **перезаписывает** правило
целиком — существующая граница `state ⇏ form` молча исчезнет. Значит для `state/**` паттерны
дописываются в **существующий** блок [eslint.config.js:110](../../eslint.config.js#L110), а для
`form/**` заводится новый.

Два новых паттерна:

- **`react` / `react-dom` / `use-sync-external-store`** запрещены в `src/state/**` и `src/form/**`
  с `allowTypeImports: true` — именно эта опция оставляет легальными `ComponentType` и `ElementType`
  в `form/types/`.
- **`**/platforms/**`** запрещён в `src/state/**` и `src/form/**` — чтобы биндинги не потекли
  обратно. Корневой `src/index.ts` под правило не подпадает и остаётся единственной точкой сшивки.

### F. Гигиена шапок

- 25+ тегов `@module core/model/…`, `@module core/utils/…`, `@module utils/…` → актуальные пути.
- `@group Model` на `behaviors/node.ts:9,36,73` → `@group Form`.
- Переписать шапку `form/types/contracts.ts` — она описывает раскладку, которой никогда не было
  («живут в `model/`, state импортирует напрямую»; фактически файл в `form/types/`, и state его не
  импортирует — это запрещено ESLint).
- Переписать документацию `nodes/subscription-manager.ts`: примеры уже написаны про `FieldNode`,
  после блока D файл наконец окажется рядом с ними.
- `state/behaviors-value.ts` — ссылка `{@link module:core/model/behaviors}` ведёт в никуда.
- `form/types/validation-schema.ts:11` — ссылка на `core/validation/index.ts`, устаревшая дважды.
  Этот JSDoc уезжает в `dist/…d.ts`, то есть в npm.
- [tests/README.md:3,25](../../packages/reformer/tests/README.md#L3) — утверждение «test structure
  mirrors the source code structure» и пример `src/core/nodes/field-node.ts` неверны. Каталог
  `tests/` в этой итерации не переструктурируется, поэтому README надо привести к **фактическому**
  положению дел, а не к желаемому.
- [scripts/diagrams/gen-excalidraw.mjs:301](../../scripts/diagrams/gen-excalidraw.mjs#L301) —
  захардкоженная подпись `'src/form/: nodes/ … types/ · validation/'`. Текст в картинке, не
  path-lookup; в CI не входит.

## Что не делаем и почему

**Переименование `state/` → `model/`.** Отменено по итогам оценки. Это откат задачи `ReFormer-by9.5`,
которая переименовала `model/` → `state/` именно по фидбеку пользователя: «state dir must contain ONLY
reactive substrate, nothing form-related». Имя `state` несёт **ограничение** — в этом его ценность;
имя `model` такого ограничения не несёт, и туда снова потянет form-related, как уже было в
`by9.4` → `by9.5`. Плюс переименование потребовало бы вечного алиаса `/state` + `/model`. Взамен —
поправить `src/index.ts:2`, где написано «модулями model (state) и form», и свести терминологию
к одному слову (пункт блока F).

**Перенос `aggregate-signals` / `status-machine` / `form-proxy-builder` в `nodes/`.** Выгода
эстетическая, риск ненулевой.

**Переструктурирование `tests/`.** Каталог действительно живёт в снесённой раскладке
`tests/core/{model,nodes,utils}/`, и `tests/core/utils/` смешивает оба слоя. Но это ~55 файлов
движения, а **`tsc` их не проверяет** (`tsconfig.json` имеет `include: ["src"]`) — единственный гейт
это фактический прогон тестов. Соотношение риска и навигационной пользы не в пользу переезда; в этой
итерации правятся только импорты, которые ломают блоки A–D (~14 файлов). Отдельная bd-задача.

**Два runtime-цикла** (`array-node → group-node → node-factory → array-node` и семимодульный
`index → form/index → validation/config → validation/schema → index`). Оба ESM-безопасны только
потому, что кросс-рёбра потребляются внутри функций.

**`signals.ts` не является фактическим владельцем рантайма** — заявлен как «единая точка», но внутри
`src/` его использует один файл (type-only), а 15 файлов тянут `@preact/signals-core` напрямую.

**Поведения на трёх уровнях** с дублирующимися именами (`copyFrom`, `computeFrom`, `enableWhen`,
`transformValue`, `resetWhen`, `syncFields`, `revalidateWhen` — по 2-3 определения в
`state/behaviors-value.ts`, `form/behaviors/node.ts`, `form/behaviors/index.ts`). Блок B делает это
дублирование виднее, но не устраняет.

## Верификация

```bash
# из корня
npm run lint
npm run format:check                   # ловит несхлопнутые entry в vite.config.ts
npm run typecheck                      # все пакеты — но НЕ tests/
npm run knip

npm test -w @reformer/core             # единственный гейт на импорты в tests/
npm run coverage -w @reformer/core     # пороги 79/71/80/81 — гейт CI
npm run build -w @reformer/core

npm run check:exports-dist             # каждый путь exports существует в dist И наоборот
npm run check:dist-deps
npm run size
git diff --exit-code -- 'packages/*/llms.txt'
```

**Тест идентичности модели — главная проверка блока D.** Три `WeakMap` разъехались по файлам; если
сборка положит их в разные чанки, идентичность фасадов сломается тихо:

```bash
npx vitest run tests/state/subpath-single-runtime.test.ts
```

Плюс ручная проверка на собранном пакете:

```js
model.personalData.$.lastName === model.$.personalData.lastName   // true
model.tags.at(0) === model.tags[0]                                // true
```

**Негативные тесты ESLint-правил** (блок E считается выполненным только после них) — по одному на
каждое правило, временной правкой с последующим откатом:

```
src/state/**  →  import … from '../form/nodes/form-node'     // должно упасть (старое правило цело)
src/form/**   →  import { useState } from 'react'            // должно упасть (новое правило)
src/form/types/deep-schema.ts → import type { ComponentType } from 'react'   // должно ПРОЙТИ
src/form/**   →  import … from '../platforms/react/index'    // должно упасть
```

Третья строка важнее прочих: если `allowTypeImports` настроен неверно, правило сломает существующий
код и это выяснится только на полном прогоне.

**Инвариант неломки barrel'а** — состав экспортов `src/index.ts` до и после должен совпасть (44
рантайм-экспорта). Критичен для блоков C и D, где пять хуков и `SubscriptionManager` меняют источник:

```bash
node -e "import('./dist/index.js').then(m=>console.log(Object.keys(m).sort().join('\n')))" > after.txt
# сравнить с тем же выводом, снятым ДО начала работ
```

Статические проверки до сборки:

```bash
for p in src/form/hooks src/form/validators.ts src/form/behaviors.ts src/form/behaviors-node.ts \
         src/form/error-handler.ts src/form/validation-schema.ts src/state/subscription-manager.ts; do
  test ! -e packages/reformer/$p || echo "ОСТАЛОСЬ: $p"
done
grep -rn "from 'react'" packages/reformer/src/form/ packages/reformer/src/state/   # 0 строк
```

**Публичные сабпаты после сборки:**

```bash
cd packages/reformer/dist
cat validators/required.d.ts     # export * from '../form/validators/required'
cat validators.d.ts              # export * from './form/validators/index'
cat validation.d.ts              # export * from './form/validation/schema'
cat behaviors.d.ts               # export * from './form/behaviors/index'
node -e "import('./validators/required.js').then(m=>console.log(typeof m.required))"   # function
```

`vite-plugin-dts` кладёт зеркало `src/` в `dist/` относительно `rootDir`, а на каждый entry генерирует
stub, путь которого зависит **только от ключа entry** (проверено по исходнику плагина и по фактическому
`dist/`). `package.json` ссылается на stub'ы, поэтому перенос файлов внутри `src/` их пути не меняет.

**Консументы:** собрать `@reformer/cdk`, `@reformer/renderer-react`, `@reformer/renderer-json`, затем
`npm run typecheck`. Финально — `projects/react-playground` (страницы `examples/validation`,
`examples/file-upload`) и e2e `projects/react-playground-e2e`.

**Регенерируемое:** `packages/reformer/llms.txt` (пересобирается `npm run generate:llms` внутри
`npm run build`; в CI гейт `git diff --exit-code`) и `projects/reformer-doc/docs/api/**` (typedoc,
закоммичен — регенерацию не забыть).

**Откат:** каждый блок — отдельный PR, `git revert` одного коммита. Артефакты `dist/` в git не лежат,
состояние npm не затрагивается.

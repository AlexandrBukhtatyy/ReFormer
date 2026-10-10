# Тесты ядра @reformer/core: каждый модуль, сквозная сложная форма, гейт на файл

## Context

Пользователь хочет стабилизировать дальнейшую разработку ядра: (1) каждый модуль `packages/reformer`
покрыт своими тестами; (2) проверено взаимодействие всех модулей и фич — на синтетической «сложной
форме» со всеми возможностями.

Состояние (замер 2026-10-10): 71 тестовый файл, 1074 теста, покрытие 91.6 / 88.5 / 94.1 / 93.0
(stmts / branches / funcs / lines) при порогах 79/71/80/81 и без порога на файл. Пробелы:

- React-хуки `src/platforms/react/hooks/` — 0–10%: `useFormControlValue`, `use-form-flow`,
  `use-form-validation`, `useArrayLength`, `use-form-bundle`; `useSignalSubscription` 64/45,
  `field-binding/field-handle.ts` 69%. Причина — окружение `node`, только `renderToStaticMarkup`.
- 16 валидаторов без своих тестов (их задевает только `tests/i18n/validation-message.test.ts`
  одним неверным значением): email, min, max, min/max-length, url, phone, is-number, integer,
  non-negative, non-zero, is-date, min/max-date, past/future-date; даты возраста и файловые — тонко.
- Ветви: `behaviors/schema-operators.ts` 57%, `behaviors/operators.ts` 76%, `internals.ts` 70%,
  `form-array-node.ts` 79%; косвенно покрыты aggregate-signals, row-key, validation/context,
  form-proxy-builder, runtime-token, `registerSignalNode`.
- Сквозного теста «вся форма» нет: интеграционные тесты узкие (`form-level.test.ts` — поток на двух
  скалярах; `behaviors/scenarios`, `web-scenarios` — поведение без настоящей валидации).
- Гигиена: 4 пустые заглушки (`expect(true).toBe(true)`), `tests/hooks/useFormControl.test.ts`
  тестирует ноду, а не хук; `tick`/`flush`/`deferred`/`InputStub`/`codesOf` скопированы по файлам;
  `tests/README.md` устарел; `src/locale/index.ts` с логикой выпал из покрытия (exclude
  `src/**/index.ts`); скрипт `coverage` идёт без обёртки `scripts/run-vitest.mjs`; vitest 4.0.15
  против coverage-v8 4.0.18.

Проверено по коду: `defer` (`src/form/behaviors/context.ts:130`) теряет отменитель
`runOutsideEffect`; `createForm` контроллер стратегии не запускает — `start()` вызывает только
`useFormBundle` (`hooks/use-form-bundle.ts:43`); у бандла нет `dispose` (у сырых нод есть —
`tests/test-utils/dispose-form.ts`); все effect'ы ядра создаются через `effect` из
`@preact/signals-core`; `rowKeyOf` — глобальный счётчик (в снапшотах нормализовать).

## Решения

| Тема | Решение |
| --- | --- |
| React-хуки | devDeps `happy-dom`, `@testing-library/react`, `@testing-library/dom`, `@types/react-dom`; окружение — `// @vitest-environment happy-dom` только в DOM-файлах; явный `afterEach(cleanup)` (globals выключены) |
| Property-based | `fast-check` (без `@fast-check/vitest` — peer vitest ^4.1) |
| Type-тесты | `*.type-test.ts` + `expectTypeOf`/`@ts-expect-error`, проверяет `tsc` (`tsconfig.tests.json` в корневом `npm run typecheck`); без `vitest --typecheck` |
| Утечки | поведенческие проверки после dispose + счёт живых effect'ов обёрткой `vi.mock('@preact/signals-core')` |
| Снапшоты | детерминированное описание `CompiledSchema` (ключи строк нормализованы) + снимок имён экспортов входов |
| Гейт | агрегат в vitest (храповик: факт − 1…2 п.п. после каждого этапа) + минимум на файл (строки ≥ 80, ветви ≥ 70) скриптом по `coverage-summary.json` с явными исключениями (`reason` + `issue`) |
| Фикстура | синтетическая форма в `tests/integration/fixtures/loan-application/` — без кода playground, UI — заглушки |

**Политика дефектов.** Тест вскрыл дефект → задача bd (`--type bug`, id в названии теста).
Маленький (локальный, без смены API, ≲ 20 строк `src`) — чинить в этапе отдельным коммитом
`fix(reformer): …` перед `test(reformer): …`. Крупный или спорный контракт — `it.fails('… [ReFormer-xxxx]')`
с одним точным утверждением (покраснеет, когда починят). Мета-тест `tests/meta/known-defects.test.ts`
требует id задачи в каждом `it.fails`.

**Соглашения.** Русская JSDoc-шапка «что и зачем»; `describe('<модуль> — <тема>')`; явный импорт из
`vitest`; исходники относительным путём; kebab-case; суффиксы `.property.test.ts`,
`.snapshot.test.ts`, `.dom.test.tsx` (если рядом node-близнец). Каждый тест собирает свою форму.
Фейковые часы — `toFake` без `queueMicrotask`; `waitFor` с фейковыми часами не использовать.

## Этапы

Каждый этап — зелёный, отдельный коммит(ы) по просьбе пользователя. Этапы 1–8 после 0 независимы.
Порядок: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 10a → 9 → 10b → 10c → 10d → 11 → 12.

### 0. Инфраструктура
- `packages/reformer/package.json`: devDeps выше (`happy-dom@^20.14.6`, `@testing-library/react@^16.3.3`,
  `@testing-library/dom@^10.4.2`, `@types/react-dom@^19.2.3`, `fast-check@^4.10.2`), пин
  `@vitest/coverage-v8` точно `4.0.15`; скрипты `coverage` → `node ../../scripts/run-vitest.mjs --coverage`,
  `typecheck` (оба tsconfig).
- `vitest.config.ts`: `unstubEnvs: true`; reporter `json-summary`; include `src/**/*.{ts,tsx}`; exclude
  без общего `src/**/index.ts`, плюс `src/**/*.test.{ts,tsx}`; обновить устаревший комментарий.
- `scripts/run-vitest.mjs`: маркер падения порогов `ERROR: Coverage for|Uncovered`; с `--coverage`
  выход по простою — успех только при `Coverage report from v8`.
- `tests/test-utils/`: `async.ts` (tick, flushMicrotasks, settle, deferred, useFakeClock, advance),
  `issues.ts` (issueCodes, resultCodes), `stubs.ts` (заглушки с displayName), `rule-table.ts`
  (табличные кейсы правил), `react.tsx` (renderHookCounting, StrictWrapper), `property.ts`
  (FC_SEED / FC_NUM_RUNS), `effect-tracker.ts`. Перевести 10 копий `tick` и прочие дубли на них.
- Гигиена: удалить 4 заглушки (`tests/core/utils/{make-form,registry-helpers}.test.ts`,
  `tests/core/types/{group-node-proxy,validation-schema}.test.ts`); `git mv tests/hooks/useFormControl.test.ts
  tests/core/nodes/form-control-node-signals.test.ts` с русской шапкой; переписать `tests/README.md`
  (каталоги, окружения, суффиксы, seed, `-u` снапшотов, type-тесты, гейт, политика дефектов);
  `knip.json` — entry `tests/**/*.type-test.ts` (и `ignoreDependencies: happy-dom`, если нужно).
- Smoke DOM: `tests/hooks/use-array-length.test.tsx` (при несовместимости happy-dom 20 — `^18`).

### 1. Валидаторы — `tests/core/validators/`
Перенести `required`, `pattern`, `multiple-of`, разбить `date-age` и `file-validators`; новые файлы на
каждое правило (27) + `date-utils`, `validation-issue`, `file-utils`. Табличные кейсы через
`rule-table.ts`: граница проходит, `params`, пустые значения, `NaN`/`-0`/`Infinity`, строки и
массивы, форматы `phone`, протоколы `url` (порт/localhost/IP — зонды), даты на фейковых часах
(сегодня/вчера/завтра, 29 февраля, время игнорируется), файлы (`accept` с пробелами/регистром/`image/*`,
сумма размеров). `rule-contract.test.ts` — по всем экспортам `validators/index.ts`: пусто → `null`
(кроме `required`), `{ code }`, слияние `params`, без текста, повторный вызов (регрессия `/g`).
Зонд часового пояса `date-iso-strings-tz.test.ts` (`TZ=America/New_York`, строка `YYYY-MM-DD`).
Цель — 100/100 по каждому валидатору.

### 2. Модель — `tests/core/model/`
`create-model` (обход не-модели, порядок), `model-signals-proxy` (`valueOf/toJSON`, `signalAt` краевые),
`model-value-proxy` (`for…of`, запись неизвестного ключа, затенение `get/set`), `model-nodes`
(Date/File/Blob — листья, `deepEqual`, `fillFromBlank`; зонды `removeAt(-1)`, `insertAt` за концом,
`isDirty` для новой равной `Date`, общая ссылка `Date` с `initial`), `behaviors-value-dispose`
(cleanup каждой value-операции, `syncFields` с `transform`).

### 3. Ноды и модули состояния — `tests/core/nodes/`
`state/{availability,component,interaction,issues,pending}.test.ts`; `aggregate-signals` (выключенный
ребёнок вне `valid`, порядок `issues`, зонд: `warning` группы); `form-array-node` (`keyAt` стабилен при
`move/swap`, `RangeError`, `insert`, `reset`; зонд: `disable()` массива → `push()`);
`form-group-node` (`setValue` с неизвестным ключом, `reset(partial)`, идемпотентный `dispose`; зонд:
`enable()` группы против `disabled: true` поля); `node-kind`; расширить `form-proxy-shadowing`
(ловушки `set/has/ownKeys`, стабильность методов); `tests/core/utils/{signal-node-registry,row-key,runtime-token}.test.ts`.

### 4. Схема — компилятор, контроллер, поддеревья
Расширить `compile-schema.test.ts` (part на не-группе, item на не-массиве, относительный part в строке,
подсказки `value/array`, цикл, склейка текста, `isCompiledNode`, мемоизация `row()`, scope id);
`schema-subtree`, `schema-controller` (`versionFor`, `unknownSchemaSelectors`, `getRef`);
утилита `tests/test-utils/compiled-snapshot.ts` (`describeCompiled`) и `compile-schema.snapshot.test.ts`.

### 5. Поведение — `tests/behaviors/`
Харнесс `tests/test-utils/schema-harness.ts` (`mountScope` → `isHidden/propsOf/fire/unmount`,
семантика как у `renderer-react/src/core/render-node.tsx`). Файлы: `schema-operators` (все 6 непокрытых
ветвей: два `hideWhen` на селектор, перерегистрация событий, `onMount`+`onUnmount`, `onInit`,
`setHidden/resetHidden`), `operators` (`when=false`, dispose `onChange` с debounce — таймер и
`AbortSignal`, `enableWhen` без ноды, `disableWhen`, `copyFrom` с transform, счётчик `markDerived`),
`internals`, `collections` (не-массив, ошибка немaterialized строки, **dispose снимает поведения строк**,
расходимость `aggregateInto`), `context` (`getScope/onDispose` вне схемы, cleanup effect'а, ошибки `defer`).
Зонд «отложенная запись после dispose в том же тике» для enableWhen/enableGroup/copyFrom группы/
transformValue/resetWhen/syncFields/revalidateWhen/aggregateInto — ожидаемый маленький фикс
(собирать отменители `runOutsideEffect` в `onDispose`).

### 6. Валидация, стратегия, уровень формы, поток
`tests/core/validation/{context,run}.test.ts` (вложенный контекст, отменённый сигнал, результат не от
раннера); расширить `form-validation-strategy` (пересекающиеся прогоны, сброс debounce, `start` после
`dispose`; зонд `blur` + строка после `start()`), `form-level` (шаг без потока, `cancelled` при двух
отправках, `validating` в `validateStep`), `form-flow` (`goTo` вперёд/на себя);
`tests/core/production-mode.test.ts` (`vi.stubEnv('NODE_ENV','production')` — 6 dev-веток молчат).

### 7. i18n
`tests/i18n/core-locale-loader.test.ts` (`src/locale/index.ts`: `CORE_LOCALES`, `loadCoreLocale`,
цепочка загрузчиков); расширить `locale-store` (устаревший запрос), `message-format` (экранирование,
синтаксические ошибки), `translator` (dev/prod), `validation-message` (откат `Intl.ListFormat`), `locale`.

### 8. React-хуки в happy-dom — `tests/hooks/*.test.tsx`
`use-form-control-value`, `use-array-length`, `use-form-flow`, `use-form-validation`, `use-form-bundle`
(`it.fails [ReFormer-8el5]` — размонтирование не освобождает поведение), `use-form-control.dom`,
`use-signal-subscription`, `field-handle.dom` (`makeElementFieldHandle`, `useFieldHandleRef`),
`form-bundle-context`, `ssr` (node), `tests/i18n/provider.dom`, `i18n-hooks.dom`. Проверять: ререндер
только на нужный сигнал (счётчик рендеров), подмена аргумента, StrictMode, после `unmount` нет
ререндеров и `liveEffects()` вернулся к базе. Мок-тесты `useFormControl-parity`/`rules-of-hooks` остаются.

### 9. Type-тесты
Рядом с исходником: `src/form/behaviors/operators.type-test.ts`, `src/platforms/react/hooks/hooks.type-test.ts`,
`src/i18n/i18n.type-test.ts`, `src/model/model.type-test.ts`, `src/form/flow/flow.type-test.ts`,
`src/form/schema/compiled.type-test.ts`; сквозные: `tests/types/{loan-fixture,public-entries}.type-test.ts`.
Мутационная проверка вручную: сломать ожидание — `tsc` падает.

### 10. Сложная форма и сквозные сценарии (10a–10d)
**Фикстура `tests/integration/fixtures/loan-application/`**: `model.ts` (группы `loan`, `applicant`
с `passport`, два адреса, `employment` с массивом `previousJobs` внутри part, `coBorrowers` с part
адреса и вложенным `arrayOf(phones)`, `documents: File[]`, `interests: string[]`, `references` с
шаблоном из `initialValue`, derived-поля, явный `markDerived`), `api.ts` (управляемые deferred-заглушки
с журналом и `signal.aborted`), `components.ts`, `schema.ts` (визард из 7 шагов, текстовые узлы
строка/число/сигнал, part на два адреса, part в item, selector в строке, `disabled` у поля),
`behavior.ts` (все операторы: compute/computeFrom, enableWhen/disableWhen с resetOnDisable, copyFrom
группы и с transform, syncFields, transformValue, resetWhen, onChange immediate и с debounce+signal,
revalidateWhen, apply/applyEach вложенные, exclusiveFlag, aggregateInto, hideWhen, onInit/patchProps,
onComponentEvent, renderEffect+flow.goTo, onMount/onUnmount, пользовательский оператор на
getScope/effect/defer/onDispose), `validation.ts` (все 27 правил; cross в корне и строке, validateWhen,
apply/applyEach вложенные, validateAsync с signal и отклонением, warning, params, extras, `apply(...schemas)`
для варианта `rules`), `flow.ts` (шаг без правил), `messages.ts` (ICU plural/select, функция, свои коды;
`extendLocale` ru/en), `create-loan-form.ts` (опции strategy/debounce/liveAfterSubmit/server/initial+seed/rules),
`actions.ts`, `react.tsx`.

**Сценарии `tests/integration/`** (ID с префиксом файла): `bundle-assembly` (порядок сборки, ноль
предупреждений, паритет `createFormFromModel`+`createFormLevel`, документ+заглушка реестра, type guards),
`wizard-happy-path` (touched только полей шага, locked/edge/canGoTo, submit с `model.get()`, выключенное
поле в extras), `conditional-branches`, `arrays-lifecycle` (removeAt/move/swap при выставленных issues,
keyAt, patch массива с сервера), `async-and-races` (pending, error/ruleFailed, cancelled, удаление строки
во время async, debounce+abort, dispose во время debounce), `live-strategies` (change+debounce, blur,
afterFirstSubmit+liveAfterSubmit, revalidateWhen без цикла), `reset-and-loading` (patch+captureInitial,
isDirty, model.reset против form.reset, initial+seed), `submit-statuses` (все 5 статусов, extras,
rules, серверные setIssues), `i18n-messages` (plural 1/2/5/21, select, загрузчики, msg/resolveLocalized,
createI18n), `react-assembly` (happy-dom: фабрика 1 раз, точечные ререндеры, фокус первой ошибки через
getRef+useFieldHandleRef, StrictMode, смена языка), `compiled-schema.snapshot` (+ `public-api` снимок
имён экспортов), `loan-form.property`.

Матрица «фича → сценарий» ведётся в шапке `tests/integration/README.md`: каждая фича из инвентаризации
(модель, схема, поведение, валидация, валидаторы, поток, отправка, i18n, React) указывает файл и ID кейса.

### Property-based (в этапах 2, 4, 5, 6, 7, 10d)
`model-array.property` (fc.commands push/insertAt/removeAt/move/swap/clear против эталонного массива;
пути, идентичность строк, `keyAt`), `model.property` (set/get, patch, isDirty, reset, captureInitial,
derived не трогаются), `validators.property`, `date-validators.property` (возраст против эталонной
арифметики), `compile-schema.property` (случайные деревья: уникальные id, детерминизм, повтор селектора),
`runner.property` (статус ⇔ `form.valid`, идемпотентность, warning), `form-flow.property` (инварианты
индекса, completed, canGoTo, locked), `message-format.property` (сверка с `intl-messageformat`, разбор
или `MessageSyntaxError`), `behaviors.property` (сходимость sync/copy/exclusive/aggregate/compute),
`loan-form.property` (25 прогонов). Воспроизведение: `FC_SEED`, `FC_NUM_RUNS`.

### 11. Dispose и утечки
`tests/integration/dispose-and-leaks.test.ts` + юнит-аналоги: сборка + `start()` → dispose
(`disposeForm` + `controller.dispose()`) возвращает `liveEffects()` к базе; строки и вложенные массивы;
таймеры debounce (`vi.getTimerCount() === 0`) и `AbortSignal`; отложенные записи в том же тике; реестры
схемы (`__overrideMaps`) пусты; признаки derived отпущены; 50 циклов без дрейфа; размонтирование хуков;
20 ререндеров без новых effect'ов. Поведенческие проверки: после dispose записи в модель не вызывают
compute/onChange/issues/componentProps.

### 12. Гейт покрытия и CI
`scripts/check-coverage-per-file.mjs` + `packages/reformer/coverage.per-file.json`
(`min: { lines: 80, branches: 70 }`, исключения только с `reason` и `issue`, лишнее исключение —
ошибка, пути нормализуются); `coverage` = обёртка vitest && скрипт; агрегат = замер − 1…2 п.п. с датой
и фактом в комментарии. `.github/workflows/test.yml`: шаги тестов и покрытия ядра — один
`npm run coverage -w @reformer/core`.

## Вероятные находки (зонды)
Отложенные записи операторов не отменяются при dispose; ISO-строки дат сдвигаются на день в западных
поясах; `useFormBundle` не освобождает поведение (ReFormer-8el5); расхождение статуса прогона и
`form.valid` (строка удалена во время async, `disable()` массива + `push()`, собственное `warning`
группы); `submit()` сразу после `createForm` до отложенного `enableWhen`; стратегия `blur` не видит
строки после `start()`; `removeAt(-1)`, `Date` в `isDirty`/`initial`; перезапись результатами между
схемами шага и формы; `group.enable()` против `disabled: true` поля; семантика `url` (порт, localhost, IP).

## Критичные файлы
- `packages/reformer/vitest.config.ts`, `packages/reformer/package.json`, `scripts/run-vitest.mjs`
- `packages/reformer/tests/test-utils/*`, `packages/reformer/tests/README.md`, `knip.json`
- `packages/reformer/tests/integration/fixtures/loan-application/*`
- `.github/workflows/test.yml`, новый `scripts/check-coverage-per-file.mjs`

## Объём
71 → ≈165 тестовых файлов, 1074 → ≈1900 тестов, ≈8 type-test файлов; 12 этапов, этап 10 — 4 коммита.

## Проверка
Каждый этап:
1. Из `packages/reformer`: `npm test`, `npm run coverage` (после этапа 0 — через обёртку; один раз
   проверить, что заниженный порог даёт exit 1), `npm run typecheck`.
2. `npx eslint packages/reformer`, `npx prettier --check packages/reformer`, `npm run knip`.
3. Новые async/DOM/фейковые-часы файлы — 20 прогонов подряд без падений.
4. По lcov целевые файлы этапа ≥ 80/70 и закрыты перечисленные ветви; храповик агрегата.
5. Каждый `it.fails` один раз без `.fails` падает именно на своём утверждении; задача bd заведена.

Итог:
1. `npm run build -w @reformer/core`, затем `npm run coverage -w @reformer/core` — агрегат и скрипт по
   файлам зелёные.
2. Корневые `npm run typecheck`, `lint`, `format:check`, `knip`.
3. Три прогона `node ../../scripts/run-vitest.mjs --sequence.shuffle` — нет зависимости от порядка.
4. `FC_NUM_RUNS=1000 npx vitest run property` — глубокий прогон свойств.
5. `tests/meta/known-defects.test.ts` зелёный; список `it.fails` совпадает с открытыми задачами bd.
6. Время полного прогона ядра записано в `tests/README.md` (ориентир < 90 с).
7. Зависимые пакеты не задеты: `npm run build -w @reformer/cdk && npm run test -w @reformer/cdk`
   (и ui-kit, renderer-react, renderer-json), если этап менял `src` ядра.

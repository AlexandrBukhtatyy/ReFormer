# Сквозные сценарии ядра: заявка на кредит

Каталог проверяет взаимодействие всех модулей и фич `@reformer/core` на одной синтетической
«сложной форме» — заявке на кредит. Это этапы 10 и 11 плана `docs/plans/core-tests-coverage.md`;
юнит-тесты модулей лежат в соседних каталогах `tests/`, здесь — только то, что видно, когда модули
работают вместе.

## Фикстура `fixtures/loan-application/`

Обычный код, не тест: импорты ядра — только из входов сабпатов (`src/index.ts`, `./model`,
`./behaviors`, `./validation`, `./validators`, `./i18n`, `./signals`, `./locale/*`; `./react` — только
в `react.tsx`), UI — заглушки. Barrel нет: сценарии импортируют модули явно. Экспортировано то, чем
пользуются сценарии (`knip`); новому сценарию нужное — откройте экспорт.

| Модуль                | Что даёт                                                                                                                                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model.ts`            | `LoanApplication`, начальные значения (`createLoanInitial`), модель (`createLoanModel`), поле сервера с явным `markDerived` (`markServerOwned`), пределы суммы                                                                                             |
| `api.ts`              | `createLoanServer` — управляемые заглушки: проверка ИНН, города региона, отправка, черновик; журнал вызовов, ручные ответы (`manual`, `hold` посреди сценария), отмена по `AbortSignal`                                                                    |
| `components.ts`       | заглушки компонентов с `displayName`                                                                                                                                                                                                                       |
| `schema.ts`           | `loanSchema` — визард из 7 шагов, подформы, строки, текстовые дети, `disabled`, `initialValue`                                                                                                                                                             |
| `behavior.ts`         | `createLoanBehavior` — все операторы `./behaviors` и пользовательский оператор                                                                                                                                                                             |
| `validation.ts`       | `createLoanRules` — правила шагов, межшаговые `extras`, полный набор `apply(...схемы)`; все 27 правил `./validators`                                                                                                                                       |
| `flow.ts`             | `LOAN_STEPS`, `createLoanFlow` — шаги с правилами и шаг проверки без правил                                                                                                                                                                                |
| `messages.ts`         | словарь формы (`plural`, `select`, функции, свои коды), локали `loanRu` / `loanEn` (`extendLocale`); `loanLocales` — локали с текстами всех своих кодов правил, `LOAN_APP_MESSAGES` — словари приложения без ядра                                          |
| `locale-server.ts`    | `createLocaleServer` — заглушка сервера словарей (`fetch` для `fetchMessages`): ответ сразу или вручную (`answer`), `404` языку без словаря, журнал адресов                                                                                                |
| `create-loan-form.ts` | `createLoanForm(options)` — сборка `createForm`; опции `strategy`, `debounce`, `liveAfterSubmit`, `server`, `initial` + `seed`, `rules: 'all'`, `extraRules` и `extraBehavior` (правила и поведение сценария поверх заявки); отдаёт бандл, сервер, правила |
| `actions.ts`          | заполнение шагов и всей заявки (`fillLoanApplication`) верными данными, `addCoBorrower`, `passWizardTo`, файлы и даты относительно «сегодня»                                                                                                               |
| `arbitraries.ts`      | генераторы fast-check: случайная верная заявка (`validApplicationArb`), запись её шага в модель (`fillGeneratedStep`), случайный частичный черновик (`loanDraftArb`), поля, которыми владеет форма (`OWNED_FIELD_PATHS`, `withoutOwnedFields`)             |
| `react.tsx`           | `LoanApp` — React-оболочка на заглушках: `useFormBundle` + контекст сборки, шаг по `useFormFlow`, поля, строки массивов, видимость узлов, тексты замечаний под `I18nProvider`; счётчик рендеров (`onRender`)                                               |

Шаги: `loan` → `applicant` → `contacts` → `employment` → `co-borrowers` → `documents` → `review`.

Отложенные записи поведения (`enableWhen`, `copyFrom` группы, `syncFields`, …) идут на микротасках
и читают состояние в момент записи: загрузка в том же тике, что и сборка, сохраняется (BA-40,
BA-41). Проверять результат — после `await settle()` (или `flushBehaviors()` под фейковыми часами).

## Сценарии

| Файл                               | Этап | ID    | О чём                                                                                                                                                                          |
| ---------------------------------- | ---- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bundle-assembly.test.ts`          | 10a  | `BA-` | сборка, паритет ручной сборки, компиляция, гарды, каждый оператор и каждое правило                                                                                             |
| `wizard-happy-path.test.ts`        | 10a  | `WH-` | проход визарда, `touched` шага, `locked`/`edge`, `canGoTo`, отправка, `extras`                                                                                                 |
| `conditional-branches.test.ts`     | 10b  | `CB-` | условные ветки: доступность, видимость и `validateWhen` согласованы; `compute(…, { when })`, условие на вычисляемом поле, ручные `enable`/`disable`, туда-обратно в одном тике |
| `arrays-lifecycle.test.ts`         | 10b  | `AL-` | `insert`/`move`/`swap`/`removeAt`/`clear` при замечаниях, `keyAt`, поведение строк, `patch` массива с сервера, `modelOf`                                                       |
| `reset-and-loading.test.ts`        | 10b  | `RL-` | `patch` + `captureInitial`, `set` против `patch`, `isDirty`/`dirty`, `model.reset` против `form.reset`, `initial` + `seed`, `flow.reset`                                       |
| `async-and-races.test.ts`          | 10c  | `AR-` | `pending`, `error`/`ruleFailed`, `cancelled`, удаление строки во время async, `debounce` и отмена запроса                                                                      |
| `submit-statuses.test.ts`          | 10c  | `SS-` | все 5 статусов отправки, `extras`, `rules: 'all'`, серверные `setIssues`                                                                                                       |
| `live-strategies.test.ts`          | 10c  | `LS-` | `change` + `debounce`, `blur`, `afterFirstSubmit` + `liveAfterSubmit`, `revalidateWhen`, новые строки                                                                          |
| `i18n-messages.test.ts`            | 10d  | `IM-` | текст каждого замечания правил на ru/en, порядок источников, `plural`/`select`/функции, параметры, загрузчики, `msg`                                                           |
| `react-assembly.dom.test.tsx`      | 10d  | `RA-` | happy-dom: фабрика один раз, точечные ререндеры, поток и фокус ошибки, узлы схемы, язык, размонтирование                                                                       |
| `compiled-schema.snapshot.test.ts` | 10d  | `CS-` | снимок скомпилированной схемы заявки целиком, стабильность между сборками и при `move`/`swap`, `schemaSubtree`, вид привязок узлов                                             |
| `public-api.snapshot.test.ts`      | 10d  | `PA-` | снимок имён и видов экспортов каждого входа сабпата, входы без React, `./signals`, `CORE_RUNTIME_TOKEN`                                                                        |
| `loan-form.property.test.ts`       | 10d  | `LP-` | свойства заявки на случайных данных: верная заявка, одна неверная правка, команды массива, `patch` черновика, `reset`                                                          |
| `dispose-and-leaks.test.ts`        | 11   | `DL-` | снятие сборки: effect'ы к базе, таймеры и `AbortSignal`, отложенные записи в тике снятия, реестры схемы, derived, 50 циклов, сборщик мусора                                    |

Снапшоты (`CS-`, `PA-`) обновляются осознанно: `npx vitest run -u <файл>` из каталога пакета, затем
дифф снимка — в ревью. Свойства (`LP-`) воспроизводятся по `FC_SEED`, глубокий прогон —
`FC_NUM_RUNS=1000`.

## Матрица «фича → сценарий»

Ссылка — `файл · ID` (файлы без `.test.ts`); «косвенно» — фича работает внутри другой проверки,
отдельного утверждения нет.

### Модель (`.`, `./model`, `./signals`)

| Фича                                                           | Сценарий                                                                                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `createModel`, вложенные группы, `model.get()`                 | bundle-assembly · BA-06; wizard-happy-path · WH-06                                                                                   |
| `arrayOf` — «Добавить» без значения, вложенный шаблон в строке | bundle-assembly · BA-11                                                                                                              |
| группа и массив в строке массива                               | bundle-assembly · BA-11, BA-22; arrays-lifecycle · AL-13                                                                             |
| `patch` (загрузка; производные поля не затираются)             | bundle-assembly · BA-14, BA-16, BA-39; reset-and-loading · RL-01, RL-03; arrays-lifecycle · AL-09, AL-10; loan-form.property · LP-04 |
| `captureInitial`, `set`, `reset`, `isDirty`, `signalAt`        | reset-and-loading · RL-01, RL-02, RL-05, RL-06, RL-09, RL-11, RL-13; loan-form.property · LP-02, LP-05                               |
| `ModelArray`: `push`, `at`, `toArray`, `removeAt`, `clear`     | bundle-assembly · BA-11, BA-28, BA-43                                                                                                |
| `ModelArray`: `insertAt`, `move`, `swap`                       | arrays-lifecycle · AL-14, AL-05, AL-11; loan-form.property · LP-03; compiled-schema.snapshot · CS-03                                 |
| `modelOf`                                                      | arrays-lifecycle · AL-11; косвенно (`apply` / `applyEach`) — BA-27, BA-28                                                            |
| `eachLeafSignal`, `eachValueSignal`                            | live-strategies · LS-16, LS-17; async-and-races · AR-16; loan-form.property · LP-04                                                  |
| `isModelContainerSignal`, `isValueSignal`                      | compiled-schema.snapshot · CS-06, CS-07; косвенно (вид привязки) — BA-09                                                             |
| `markDerived` явно, `isDerived`                                | bundle-assembly · BA-16, BA-04, BA-15; reset-and-loading · RL-03, RL-04; loan-form.property · LP-04; public-api.snapshot · PA-08     |
| `unmarkDerived`                                                | dispose-and-leaks · DL-28                                                                                                            |
| `runOutsideEffect`, `safeCallback`, `safeDebouncedCallback`    | async-and-races · AR-15, AR-16, AR-17; косвенно — отложенные записи BA-17…BA-31                                                      |
| низкоуровневые операторы `./model`                             | косвенно — обёртки `./behaviors`, BA-14…BA-31; public-api.snapshot · PA-02, PA-03                                                    |
| `./signals`: `computed`                                        | bundle-assembly · BA-12                                                                                                              |
| `./signals`: остальное, `CORE_RUNTIME_TOKEN`                   | public-api.snapshot · PA-06, PA-07, PA-08                                                                                            |

### Сборка и уровень формы (`.`)

| Фича                                                                                             | Сценарий                                                                                                  |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `createForm({ model, schema, behavior, validation, flow })`                                      | bundle-assembly · BA-01; wizard-happy-path · WH-01                                                        |
| ноль предупреждений dev, порядок сборки, `setup`                                                 | bundle-assembly · BA-01, BA-02                                                                            |
| `createForm({ registry, schema: документ })`                                                     | bundle-assembly · BA-03                                                                                   |
| `initial` + `seed`                                                                               | bundle-assembly · BA-02, BA-04; wizard-happy-path · WH-07; reset-and-loading · RL-04, RL-14, RL-15, RL-16 |
| `createFormFromModel` + `createFormLevel`                                                        | bundle-assembly · BA-06, BA-07                                                                            |
| `compileSchema`, `isCompiledNode`, области и `selector`                                          | bundle-assembly · BA-08…BA-12; compiled-schema.snapshot · CS-01, CS-02                                    |
| `schemaSubtree` (одна компиляция строки на под-модель)                                           | bundle-assembly · BA-11; compiled-schema.snapshot · CS-04, CS-05                                          |
| `createSchemaController`, `unknownSchemaSelectors`                                               | косвенно — BA-01 (проверка селекторов молчит), BA-27                                                      |
| `createSchemaScope`, `render.node`: `setHidden`, `resetProps`                                    | react-assembly · RA-12, RA-13, RA-14, RA-15                                                               |
| `render.controller.scopeOf`                                                                      | bundle-assembly · BA-27, BA-28, BA-32; react-assembly · RA-09, RA-15; loan-form.property · LP-03          |
| `getNodeForSignal`, `registerSignalNode` (сборкой)                                               | bundle-assembly · BA-13; reset-and-loading · RL-05; loan-form.property · LP-02                            |
| `isFormNode`, `isFormControl`, `isFormGroup`, `isFormArray`                                      | bundle-assembly · BA-13; wizard-happy-path · WH-03                                                        |
| `validate()`                                                                                     | bundle-assembly · BA-06, BA-42; async-and-races · AR-05, AR-07, AR-11; loan-form.property · LP-02         |
| `validateStep(id)`                                                                               | wizard-happy-path · WH-01…WH-05 (через поток); loan-form.property · LP-01, LP-03                          |
| `submitting`; `validating` во время проверки                                                     | wizard-happy-path · WH-06; async-and-races · AR-01, AR-06; submit-statuses · SS-06, SS-07                 |
| `validation.rules` (вариант без потока), `validation.controller`                                 | bundle-assembly · BA-04; submit-statuses · SS-12, SS-13; live-strategies · LS-01, LS-14, LS-15            |
| типы сборки заявки: ноды, значения, `submit`, шаги, правила и поведение без `any` (compile-time) | `tests/types/loan-fixture.type-test.ts`                                                                   |

### Схема (`FormSchemaNode`)

| Фича                                                             | Сценарий                                           |
| ---------------------------------------------------------------- | -------------------------------------------------- |
| поле (`model`, `component`, `componentProps`)                    | bundle-assembly · BA-09, BA-38                     |
| контейнер, визард, шаги с `selector`                             | bundle-assembly · BA-08                            |
| поле над массивом целиком, поле над листом из `null`             | bundle-assembly · BA-09, BA-13                     |
| `disabled: true` у поля                                          | bundle-assembly · BA-09; wizard-happy-path · WH-07 |
| массив (`item`), `initialValue` у узла массива                   | bundle-assembly · BA-11                            |
| одна подформа (`part`) на две группы; массив внутри подформы     | bundle-assembly · BA-10                            |
| подформа внутри `item`, строка — сама поле, `selector` в строке  | bundle-assembly · BA-11, BA-28                     |
| текст: строка, число, сигнал, `computed`                         | bundle-assembly · BA-12                            |
| дерево заявки целиком: области, индексы, текстовые узлы (снимок) | compiled-schema.snapshot · CS-01                   |

### Ноды

| Фича                                                       | Сценарий                                                                                                                                                                                                  |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `updateComponentProps`, `componentProps`                   | bundle-assembly · BA-24, BA-25                                                                                                                                                                            |
| `disabled` от поведения (поле, группа, строка)             | bundle-assembly · BA-17, BA-18, BA-19, BA-28; conditional-branches · CB-01…CB-04; loan-form.property · LP-03                                                                                              |
| `enable` / `disable` вручную                               | conditional-branches · CB-10…CB-13                                                                                                                                                                        |
| `reset` (через `resetOnDisable`)                           | bundle-assembly · BA-17, BA-18; conditional-branches · CB-01, CB-03; reset-and-loading · RL-15                                                                                                            |
| `reset` формы и поля                                       | reset-and-loading · RL-10, RL-12, RL-14, RL-16, RL-20; loan-form.property · LP-05, LP-06                                                                                                                  |
| `getValue` / `setValue` группы, `markAsUntouched`, `dirty` | reset-and-loading · RL-03, RL-06, RL-07, RL-08                                                                                                                                                            |
| `FormArray`: `push`, `clear`, `at`, `keyAt`, `forEach`     | bundle-assembly · BA-11, BA-13, BA-31; wizard-happy-path · WH-03; arrays-lifecycle · AL-01, AL-06, AL-08, AL-12                                                                                           |
| `FormArray`: `insert`, `move`, `swap`, `map`, `removeAt`   | arrays-lifecycle · AL-01, AL-03, AL-02, AL-06, AL-07; loan-form.property · LP-03                                                                                                                          |
| `dirty` массива (известный дефект `ReFormer-j33t`)         | arrays-lifecycle · AL-15                                                                                                                                                                                  |
| `markAsTouched`, `touched`                                 | bundle-assembly · BA-26; wizard-happy-path · WH-03; live-strategies · LS-04; submit-statuses · SS-11, SS-17                                                                                               |
| `valid`, `issues`, `shouldShowError`, `shouldShowIssues`   | wizard-happy-path · WH-01, WH-02, WH-08, WH-09; bundle-assembly · BA-06; submit-statuses · SS-14, SS-17; live-strategies · LS-02, LS-04; react-assembly · RA-19, RA-20; loan-form.property · LP-02, LP-03 |
| `ownIssues` (замечание на ручке массива)                   | bundle-assembly · BA-43; arrays-lifecycle · AL-13; reset-and-loading · RL-05                                                                                                                              |
| `pending`                                                  | async-and-races · AR-01, AR-06, AR-11, AR-12; submit-statuses · SS-07                                                                                                                                     |
| `setIssues` / `clearIssues` извне                          | submit-statuses · SS-14, SS-15, SS-16, SS-18; reset-and-loading · RL-05; arrays-lifecycle · AL-09                                                                                                         |

### Поведение (`./behaviors`)

| Фича                                                                                 | Сценарий                                                                                                                               |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `defineFormBehavior`, область `{ model, form, schema, flow }`                        | bundle-assembly · BA-02, BA-27, BA-34                                                                                                  |
| `compute`                                                                            | bundle-assembly · BA-14                                                                                                                |
| `compute(…, { when })`                                                               | conditional-branches · CB-06, CB-07                                                                                                    |
| условие на вычисляемом поле (`compute` → `enableWhen` / `hideWhen` / `validateWhen`) | conditional-branches · CB-08, CB-09                                                                                                    |
| `computeFrom`                                                                        | bundle-assembly · BA-15                                                                                                                |
| `enableWhen` со сбросом                                                              | bundle-assembly · BA-17, BA-40; conditional-branches · CB-01, CB-14, CB-15                                                             |
| `enableWhen` группы (корень и строка)                                                | bundle-assembly · BA-19, BA-28; conditional-branches · CB-02, CB-04; arrays-lifecycle · AL-04, AL-05; loan-form.property · LP-03       |
| `disableWhen` со сбросом (в подформе)                                                | bundle-assembly · BA-18; conditional-branches · CB-03, CB-14, CB-15                                                                    |
| `copyFrom` группы с `when`                                                           | bundle-assembly · BA-19, BA-41; conditional-branches · CB-02, CB-14, CB-15                                                             |
| `copyFrom` с `when` и `transform`                                                    | bundle-assembly · BA-20; loan-form.property · LP-02                                                                                    |
| `syncFields` с `transform`                                                           | bundle-assembly · BA-21; reset-and-loading · RL-04, RL-16, RL-19; loan-form.property · LP-02                                           |
| `transformValue` (корень, подформа, строка строки)                                   | bundle-assembly · BA-22; loan-form.property · LP-03                                                                                    |
| `resetWhen`                                                                          | bundle-assembly · BA-23; conditional-branches · CB-14, CB-15                                                                           |
| `onChange` с `immediate`                                                             | bundle-assembly · BA-24                                                                                                                |
| `onChange` с `debounce` и `signal`                                                   | bundle-assembly · BA-25; async-and-races · AR-13, AR-14; arrays-lifecycle · AL-04 (пропсы строки)                                      |
| `onChange` без задержки (очистка массива)                                            | bundle-assembly · BA-31                                                                                                                |
| `revalidateWhen`                                                                     | bundle-assembly · BA-26; live-strategies · LS-10                                                                                       |
| `apply` (две группы, подформа)                                                       | bundle-assembly · BA-22, BA-27                                                                                                         |
| `applyEach` вложенный, снятие поведения удалённой строки                             | bundle-assembly · BA-28, BA-22; arrays-lifecycle · AL-05, AL-07, AL-12; loan-form.property · LP-03                                     |
| `exclusiveFlag`                                                                      | bundle-assembly · BA-29; arrays-lifecycle · AL-05; loan-form.property · LP-03                                                          |
| `aggregateInto`                                                                      | bundle-assembly · BA-30; arrays-lifecycle · AL-02, AL-07, AL-09, AL-10; loan-form.property · LP-03                                     |
| `hideWhen` (корень, строка, подформа)                                                | bundle-assembly · BA-32, BA-27, BA-28; conditional-branches · CB-01…CB-04; arrays-lifecycle · AL-04, AL-12; loan-form.property · LP-03 |
| `onInit` + `patchProps`                                                              | bundle-assembly · BA-33, BA-02                                                                                                         |
| `onComponentEvent`                                                                   | bundle-assembly · BA-34                                                                                                                |
| `renderEffect` + `flow.goTo`                                                         | bundle-assembly · BA-35                                                                                                                |
| `onMount` (с очисткой) / `onUnmount`                                                 | bundle-assembly · BA-36                                                                                                                |
| пользовательский оператор: `getScope`, `effect`, `defer`, `onDispose`                | bundle-assembly · BA-37                                                                                                                |
| `getRef`                                                                             | react-assembly · RA-08, RA-09, RA-21                                                                                                   |

### Валидация (`./validation`)

| Фича                                                                     | Сценарий                                                                                                                         |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `defineValidation`, `validate`, свои коды                                | wizard-happy-path · WH-02; bundle-assembly · BA-42                                                                               |
| `cross` в корне (в том числе в `extras`)                                 | bundle-assembly · BA-06; wizard-happy-path · WH-08, WH-09; loan-form.property · LP-02                                            |
| `cross` в строке, на ручке массива                                       | bundle-assembly · BA-43; arrays-lifecycle · AL-13; loan-form.property · LP-02                                                    |
| `validateWhen`                                                           | wizard-happy-path · WH-03; bundle-assembly · BA-06, BA-43; conditional-branches · CB-01…CB-04, CB-08; loan-form.property · LP-02 |
| `apply(группа, схема)`, в том числе в строке под `validateWhen`          | bundle-assembly · BA-06, BA-42 (`pattern`)                                                                                       |
| `applyEach` (с вложением)                                                | bundle-assembly · BA-06, BA-43; arrays-lifecycle · AL-01…AL-03, AL-13, AL-14; loan-form.property · LP-02                         |
| `apply(...схемы)` — композиция                                           | bundle-assembly · BA-04, BA-42 (`nonZero`); submit-statuses · SS-12, SS-13                                                       |
| `validateAsync` с `signal` (проверка ИНН)                                | wizard-happy-path · WH-01; async-and-races · AR-01, AR-02, AR-03, AR-06                                                          |
| `validateAsync` — отклонение: `ruleFailed`, `failures`, `error`          | async-and-races · AR-04, AR-05; submit-statuses · SS-04                                                                          |
| устаревший прогон — `cancelled`                                          | async-and-races · AR-06, AR-07, AR-09, AR-10; submit-statuses · SS-05, SS-10; live-strategies · LS-03                            |
| async-правило в строке массива; строка удалена во время проверки         | async-and-races · AR-11, AR-12                                                                                                   |
| `extras` (межшаговые правила)                                            | wizard-happy-path · WH-07, WH-08, WH-09; bundle-assembly · BA-06                                                                 |
| `severity: 'warning'`                                                    | wizard-happy-path · WH-09; react-assembly · RA-19, RA-20                                                                         |
| `params` замечания `cross` и `params` правила (`RuleOptions`)            | wizard-happy-path · WH-08, WH-09; bundle-assembly · BA-06                                                                        |
| выключенные поля в проверке формы                                        | wizard-happy-path · WH-07; conditional-branches · CB-05, CB-10, CB-11, CB-13                                                     |
| `runValidation`                                                          | wizard-happy-path · WH-07, WH-08                                                                                                 |
| `validateModel`                                                          | bundle-assembly · BA-26                                                                                                          |
| `applyValidationResult`                                                  | submit-statuses · SS-17                                                                                                          |
| `createFormValidation`, стратегии `blur` / `change` / `afterFirstSubmit` | live-strategies · LS-01…LS-15; submit-statuses · SS-08, SS-10, SS-15                                                             |

### Валидаторы (`./validators`)

| Фича                                                                                                                 | Сценарий                                                        |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| верная заявка проходит все правила шагов и `extras` (ветки за `validateWhen` — по условию)                           | wizard-happy-path · WH-01, WH-06; loan-form.property · LP-01    |
| каждое из 27 срабатывает на своём поле (`required` … `maxTotalFileSize`); таблица сверена со списком экспортов входа | bundle-assembly · BA-42                                         |
| границы и краевые значения правил                                                                                    | юнит-тесты `tests/core/validators/`; loan-form.property · LP-02 |

### Поток шагов

| Фича                                                         | Сценарий                                              |
| ------------------------------------------------------------ | ----------------------------------------------------- |
| `flow: { steps }`, `id` = `selector` узла шага               | wizard-happy-path · WH-01; bundle-assembly · BA-08    |
| `next`, `completed`, `index`, `isFirst`, `isLast`            | wizard-happy-path · WH-01; loan-form.property · LP-01 |
| причина `invalid`                                            | wizard-happy-path · WH-02                             |
| причины `locked`, `edge`; шаг без правил (`rules: null`)     | wizard-happy-path · WH-04                             |
| `canGoTo`, `goTo` назад, `previous`                          | wizard-happy-path · WH-04, WH-05                      |
| `flow.goTo` из поведения                                     | bundle-assembly · BA-34, BA-35                        |
| поток `createFormLevel`                                      | bundle-assembly · BA-07                               |
| причины `error`, `cancelled`; `validating` во время проверки | async-and-races · AR-01, AR-04, AR-06, AR-08          |
| `reset`                                                      | reset-and-loading · RL-17, RL-18                      |

### Отправка

| Фича                                                         | Сценарий                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `submitted` со значениями `model.get()`                      | wizard-happy-path · WH-06; submit-statuses · SS-01; loan-form.property · LP-01 |
| `invalid` по полю шага; повторная отправка после исправления | submit-statuses · SS-02                                                        |
| `invalid` по правилу `extras`                                | wizard-happy-path · WH-08; submit-statuses · SS-03                             |
| предупреждение не держит отправку                            | wizard-happy-path · WH-09                                                      |
| выключенное поле не мешает отправке                          | wizard-happy-path · WH-07                                                      |
| `error`, `cancelled`, `failed`; серверные `setIssues`        | submit-statuses · SS-04, SS-05, SS-06, SS-14…SS-18                             |
| один прогон правил на отправку, и при живой стратегии        | submit-statuses · SS-01, SS-08                                                 |
| `validating` против `submitting`                             | submit-statuses · SS-07                                                        |
| правка формы, пока отправка ждёт проверку                    | submit-statuses · SS-09, SS-10, SS-11                                          |
| одностраничный вариант `rules: 'all'`                        | submit-statuses · SS-12, SS-13                                                 |

### Локализация (`./i18n`, `./locale`)

| Фича                                                                           | Сценарий                                                                                     |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `defineIssueMessages`: `plural`, `select`, функции, свои коды                  | bundle-assembly · BA-05 (разбор); i18n-messages · IM-04, IM-07…IM-10; react-assembly · RA-18 |
| `extendLocale` ru / en, `validateLocale`, `parseMessage`                       | bundle-assembly · BA-05; i18n-messages · IM-03, IM-16, IM-18                                 |
| `resolveIssueMessage`, `createI18n`, `formatPattern`, `createMessageFormatter` | i18n-messages · IM-01…IM-06, IM-11…IM-18                                                     |
| текст каждого замечания правил шагов на ru и en, без возврата к коду           | i18n-messages · IM-01, IM-02                                                                 |
| `createLocaleLoader`, `fetchMessages`, `createLocaleStore`, `loadCoreLocale`   | i18n-messages · IM-19, IM-20; react-assembly · RA-17                                         |
| `msg`, `defineMessages`, `resolveLocalized`                                    | i18n-messages · IM-21, IM-22, IM-23; react-assembly · RA-16                                  |

### React (`./react`)

| Фича                                                                          | Сценарий                                           |
| ----------------------------------------------------------------------------- | -------------------------------------------------- |
| `useFormBundle`, `FormBundleContext`, `useFormControl`, `useFormControlValue` | react-assembly · RA-01, RA-02, RA-03, RA-11        |
| `useArrayLength`, `useFormFlow`, `useFormValidation`                          | react-assembly · RA-04, RA-06, RA-07, RA-10        |
| `getFieldAdapter`, `makeElementFieldHandle`, `useFieldHandleRef`, `getRef`    | react-assembly · RA-03, RA-04, RA-08, RA-09        |
| `I18nProvider`, `useI18n`, `useMessages`, `useIssueMessage`                   | react-assembly · RA-16, RA-17, RA-18               |
| точечные ререндеры (счётчики), размонтирование                                | react-assembly · RA-03, RA-04, RA-05, RA-21, RA-22 |

### Публичные входы

| Фича                                                                              | Сценарий                           |
| --------------------------------------------------------------------------------- | ---------------------------------- |
| состав и вид экспортов каждого входа сабпата; каждый ключ `exports` пакета описан | public-api.snapshot · PA-01, PA-02 |
| имена, общие для нескольких входов, — одно значение или разные                    | public-api.snapshot · PA-03        |
| входы без React: загрузка при недоступном React, обход импортов                   | public-api.snapshot · PA-04, PA-05 |

### Снятие и утечки

| Фича                                                                          | Сценарий                         |
| ----------------------------------------------------------------------------- | -------------------------------- |
| снятие сборки: `disposeForm(form)` + `validation.controller.dispose()`        | dispose-and-leaks · DL-01, DL-04 |
| строки массивов, вложенные массивы и подформы в строках                       | dispose-and-leaks · DL-02, DL-03 |
| таймеры `debounce` (города, живая проверка) при снятии                        | dispose-and-leaks · DL-05, DL-19 |
| `AbortSignal` идущих запросов при снятии                                      | dispose-and-leaks · DL-06, DL-07 |
| жизненный цикл узлов: монтирование → размонтирование → снятие                 | dispose-and-leaks · DL-08        |
| отложенные записи операторов в тике снятия                                    | dispose-and-leaks · DL-09…DL-25  |
| хранилища областей схемы после снятия (корень, подформа, строка)              | dispose-and-leaks · DL-26        |
| признаки derived после снятия                                                 | dispose-and-leaks · DL-27        |
| перемонтирование над той же моделью                                           | dispose-and-leaks · DL-29        |
| записи в модель после снятия: `compute`, `onChange`, пропсы, сервер, проверка | dispose-and-leaks · DL-30, DL-31 |
| 50 циклов «собрать → заполнить → проверить → снять»                           | dispose-and-leaks · DL-32        |
| сборщик мусора: удалённая строка, снятая сборка                               | dispose-and-leaks · DL-33, DL-34 |

## Найденные дефекты

Исправлены — тесты закрепляют исправленное поведение:

| Задача          | Тест                                                                       | Суть                                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ReFormer-qesu` | bundle-assembly · BA-40                                                    | `enableWhen` со сбросом выполнял решение, принятое при планировании: загрузка в том же тике после сборки теряла данные                                                |
| `ReFormer-h4d6` | bundle-assembly · BA-41                                                    | `copyFrom` группы писал снимок источника, снятый при прогоне, и не перепроверял `when`                                                                                |
| `ReFormer-kowh` | conditional-branches · CB-13                                               | проверка формы считала поле, включённое поведением внутри выключенной группы, а `form.valid` — нет                                                                    |
| `ReFormer-y66c` | async-and-races · AR-13                                                    | `onChange` с `debounce` отменял прежний запрос через задержку, а не при смене значения: устаревший ответ применялся                                                   |
| `ReFormer-t6qm` | live-strategies · LS-05, LS-09                                             | стратегия `blur` видела только первый уход из поля; после отказа шага или отправки живой проверки по уходу не было                                                    |
| `ReFormer-fnzr` | i18n-messages · IM-14                                                      | перечень в параметрах замечания по-русски выводился без запятых                                                                                                       |
| `ReFormer-4xy9` | dispose-and-leaks · DL-07                                                  | `controller.dispose()` не отменял идущий живой прогон: ответ async-правила ложился на ноды снятой формы                                                               |
| `ReFormer-68sy` | dispose-and-leaks · DL-33                                                  | формы строк вложенного массива удалённой строки жили до следующего изменения внешнего массива                                                                         |
| `ReFormer-e9rw` | reset-and-loading · RL-11, RL-12, RL-13; loan-form.property · LP-05, LP-06 | сброс обнулял цель `compute`, а свежая форма была dirty: производные поля участвовали в снимке модели и в значениях создания нод                                      |
| `ReFormer-xt4x` | submit-statuses · SS-09; form-level                                        | правка поля во время проверки отправки уходила обработчику непроверенной — теперь отправка отменяется (cancelled)                                                     |
| `ReFormer-dp34` | react-assembly · RA-20; form-control-should-show-issues                    | предупреждение на поле без ошибок не показывалось: показ текста решал shouldShowError, истинный только у невалидного поля — теперь тексты показывает shouldShowIssues |
| `ReFormer-jvst` | form-level; async-and-races · AR-05, AR-10                                 | проверка в одном тике с правкой читала модель до отложенных записей поведения: правила видели прежние значения — теперь проверка формы дожидается этих записей        |

Открыты — закреплены `it.fails`, тест покраснеет после исправления:

| Задача          | Тест                     | Суть                                   |
| --------------- | ------------------------ | -------------------------------------- |
| `ReFormer-j33t` | arrays-lifecycle · AL-15 | удаление строки не делает массив dirty |

Поведение под вопросом — закреплено как есть, с комментарием в тесте и задачей на решение:

| Задача             | Тесты                                                                                                 | О чём                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `ReFormer-k152.14` | reset-and-loading · RL-09, RL-10, RL-14, RL-15, RL-16                                                 | два сброса с разными исходными значениями: `model.reset()` не трогает ноды, `form.reset()` возвращает значения создания нод      |
| `ReFormer-jefl`    | async-and-races · AR-10, AR-12; submit-statuses · SS-11, SS-18; live-strategies · LS-07, LS-12, LS-17 | прогоны разных схем друг друга не отменяют; замечание сервера на группе; живая фаза после проверки шага; `blur` и состав массива |
| `ReFormer-04vp`    | conditional-branches · CB-12                                                                          | поведение включает поле внутри выключенной вручную группы                                                                        |
| `ReFormer-nm2x`    | conditional-branches · CB-07                                                                          | `compute` без `when` заполняет выключенное поле                                                                                  |
| `ReFormer-0f7y`    | react-assembly · RA-02, RA-05                                                                         | StrictMode зовёт фабрику дважды; повторная проверка без правок перерисовывает поля с замечаниями                                 |
| `ReFormer-arpz`    | react-assembly · RA-13                                                                                | `setHidden(true)` прячет узел, но поля не выключает                                                                              |
| `ReFormer-y5g8`    | wizard-happy-path · WH-03                                                                             | проверка шага метит `touched` выключенные поля и ветки `validateWhen`                                                            |

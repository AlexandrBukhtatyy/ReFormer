# Сквозные сценарии ядра: заявка на кредит

Каталог проверяет взаимодействие всех модулей и фич `@reformer/core` на одной синтетической
«сложной форме» — заявке на кредит. Это этап 10 плана `docs/plans/core-tests-coverage.md`; юнит-тесты
модулей лежат в соседних каталогах `tests/`, здесь — только то, что видно, когда модули работают
вместе.

## Фикстура `fixtures/loan-application/`

Обычный код, не тест: импорты ядра — только из входов сабпатов (`src/index.ts`, `./model`,
`./behaviors`, `./validation`, `./validators`, `./i18n`, `./signals`, `./locale/*`), UI — заглушки.
Barrel нет: сценарии импортируют модули явно. Экспортировано то, чем пользуются сценарии (`knip`);
новому сценарию нужное — откройте экспорт.

| Модуль                | Что даёт                                                                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model.ts`            | `LoanApplication`, начальные значения (`createLoanInitial`), модель (`createLoanModel`), поле сервера с явным `markDerived` (`markServerOwned`), пределы суммы                |
| `api.ts`              | `createLoanServer` — управляемые заглушки: проверка ИНН, города региона, отправка, черновик; журнал вызовов, ручные ответы (`manual`), отмена по `AbortSignal`                |
| `components.ts`       | заглушки компонентов с `displayName`                                                                                                                                          |
| `schema.ts`           | `loanSchema` — визард из 7 шагов, подформы, строки, текстовые дети, `disabled`, `initialValue`                                                                                |
| `behavior.ts`         | `createLoanBehavior` — все операторы `./behaviors` и пользовательский оператор                                                                                                |
| `validation.ts`       | `createLoanRules` — правила шагов, межшаговые `extras`, полный набор `apply(...схемы)`; все 27 правил `./validators`                                                          |
| `flow.ts`             | `LOAN_STEPS`, `createLoanFlow` — шаги с правилами и шаг проверки без правил                                                                                                   |
| `messages.ts`         | словарь формы (`plural`, `select`, функции, свои коды) и локали `loanRu` / `loanEn` (`extendLocale`)                                                                          |
| `create-loan-form.ts` | `createLoanForm(options)` — сборка `createForm`; опции `strategy`, `debounce`, `liveAfterSubmit`, `server`, `initial` + `seed`, `rules: 'all'`; отдаёт бандл, сервер, правила |
| `actions.ts`          | заполнение шагов верными данными, `addCoBorrower`, `passWizardTo`, файлы и даты относительно «сегодня»                                                                        |

Шаги: `loan` → `applicant` → `contacts` → `employment` → `co-borrowers` → `documents` → `review`.

Отложенные записи поведения (`enableWhen`, `copyFrom` группы, `syncFields`, …) идут на микротасках
и читают состояние в момент записи: загрузка в том же тике, что и сборка, сохраняется (BA-40,
BA-41). Проверять результат — после `await settle()` (или `flushBehaviors()` под фейковыми часами).

## Сценарии

| Файл                               | Этап | ID    | О чём                                                                               |
| ---------------------------------- | ---- | ----- | ----------------------------------------------------------------------------------- |
| `bundle-assembly.test.ts`          | 10a  | `BA-` | сборка, паритет ручной сборки, компиляция, гарды, каждый оператор и каждое правило  |
| `wizard-happy-path.test.ts`        | 10a  | `WH-` | проход визарда, `touched` шага, `locked`/`edge`, `canGoTo`, отправка, `extras`      |
| `conditional-branches.test.ts`     | план |       | условные ветки: доступность, видимость, `validateWhen`                              |
| `arrays-lifecycle.test.ts`         | план |       | `removeAt`/`move`/`swap` при замечаниях, `keyAt`, `patch` массива с сервера         |
| `async-and-races.test.ts`          | план |       | `pending`, `error`/`ruleFailed`, `cancelled`, удаление строки во время async        |
| `live-strategies.test.ts`          | план |       | `change` + `debounce`, `blur`, `afterFirstSubmit` + `liveAfterSubmit`               |
| `reset-and-loading.test.ts`        | план |       | `patch` + `captureInitial`, `isDirty`, `model.reset` против `form.reset`, `initial` |
| `submit-statuses.test.ts`          | план |       | все 5 статусов отправки, `extras`, `rules`, серверные `setIssues`                   |
| `i18n-messages.test.ts`            | план |       | `plural` 1/2/5/21, `select`, загрузчики, `msg`/`resolveLocalized`, `createI18n`     |
| `react-assembly.dom.test.tsx`      | план |       | happy-dom: фабрика один раз, точечные ререндеры, фокус ошибки, StrictMode, язык     |
| `compiled-schema.snapshot.test.ts` | план |       | снимок скомпилированной схемы заявки и снимок имён экспортов (`public-api`)         |
| `loan-form.property.test.ts`       | план |       | свойства формы на случайных данных                                                  |
| `dispose-and-leaks.test.ts`        | 11   |       | dispose, живые effect'ы, таймеры, отложенные записи                                 |

## Матрица «фича → сценарий»

Ссылка — `файл · ID` (файлы без `.test.ts`); «план: <файл>» — сценарий будущего этапа;
«косвенно» — фича работает внутри другой проверки, отдельного утверждения нет.

### Модель (`.`, `./model`, `./signals`)

| Фича                                                           | Сценарий                                                                |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `createModel`, вложенные группы, `model.get()`                 | bundle-assembly · BA-06; wizard-happy-path · WH-06                      |
| `arrayOf` — «Добавить» без значения, вложенный шаблон в строке | bundle-assembly · BA-11                                                 |
| группа и массив в строке массива                               | bundle-assembly · BA-11, BA-22                                          |
| `patch` (загрузка; производные поля не затираются)             | bundle-assembly · BA-14, BA-16, BA-39                                   |
| `captureInitial`, `set`, `reset`, `isDirty`, `signalAt`        | план: reset-and-loading                                                 |
| `ModelArray`: `push`, `at`, `toArray`, `removeAt`, `clear`     | bundle-assembly · BA-11, BA-28, BA-43                                   |
| `ModelArray`: `insertAt`, `move`, `swap`                       | план: arrays-lifecycle                                                  |
| `modelOf`                                                      | косвенно (`apply` / `applyEach`) — BA-27, BA-28; план: arrays-lifecycle |
| `eachLeafSignal`, `eachValueSignal`                            | план: live-strategies                                                   |
| `isModelContainerSignal`, `isValueSignal`                      | косвенно (вид привязки) — BA-09; план: compiled-schema.snapshot         |
| `markDerived` явно, `isDerived`                                | bundle-assembly · BA-16, BA-04, BA-15                                   |
| `unmarkDerived`                                                | план: dispose-and-leaks                                                 |
| `runOutsideEffect`, `safeCallback`, `safeDebouncedCallback`    | косвенно — отложенные записи BA-17…BA-31; план: async-and-races         |
| низкоуровневые операторы `./model`                             | косвенно — обёртки `./behaviors`, BA-14…BA-31                           |
| `./signals`: `computed`                                        | bundle-assembly · BA-12                                                 |
| `./signals`: остальное, `CORE_RUNTIME_TOKEN`                   | план: compiled-schema.snapshot (`public-api`)                           |

### Сборка и уровень формы (`.`)

| Фича                                                             | Сценарий                                                                           |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `createForm({ model, schema, behavior, validation, flow })`      | bundle-assembly · BA-01; wizard-happy-path · WH-01                                 |
| ноль предупреждений dev, порядок сборки, `setup`                 | bundle-assembly · BA-01, BA-02                                                     |
| `createForm({ registry, schema: документ })`                     | bundle-assembly · BA-03                                                            |
| `initial` + `seed`                                               | bundle-assembly · BA-02, BA-04; wizard-happy-path · WH-07; план: reset-and-loading |
| `createFormFromModel` + `createFormLevel`                        | bundle-assembly · BA-06, BA-07                                                     |
| `compileSchema`, `isCompiledNode`, области и `selector`          | bundle-assembly · BA-08…BA-12                                                      |
| `schemaSubtree` (одна компиляция строки на под-модель)           | bundle-assembly · BA-11; план: compiled-schema.snapshot                            |
| `createSchemaController`, `unknownSchemaSelectors`               | косвенно — BA-01 (проверка селекторов молчит), BA-27                               |
| `createSchemaScope`, `render.node`: `setHidden`, `resetProps`    | план: react-assembly                                                               |
| `render.controller.scopeOf`                                      | bundle-assembly · BA-27, BA-28, BA-32                                              |
| `getNodeForSignal`, `registerSignalNode` (сборкой)               | bundle-assembly · BA-13                                                            |
| `isFormNode`, `isFormControl`, `isFormGroup`, `isFormArray`      | bundle-assembly · BA-13; wizard-happy-path · WH-03                                 |
| `validate()`                                                     | bundle-assembly · BA-06, BA-42                                                     |
| `validateStep(id)` (через поток)                                 | wizard-happy-path · WH-01…WH-05                                                    |
| `submitting`; `validating` во время проверки                     | wizard-happy-path · WH-06; план: async-and-races                                   |
| `validation.rules` (вариант без потока), `validation.controller` | bundle-assembly · BA-04; план: submit-statuses, live-strategies                    |

### Схема (`FormSchemaNode`)

| Фича                                                            | Сценарий                                           |
| --------------------------------------------------------------- | -------------------------------------------------- |
| поле (`model`, `component`, `componentProps`)                   | bundle-assembly · BA-09, BA-38                     |
| контейнер, визард, шаги с `selector`                            | bundle-assembly · BA-08                            |
| поле над массивом целиком, поле над листом из `null`            | bundle-assembly · BA-09, BA-13                     |
| `disabled: true` у поля                                         | bundle-assembly · BA-09; wizard-happy-path · WH-07 |
| массив (`item`), `initialValue` у узла массива                  | bundle-assembly · BA-11                            |
| одна подформа (`part`) на две группы; массив внутри подформы    | bundle-assembly · BA-10                            |
| подформа внутри `item`, строка — сама поле, `selector` в строке | bundle-assembly · BA-11, BA-28                     |
| текст: строка, число, сигнал, `computed`                        | bundle-assembly · BA-12                            |

### Ноды

| Фича                                                       | Сценарий                                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| `updateComponentProps`, `componentProps`                   | bundle-assembly · BA-24, BA-25                                          |
| `disabled` от поведения (поле, группа, строка)             | bundle-assembly · BA-17, BA-18, BA-19, BA-28                            |
| `enable` / `disable` вручную                               | план: conditional-branches                                              |
| `reset` (через `resetOnDisable`)                           | bundle-assembly · BA-17, BA-18; план: reset-and-loading                 |
| `getValue` / `setValue` группы, `markAsUntouched`, `dirty` | план: reset-and-loading                                                 |
| `FormArray`: `push`, `clear`, `at`, `keyAt`, `forEach`     | bundle-assembly · BA-11, BA-13, BA-31; wizard-happy-path · WH-03        |
| `FormArray`: `insert`, `move`, `swap`, `map`, `removeAt`   | план: arrays-lifecycle                                                  |
| `markAsTouched`, `touched`                                 | bundle-assembly · BA-26; wizard-happy-path · WH-03                      |
| `valid`, `issues`, `shouldShowError`                       | wizard-happy-path · WH-01, WH-02, WH-08, WH-09; bundle-assembly · BA-06 |
| `ownIssues` (замечание на ручке массива)                   | bundle-assembly · BA-43                                                 |
| `pending`                                                  | план: async-and-races                                                   |
| `setIssues` / `clearIssues` извне                          | план: submit-statuses                                                   |

### Поведение (`./behaviors`)

| Фича                                                                  | Сценарий                              |
| --------------------------------------------------------------------- | ------------------------------------- |
| `defineFormBehavior`, область `{ model, form, schema, flow }`         | bundle-assembly · BA-02, BA-27, BA-34 |
| `compute`                                                             | bundle-assembly · BA-14               |
| `compute(…, { when })`                                                | план: conditional-branches            |
| `computeFrom`                                                         | bundle-assembly · BA-15               |
| `enableWhen` со сбросом                                               | bundle-assembly · BA-17, BA-40        |
| `enableWhen` группы (корень и строка)                                 | bundle-assembly · BA-19, BA-28        |
| `disableWhen` со сбросом (в подформе)                                 | bundle-assembly · BA-18               |
| `copyFrom` группы с `when`                                            | bundle-assembly · BA-19, BA-41        |
| `copyFrom` с `when` и `transform`                                     | bundle-assembly · BA-20               |
| `syncFields` с `transform`                                            | bundle-assembly · BA-21               |
| `transformValue` (корень, подформа, строка строки)                    | bundle-assembly · BA-22               |
| `resetWhen`                                                           | bundle-assembly · BA-23               |
| `onChange` с `immediate`                                              | bundle-assembly · BA-24               |
| `onChange` с `debounce` и `signal`                                    | bundle-assembly · BA-25               |
| `onChange` без задержки (очистка массива)                             | bundle-assembly · BA-31               |
| `revalidateWhen`                                                      | bundle-assembly · BA-26               |
| `apply` (две группы, подформа)                                        | bundle-assembly · BA-22, BA-27        |
| `applyEach` вложенный, снятие поведения удалённой строки              | bundle-assembly · BA-28, BA-22        |
| `exclusiveFlag`                                                       | bundle-assembly · BA-29               |
| `aggregateInto`                                                       | bundle-assembly · BA-30               |
| `hideWhen` (корень, строка, подформа)                                 | bundle-assembly · BA-32, BA-27, BA-28 |
| `onInit` + `patchProps`                                               | bundle-assembly · BA-33, BA-02        |
| `onComponentEvent`                                                    | bundle-assembly · BA-34               |
| `renderEffect` + `flow.goTo`                                          | bundle-assembly · BA-35               |
| `onMount` (с очисткой) / `onUnmount`                                  | bundle-assembly · BA-36               |
| пользовательский оператор: `getScope`, `effect`, `defer`, `onDispose` | bundle-assembly · BA-37               |
| `getRef`                                                              | план: react-assembly                  |

### Валидация (`./validation`)

| Фича                                                                     | Сценарий                                                          |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `defineValidation`, `validate`, свои коды                                | wizard-happy-path · WH-02; bundle-assembly · BA-42                |
| `cross` в корне (в том числе в `extras`)                                 | bundle-assembly · BA-06; wizard-happy-path · WH-08, WH-09         |
| `cross` в строке, на ручке массива                                       | bundle-assembly · BA-43                                           |
| `validateWhen`                                                           | wizard-happy-path · WH-03; bundle-assembly · BA-06, BA-43         |
| `apply(группа, схема)`, в том числе в строке под `validateWhen`          | bundle-assembly · BA-06, BA-42 (`pattern`)                        |
| `applyEach` (с вложением)                                                | bundle-assembly · BA-06, BA-43                                    |
| `apply(...схемы)` — композиция                                           | bundle-assembly · BA-04, BA-42 (`nonZero`); план: submit-statuses |
| `validateAsync` с `signal` (проверка ИНН)                                | wizard-happy-path · WH-01                                         |
| `validateAsync` — отклонение: `ruleFailed`, `failures`, `error`          | план: async-and-races                                             |
| устаревший прогон — `cancelled`                                          | план: async-and-races                                             |
| `extras` (межшаговые правила)                                            | wizard-happy-path · WH-07, WH-08, WH-09; bundle-assembly · BA-06  |
| `severity: 'warning'`                                                    | wizard-happy-path · WH-09                                         |
| `params` замечания `cross` и `params` правила (`RuleOptions`)            | wizard-happy-path · WH-08, WH-09; bundle-assembly · BA-06         |
| выключенные поля в проверке формы                                        | wizard-happy-path · WH-07                                         |
| `runValidation`                                                          | wizard-happy-path · WH-07, WH-08                                  |
| `validateModel`                                                          | bundle-assembly · BA-26                                           |
| `applyValidationResult`                                                  | план: submit-statuses                                             |
| `createFormValidation`, стратегии `blur` / `change` / `afterFirstSubmit` | план: live-strategies                                             |

### Валидаторы (`./validators`)

| Фича                                                                                                                 | Сценарий                                                      |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| верная заявка проходит все правила шагов и `extras` (ветки за `validateWhen` — по условию)                           | wizard-happy-path · WH-01, WH-06                              |
| каждое из 27 срабатывает на своём поле (`required` … `maxTotalFileSize`); таблица сверена со списком экспортов входа | bundle-assembly · BA-42                                       |
| границы и краевые значения правил                                                                                    | юнит-тесты `tests/core/validators/`; план: loan-form.property |

### Поток шагов

| Фича                                                         | Сценарий                                           |
| ------------------------------------------------------------ | -------------------------------------------------- |
| `flow: { steps }`, `id` = `selector` узла шага               | wizard-happy-path · WH-01; bundle-assembly · BA-08 |
| `next`, `completed`, `index`, `isFirst`, `isLast`            | wizard-happy-path · WH-01                          |
| причина `invalid`                                            | wizard-happy-path · WH-02                          |
| причины `locked`, `edge`; шаг без правил (`rules: null`)     | wizard-happy-path · WH-04                          |
| `canGoTo`, `goTo` назад, `previous`                          | wizard-happy-path · WH-04, WH-05                   |
| `flow.goTo` из поведения                                     | bundle-assembly · BA-34, BA-35                     |
| поток `createFormLevel`                                      | bundle-assembly · BA-07                            |
| причины `error`, `cancelled`; `validating` во время проверки | план: async-and-races                              |
| `reset`                                                      | план: reset-and-loading                            |

### Отправка

| Фича                                                  | Сценарий                  |
| ----------------------------------------------------- | ------------------------- |
| `submitted` со значениями `model.get()`               | wizard-happy-path · WH-06 |
| `invalid` по правилу `extras`                         | wizard-happy-path · WH-08 |
| предупреждение не держит отправку                     | wizard-happy-path · WH-09 |
| выключенное поле не мешает отправке                   | wizard-happy-path · WH-07 |
| `error`, `cancelled`, `failed`; серверные `setIssues` | план: submit-statuses     |

### Локализация (`./i18n`, `./locale`)

| Фича                                                                           | Сценарий                                              |
| ------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `defineIssueMessages`: `plural`, `select`, функции, свои коды                  | bundle-assembly · BA-05 (разбор); план: i18n-messages |
| `extendLocale` ru / en, `validateLocale`, `parseMessage`                       | bundle-assembly · BA-05                               |
| `resolveIssueMessage`, `createI18n`, `formatPattern`, `createMessageFormatter` | план: i18n-messages                                   |
| `createLocaleLoader`, `fetchMessages`, `createLocaleStore`, `loadCoreLocale`   | план: i18n-messages                                   |
| `msg`, `defineMessages`, `resolveLocalized`                                    | план: i18n-messages                                   |

### React (`./react`)

| Фича                                                                          | Сценарий             |
| ----------------------------------------------------------------------------- | -------------------- |
| `useFormBundle`, `FormBundleContext`, `useFormControl`, `useFormControlValue` | план: react-assembly |
| `useArrayLength`, `useFormFlow`, `useFormValidation`                          | план: react-assembly |
| `getFieldAdapter`, `makeElementFieldHandle`, `useFieldHandleRef`, `getRef`    | план: react-assembly |
| `I18nProvider`, `useI18n`, `useMessages`, `useIssueMessage`                   | план: react-assembly |

## Найденные дефекты

Оба исправлены; тесты закрепляют исправленное поведение.

| Задача          | Тест                    | Суть                                                                                                                   |
| --------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `ReFormer-qesu` | bundle-assembly · BA-40 | `enableWhen` со сбросом выполнял решение, принятое при планировании: загрузка в том же тике после сборки теряла данные |
| `ReFormer-h4d6` | bundle-assembly · BA-41 | `copyFrom` группы писал снимок источника, снятый при прогоне, и не перепроверял `when`                                 |

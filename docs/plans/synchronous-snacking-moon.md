# Единый контракт авторинга формы: контракт и план реализации

## Context

Одна и та же форма сегодня описывается по-разному для трёх способов реализации — React-руками,
`renderer-react`, `renderer-json`. У способов разные схемы, три фабрики сборки и два вида
поведения, а визард в renderer-вариантах держится на прикладном shim. Эталонная кредитная заявка
занимает ≈ 5 940 строк на три варианта, и её копии уже разошлись.

Цель — один лаконичный контракт: одна схема-дерево, одна ручка привязки, одна сборка, одно
поведение, одинаковая запись в TS и JSON. Требования — декомпозиция и переиспользование, все три
способа и разные UI-kit, меньше бойлерплейта.

Контракт согласован по шагам: итог — в следующем разделе, журнал шагов — в приложении. Основная
часть документа — план реализации: что меняется в пакетах, MCP, конструкторе, примерах и
документации.

Эталонная форма, целиком переписанная под контракт, — в отдельном документе:
[unified-contract-example.md](unified-contract-example.md).

Эталон — кредитная заявка:
[complex-multy-step-form](../../projects/react-playground/src/pages/demo/complex-multy-step-form),
[-renderer](../../projects/react-playground/src/pages/demo/complex-multy-step-form-renderer),
[-renderer-json](../../projects/react-playground/src/pages/demo/complex-multy-step-form-renderer-json).

## Итог контракта

```ts
// model.ts — начальные значения и шаблоны новых элементов массивов
export const createCreditApplicationModel = () =>
  createModel<CreditApplicationForm>({
    loanType: 'consumer',
    registrationAddress: blankAddress(),
    properties: arrayOf(blankProperty), // пустой массив + шаблон для «Добавить»
  });

// form.schema.ts — одна схема на все способы
export const creditSchema = (model: FormModel<CreditApplicationForm>) => ({
  selector: 'wizard',
  component: FormWizard,
  children: [
    {
      selector: 'loan', // ключ в validation.steps
      component: Step,
      componentProps: { title: 'Кредит', icon: '💰' },
      children: [
        { model: model.$.loanType, component: SelectAsync, componentProps: { label: 'Тип' } }, // поле
        { model: model.$.registrationAddress, part: address }, // подформа
        { model: model.$.properties, component: FormArray, item: property }, // массив под-форм
      ],
    },
  ],
});

// form.validation.ts
const loanRules = defineValidationSchema<CreditApplicationForm>(({ model }) => {
  validate(model.$.loanType, [required()]);
  apply(model.$.registrationAddress, addressRules);
  applyEach(model.$.properties, propertyRules);
});
export const creditValidation: FormValidation<CreditApplicationForm> = {
  steps: { loan: loanRules }, // ключ шага = selector
  extras: crossStepRules,
};

// form.behavior.ts — единственное поведение
export const creditBehavior = defineFormBehavior<CreditApplicationForm>(
  ({ model, form, schema }) => {
    enableWhen(model.$.propertyValue, isMortgage, { resetOnDisable: true });
    hideWhen(schema.node('mortgage'), () => !isMortgage());
    apply(model.$.registrationAddress, addressBehavior);
    applyEach(model.$.properties, propertyBehavior);
  }
);
```

```tsx
// одна сборка, один хук, один рендерер
const credit = useFormBundle(() =>
  createForm<CreditApplicationForm>({
    model: createCreditApplicationModel(),
    schema: creditSchema, // JSON: schema: creditJson, registry
    behavior: creditBehavior,
    validation: creditValidation,
  })
);

<FormRenderer form={credit} settings={{ fieldWrapper: FormField }} /> // renderer
<FormRenderer form={credit} /> // JSON: обёртка поля — из реестра
<FormField control={credit.form.loanType} /> // React-руками
```

| Слой | поле | массив | подформа |
| --- | --- | --- | --- |
| схема | `{ model: model.$.x, component }` | `{ model: model.$.items, item }` | `{ model: model.$.group, part }` |
| валидация | `validate(model.$.x, rules)` | `applyEach(model.$.items, itemRules)` | `apply(model.$.group, groupRules)` |
| поведение | `compute(model.$.x, …)` | `applyEach(model.$.items, itemBehavior)` | `apply(model.$.group, groupBehavior)` |

## План реализации

План прошёл независимую проверку по коду отдельным агентом. Решения 1–5 подтверждены как
выполнимые. Найдены два блокера и ряд пробелов; все учтены в тексте ниже, сводка — в разделе
«Что изменила независимая проверка».

### Принципы

- **Расширить → перевести → убрать.** Новый контракт появляется рядом со старым, потребители
  переводятся по одному, старое удаляется в конце.
- **Исключение — имя `createForm`.** Старая и новая функции не могут жить под одним именем: вызов
  `createForm({ model })` подходит под обе сигнатуры, а возвращают они разное. Смысл имени меняется
  сразу, на этапе 2, вместе с codemod по всему монорепозиторию.
- **Отдельная ветка от `develop`.** Каждый push в `develop` публикует бета-версии пакетов и
  выкатывает сайт документации и конструктор ([release.yml](../../.github/workflows/release.yml),
  [deploy-docs.yml](../../.github/workflows/deploy-docs.yml)). Промежуточное состояние дало бы на npm
  новое ядро со старыми рендерерами и документацию, которая описывает `createForm` неверно. Ветка
  вливается в `develop` целиком после этапа 11.
- **Внутри ветки после каждого этапа** пакеты собираются, их тесты зелёные. Гейты, которым нужно
  несколько этапов сразу, названы в разделе «Проверка».
- **Границы пакетов прежние.** Ядро не зависит от рендереров, `cdk` и `ui-kit` — от рендерера;
  JSON разбирает только `renderer-json`.
- **Переходный мажор не нужен.** Затронутые пакеты уже в бета-мажорах: ядро 11.0.0-beta,
  renderer-react и renderer-json 12.0.0-beta, ui-kit 13.0.0-beta, mcp 12.0.0-beta, builder
  3.0.0-beta, form-registry 1.0.0-beta.
- **Коммиты и push — только по явной просьбе**, по одному пакету на коммит (правило релизов). После
  каждого этапа — отчёт о состоянии рабочего дерева.

### Ключевые решения реализации

1. **Привязка по идентичности, а не по пути.** Ручка `model.$.…` разрешается в узел модели, а из
   него — в под-модель и в ноду формы. Пути остаются для `testId` и сообщений. Причина: пути
   абсолютные и меняются при перестановке строк, а области поведения и формы строк вложенные. Поиск
   по пути в них сегодня молча ничего не находит: `applyEach` внутри строки, `enableWhen` группы в
   строке, массив внутри строки или группы.
2. **Схема-контроллер — в ядре, без React.** Хранилище переопределений (`hidden`, `props`, условия,
   колбэки, жизненный цикл, ref) и `schema.node(selector)` переезжают из
   [render-schema-proxy.ts](../../packages/reformer-renderer-react/src/core/render-schema-proxy.ts)
   в ядро.
   - **Хранилище принадлежит сборке**, а не модулю: две сборки на одной модели не делят записи.
   - **Области изолированы строго.** `schema.node(selector)` ищет только в своей области. Корень —
     дерево без содержимого `item` и `part`; часть и строка — своё поддерево. Корневое поведение
     дотягивается до узлов строки или части через `applyEach` / `apply`. Так два монтирования одной
     части не конфликтуют, а корневое правило не задевает одноимённые узлы внутри частей. В эталоне
     корневое поведение адресует только узлы корневого дерева — проверено.
   - **Исключение — ref по пути модели.** `schema.node('phones.0.number').getRef()` описан в
     документации ui-kit и остаётся: путь абсолютный, ищется от корня.
   - **Поддеревья строит ядро.** Поддерево части или строки создаётся один раз на под-модель и
     хранится в сборке; рендерер берёт его оттуда. Сегодня `item` вызывается дважды — при сборке
     формы и при рендере.
   - `getRef` отдаёт обычный объект `{ current: null }` вместо `createRef` из React. React-хуки
     чтения остаются в `renderer-react`.
3. **Одна сборка — в ядре.** JSON ядро не разбирает: документ превращает в дерево сам `registry`.
   - Метод `resolveSchema` у реестра **необязательный** — у интерфейса `ComponentRegistry` есть
     сторонние реализации. Нет метода — `createForm` бросает понятную ошибку.
   - Метод возвращает дерево, обёртку поля и компонент-границу ошибок. Через эти три значения
     `renderer-json` доносит до `FormRenderer` то, что раньше делал `JsonFormRenderer`.
   - Дерево строится один раз, при сборке. Смена реестра требует новой сборки. Строки `$locale(...)`
     запекаются при сборке; живое переключение языка — компонентом `I18n`, как и описано сегодня.
   - Порядок: модель → `seed` → дерево → ноды формы → поведение `({ model, form, schema })` →
     валидация → `setup`.
4. **Имя `createForm`.** Низкоуровневая фабрика освобождает имя: путь от модели —
   `createFormFromModel` (уже экспортируется), legacy-перегрузки — `createLegacyForm`.
   - Codemod: ≈ 230 вызовов в ядре (в основном тесты) и ≈ 50 в коде других пакетов — ui-kit,
     рендереры, mcp, живые демо сайта документации, тест конструктора.
   - Рантайм-гард в новой `createForm`: объект в `schema` без `registry` или legacy-`FormSchema` —
     ошибка с отсылкой к `createFormFromModel` / `createLegacyForm`.
5. **Визард.** Компоненту, который сам управляет детьми, рендерер передаёт узлы-детей и функцию
   `renderNode`. `FormWizard` из ui-kit строит шаги из узлов, а форму и валидацию берёт из контекста
   сборки, который ставит `FormRenderer`. ui-kit по-прежнему не импортирует рендерер. `cdk` зовёт
   валидацию шага по номеру — номер в `selector` переводит ui-kit, логика `cdk` не меняется.
6. **JSON v2.** Ключ `model`, узел `part`, словарь `parts`, оператор `$part(...)`, шаги в
   `children`.
   - **Признак формата — отдельное поле `format: 2`.** Поле `version` занято: в реестре форм это
     версия содержимого формы, она сверяется с `compatibleSchema`
     ([preflight.ts](../../packages/reformer-form-registry/src/preflight.ts)). Документ без `format`
     — v1.
   - Для документов v1 — функция `migrateJsonSchema`.

### Этап 0. Подготовка

- `bd`: эпик `ReFormer-4x21` и 20 задач по этапам с зависимостями заведены (таблица ниже). Работа
  на несколько сессий: каждый этап — отдельная задача, начинаем с этапов 0–2.
- Ветка от `develop` — по команде.
- Базовая линия: тесты затронутых пакетов и e2e эталона зелёные; числа записываются в эпик.
- `git status docs/specs/` пуст.

Задачи в `bd` (эпик `ReFormer-4x21`); «ждёт» — задачи, без которых эту начинать нельзя:

| Этап | Задача | Ждёт |
| --- | --- | --- |
| Ф0 — ветка и базовая линия | `ReFormer-q92i` | — |
| Ф1 — привязка по идентичности | `ReFormer-pxfg` | Ф0 |
| Ф2.1 — освободить имя `createForm` | `ReFormer-7l1x` | Ф0 |
| Ф2.2 — узлы `model` / `item` / `part`, `arrayOf` | `ReFormer-uz40` | Ф1 |
| Ф2.3 — валидация: `apply` / `applyEach` | `ReFormer-d3hb` | Ф1 |
| Ф2.4 — схема-контроллер, область поведения | `ReFormer-bn7v` | Ф2.2 |
| Ф2.5 — единая сборка `createForm` | `ReFormer-nmrj` | Ф2.1, Ф2.2, Ф2.4 |
| Ф3 — renderer-react | `ReFormer-lmbw` | Ф2.5 |
| Ф4 — ui-kit: визард | `ReFormer-9n5r` | Ф3 |
| Ф5 — renderer-json v2 | `ReFormer-pu3w` | Ф3 |
| Ф6 — form-registry | `ReFormer-3q0o` | Ф5 |
| Ф7.1 — эталон | `ReFormer-243x` | Ф2.3, Ф4, Ф6 |
| Ф7.2 — остальные демо | `ReFormer-bp89` | Ф7.1 |
| Ф8 — MCP | `ReFormer-uvz9` | Ф7.1 |
| Ф9.1 — конструктор: модель документа | `ReFormer-eirt` | Ф5 |
| Ф9.2 — конструктор: кодоген и превью | `ReFormer-jc1e` | Ф8, Ф9.1 |
| Ф9.3 — plugin-api: протокол визарда | `ReFormer-qxdk` | Ф4 |
| Ф10 — документация | `ReFormer-1h10` | Ф8, Ф9.2 |
| Ф11 — удаление старого API | `ReFormer-qs2y` | Ф7.2, Ф9.3, Ф10 |
| Ф12 — iter-промпты MCP | `ReFormer-mhcg` | Ф8 |

### Этап 1. Ядро: привязка по идентичности

Существующий код не меняет поведения; чинятся тихие сбои во вложенных областях.

- `modelOf(ручка)`: `$`-группа → под-модель `FormModel`, `$`-массив → фасад `ModelArray`. Обратная
  карта заполняется в `signalsProxy`
  ([model-signals-proxy.ts](../../packages/reformer/src/model/model-signals-proxy.ts)); фасады
  кэшируются в [model-value-proxy.ts](../../packages/reformer/src/model/model-value-proxy.ts)
  (`makeFormModel`, для массива кэш добавляется).
- Группа или массив с начальным `null` в рантайме — лист. `modelOf` на такой ручке бросает понятную
  ошибку, а не отдаёт не-модель.
- Реестр «сигнал → нода»
  ([signal-node-registry.ts](../../packages/reformer/src/form/signal-node-registry.ts)) получает
  группы и массивы.
- [create-form.ts](../../packages/reformer/src/form/create-form.ts): массивы под-форм
  материализуются на любой глубине; построители строк ключуются ручкой, а не путём.
- [collections.ts](../../packages/reformer/src/form/behaviors/collections.ts),
  [operators.ts](../../packages/reformer/src/form/behaviors/operators.ts): `apply`, `applyEach`,
  `exclusiveFlag`, `aggregateInto`, `enableWhen` группы находят под-модель и ноду по ручке. `apply`
  отдаёт настоящую под-модель с `get` / `set` / `patch` вместо `nestedModel`.
- Обход схемы не заходит в ручки модели и React-элементы и помнит посещённые объекты.

Тесты: массив в группе и в строке массива; `applyEach` внутри `applyEach`; `enableWhen` группы
внутри строки; перестановка строк; React-элемент в `componentProps`.

### Этап 2. Ядро: новый контракт

- **Узлы схемы.** Ключ `model`, узлы `item` и `part` в `harvestFieldConfig` и в
  [schema-node.ts](../../packages/reformer/src/form/types/schema-node.ts).
  - Порядок распознавания: `item` → `part` → поле. Сигнал массива тоже «сигнал значения».
  - Узел узнаётся по значению, а не по имени ключа: `model` — ручка модели, `item` и `part` —
    функции. Схема допускает запись «имя поля → узел», и поле данных с именем `model`, `item` или
    `part` иначе потерялось бы. Сегодня так теряется поле с именем `value`.
  - Ключи `value` / `array` пока принимаются.
- **Шаблон нового элемента массива — в модели** (шаг 9).
  - `arrayOf(blank, items?)` в `@reformer/core`. Узел массива модели
    ([model-nodes.ts](../../packages/reformer/src/model/model-nodes.ts)) хранит шаблон; `push()` и
    `insertAt(i)` без значения берут элемент из него.
  - `set` / `patch` / `reset` шаблон сохраняют. Когда элемент строится из обычных данных (загрузка
    с сервера), вложенные массивы получают шаблоны из шаблона родителя.
  - Нет шаблона — `push()` без значения бросает понятную ошибку. Сегодня нода массива формы в этом
    случае кладёт в модель пустой объект `{}`
    ([model-array-node.ts](../../packages/reformer/src/form/nodes/model-array-node.ts)).
  - `initialValue` узла — запасной путь: сборка регистрирует его как шаблон массива, если модель
    своего не объявила. После этого «Добавить» везде вызывает `push()` без аргумента.
- **Валидация** ([operators.ts](../../packages/reformer/src/form/validation/operators.ts),
  [context.ts](../../packages/reformer/src/form/validation/context.ts)).
  - `applyEach(ручка, схема)` и `apply(ручка, схема)` с собственной областью: общие `errors`,
    `pending`, `whenStack`, `signal`, своя `model`.
  - Корень прогона хранится в контексте отдельно: правило по-прежнему получает его третьим
    аргументом, а не под-модель.
  - `each` принимает и фасад, и ручку. `apply(schemaA, schemaB)` остаётся — на нём держится
    `buildValidation`.
- **Поведение** ([context.ts](../../packages/reformer/src/form/behaviors/context.ts),
  [types.ts](../../packages/reformer/src/form/behaviors/types.ts)): область
  `{ model, form, schema }`. Схема-контроллер и операторы `hideWhen`, `onComponentEvent`,
  `renderEffect`, `onInit`, `onMount`, `onUnmount` — в `@reformer/core/behaviors`. `apply` и
  `applyEach` запускают под-схему с контроллером своей области.
- **Сборка.** Codemod: низкоуровневая `createForm` → `createFormFromModel` / `createLegacyForm` —
  в ядре, ui-kit, рендерерах, mcp, живых демо сайта документации. Затем новая `createForm` →
  `{ model, form, validation, render }` с рантайм-гардом из решения 4.
  [create-core-form.ts](../../packages/reformer/src/form/create-core-form.ts) становится псевдонимом.
- **Контекст сборки для React**: `FormBundleContext`, `useFormBundleContext` рядом с
  [use-form-bundle.ts](../../packages/reformer/src/platforms/react/hooks/use-form-bundle.ts).
- **Типы.** `apply(model.$.group, rules)` и `applyEach(model.$.items, rules)` выводят тип под-модели
  через фантомный бренд на типах контейнерных узлов
  ([types.ts](../../packages/reformer/src/model/types.ts)). Символ бренда экспортируется — иначе
  падает эмит деклараций.
- **Покрытие.** Пороги ядра — 79 / 71 / 80 / 81, по оценке рецензента запас меньше процента. Тесты
  контроллера переезжают в ядро вместе с ним; сборка и контекст получают свои.
- **Релиз.** Коммит ядра — с `!`. Codemod-коммиты рендереров — типа `fix`: `refactor` релиза не
  даёт, и рендереры остались бы на версии, несовместимой с новым ядром.
- `.size-limit.json` — `behaviors.js` и `index.js`.
- [contract-spec.md](contract-spec.md) фиксирует `each`, прямой вызов под-схемы и
  `makeValidationConfig` как канон — в этих частях помечается заменённым.

### Этап 3. renderer-react

- [types.ts](../../packages/reformer-renderer-react/src/core/types.ts),
  [utils.ts](../../packages/reformer-renderer-react/src/core/utils.ts): `model` у поля и массива,
  узел `part`; порядок проверок `item` → `part` → поле → контейнер.
- [render-node.tsx](../../packages/reformer-renderer-react/src/core/render-node.tsx): массив
  работает с фасадом `modelOf(node.model)`; поддеревья строк и частей берутся из сборки; строка и
  часть оборачиваются в контекст области; компонент с `__selfManagedChildren` получает `renderNode`.
  «Добавить» вызывает `push()` без аргумента; `resolveInitialValue` уходит.
- [form-renderer.tsx](../../packages/reformer-renderer-react/src/core/form-renderer.tsx): принимает
  бандл `createForm`, берёт готовое дерево, ставит контекст сборки и корневую область. Обёртка
  поля — `settings.fieldWrapper`, иначе из бандла. Если бандл несёт границу ошибок — оборачивает ею
  дерево. Прежний бандл `createReactForm` принимается до этапа 11.
- [render-schema-proxy.ts](../../packages/reformer-renderer-react/src/core/render-schema-proxy.ts),
  [render-behavior.ts](../../packages/reformer-renderer-react/src/core/render-behavior.ts): остаются
  React-хуки чтения; операторы реэкспортируются из ядра до этапа 11.
- **Совместимость с renderer-json.** `JsonFormRenderer` читает карты переопределений напрямую
  (`schemaProxy.__overrideMaps.*`) для диагностики промаха селектора. Форма карт сохраняется до
  этапа 5 либо правится в том же этапе — иначе renderer-json ломается раньше своей очереди.
- `createReactForm` и `useReactForm` до этапа 11 работают как раньше, включая двойной вызов
  билдера: на нём держится shim визарда в ещё не переведённых примерах.

### Этап 4. ui-kit: визард

- [form-wizard.tsx](../../packages/reformer-ui-kit/src/components/form-wizard/variants/base/form-wizard.tsx):
  `form` и `config` необязательны — берутся из контекста сборки. Шаги строятся из узлов-детей
  (`selector`, `componentProps.title`, `componentProps.icon`), тело шага рисует `renderNode`.
- **Шаг ↔ правила.** По `selector`; у шага без `selector` — по порядковому номеру, как сейчас. Это
  закрывает тихую дыру: сегодня прогон по неизвестному ключу берёт пустую схему и отвечает
  «валидно», то есть опечатка в селекторе пропускала бы пустые обязательные поля.
- В dev — проверка соответствия в обе стороны: ключи `validation.steps` без шага и шаги без ключа.
- Пропсы `steps` и `renderStepBody` остаются — ими пользуется React-руками.
- **Секция массива.** Проп `initialValue` у `FormArraySection` и `FormArray.AddButton` уже
  необязателен; без него «Добавить» берёт шаблон из модели. Примеры в JSDoc и `docs/llms`
  переписываются на вариант без пропа.
- `cdk`: код не меняется, только JSDoc и `docs/llms` (в примерах стоят ключ `value:` и проп
  `initialValue`). Коммит — типа `fix`: MCP читает документацию из установленных пакетов, а правка
  без релиза туда не попадёт.
- После правки каталога компонентов — полный `npm test` в `projects/reformer-builder`.

### Этап 5. renderer-json: формат v2

- **Типы.** Типы и гарды v1 получают суффикс `V1` (codemod по потребителям; в конструкторе — ≈ 83
  файла), основные имена `JsonFormSchema`, `JsonNode`, `isFieldNode`… переходят к v2. Иначе правка
  типов сломала бы typecheck конструктора раньше этапа 9.
- [json-schema.ts](../../packages/reformer-renderer-json/src/types/json-schema.ts),
  [operators.ts](../../packages/reformer-renderer-json/src/operators.ts): поле `format`, ключ
  `model`, узел `{ model, part }`, корневой словарь `parts`, оператор `$part(...)`, `item` принимает
  `$template` или `$part(...)`. `initialValue` у узла массива становится необязательным.
- [json-to-render-schema.ts](../../packages/reformer-renderer-json/src/converter/json-to-render-schema.ts):
  конвертер v2 получает `parts`; массив и часть привязываются ручкой; пути внутри части
  относительны. Ручку группы конвертер находит обходом `scope.$` по пути: `signalAt` для группы
  возвращает `undefined`.
- [component-registry.ts](../../packages/reformer-renderer-json/src/registry/component-registry.ts):
  `resolveSchema(документ, модель)` → дерево, обёртка поля из `FIELD_WRAPPER`, граница ошибок
  `SchemaErrorBoundary`.
- [compose.ts](../../packages/reformer-renderer-json/src/compose.ts): `$ref` разворачивается в
  `children`, а не только в `componentProps.steps`.
- Мета-схема ([schema/index.ts](../../packages/reformer-renderer-json/src/schema/index.ts)),
  [validate.ts](../../packages/reformer-renderer-json/src/validate.ts), обходчики
  `collect-operator-names.ts` и `collect-schema-selectors.ts` — учитывают `parts` и ветвятся по
  `format`.
- **`migrateJsonSchema(v1, { stepHosts })` → v2.** Переименовывает ключи, переносит шаги в
  `children`, ставит `format: 2`.
  - Чьи `componentProps.steps` — шаги, определяется именем компонента; список имён передаётся
    параметром (по умолчанию `Wizard`, `RendererFormWizard`, `FormWizard`).
  - Имя компонента функция не меняет: на библиотечный `FormWizard` его переключает реестр
    приложения — это код, а не данные.
  - `wrapper`, `$nodeId` и шаги без `selector` сохраняются как есть.
- **Обязанности `JsonFormRenderer` переезжают:** реестр передаётся в `createForm` явно, вложенные
  провайдеры заменяет `composeRegistries`; граница ошибок приходит из бандла; проверка схемы в dev —
  явный вызов `validateFormSchema` с `SchemaErrorPanel`; `onSchemaReady` не нужен — контроллер схемы
  лежит в бандле.
- Формат v1 до этапа 11 читают старые точки входа — `createJsonForm`, `useJsonForm`,
  `JsonFormRenderer`, `JsonRendererProvider`; их поведение не меняется. Новая сборка читает только
  v2.
- Скрипт мета-схемы лежит в playground
  ([gen-form-json-schema.ts](../../projects/react-playground/scripts/gen-form-json-schema.ts)).
  Базовая мета-схема меняется здесь, поэтому `npm run gen:form-schema` запускается в этом же этапе.

### Этап 6. form-registry

- [types.ts](../../packages/reformer-form-registry/src/types.ts): `FormEntry.behavior` — поведение
  либо фабрика `(options) => поведение`; настройки места монтирования приходят в фабрику.
  `renderBehavior` остаётся до этапа 11.
- [mounted-form.tsx](../../packages/reformer-form-registry/src/react/mounted-form.tsx): для схемы
  v2 — `createForm` + `FormRenderer`; для v1 — прежний путь, до этапа 11. Тип `onReady` меняется на
  бандл новой сборки.
- **Загрузчик мигрирует v1 на лету.** Схемы приходят по сети и лежат в постоянном кэше
  (`cache.ts`, `storage/`). Перед проверкой загрузчик прогоняет документ v1 через
  `migrateJsonSchema` — иначе после этапа 11 закэшированные формы перестали бы открываться.
- `preflight.ts`, `net.ts`: обходчики учитывают `parts`.

### Этап 7. Эталон и примеры

Эталон идёт сразу после пакетов: его e2e — приёмка контракта до того, как он уйдёт в MCP,
конструктор и документацию.

- **Флагман.** Одна `form.schema.ts` на React-руками и renderer-react; у JSON-варианта —
  `form.schema.json` v2 с частями (адрес, элементы массивов). `model.ts`, `form.validation.ts`,
  `form.behavior.ts` — общие на три варианта. Вариант с реестром форм импортирует файлы
  JSON-варианта вместо копий.
- **React-руками и операторы узлов.** `hideWhen`, `onComponentEvent`, `onMount` только записывают
  правило; исполняет его рендерер. В варианте React-руками они не действуют: видимость, отправка и
  загрузка данных остаются в JSX, как сейчас, и условия там читаются из ноды формы, как сейчас.
- **Удаляются:** [schemas/schema.ts](../../projects/react-playground/src/pages/demo/complex-multy-step-form/schemas/schema.ts)
  (680 строк), оба `render-behavior.ts`, `schemas/create-form.ts`, `makeCreditValidationConfig`,
  shim [RendererFormWizard.tsx](../../projects/react-playground/src/components/RendererFormWizard.tsx)
  (113 строк, 11 файлов-потребителей).
- **Расхождения копий** сводятся к объединению: поля React-варианта (`sameEmail`, бизнес-поля
  шага 1) плюс `min` / `max` у `carYear` из JSON.
- **Шаблоны элементов.** В `model.ts` три массива объявляются через `arrayOf`. Из JSON уходят три
  литерала `initialValue` (26 строк), из TS-схемы — три ссылки, из JSX — три пропа.
- **Остальные демо** (12 страниц) и отладочные страницы (`mcp-credit-application-*-v20`,
  `new-mcp-test-v2`, `-react`, `ui_builder`) — механически: ключи, сборка, хуки, `each` →
  `applyEach`. Каталог `builder-tests` перегенерирует конструктор на этапе 9.
- **Мета-схема.** Скрипт читает `json-schema.json` по имени и пишет один файл; переименование файла
  эталона требует правки скрипта и шага в `test.yml`. Копия `form-schema.schema.json` в варианте с
  реестром уже устарела и удаляется.

### Этап 8. MCP

- **Новые эмиттеры — рядом со старыми.** Конструктор печатает `form.validation.ts` и
  `form.behavior.ts` эмиттерами MCP
  ([rules-bridge.ts](../../projects/reformer-builder/src/plugins/reformer/core/codegen/emit/rules-bridge.ts)
  импортирует их из `@reformer/mcp/dist`), и их вывод лежит в его golden-снимках. Замена на месте
  уронила бы тесты конструктора уже здесь. Старые эмиттеры живут до этапа 9, удаляются на этапе 11.
- **Генераторы** ([builders.ts](../../packages/reformer-mcp/src/core/generate/builders.ts)): один
  эмиттер разметки выдаёт `form.schema.ts` для TS-таргетов и `form.schema.json` v2 для JSON. Сейчас
  TS-таргеты получают `layout.json` с просьбой перенести его вручную. Шаги — в `children`;
  `applyEach`; правила видимости — в `form.behavior.ts`. Из канона раскладки (`FORM_LAYOUT_CANON`,
  `STEP_LAYOUT_CANON`) уходят `form.render.ts` и `wizard.tsx`. `model.ts` печатает массивы через
  `arrayOf`; узел массива — без `initialValue`, и сверка бандла (C8) его больше не требует.
- **`FormIntent`** ([form-intent.ts](../../packages/reformer-mcp/src/core/generate/form-intent.ts)):
  добавляются узел `part` и словарь частей; остальная форма intent не меняется — на неё опирается
  сайдкар правил конструктора.
- **`validate_form`**: списки операторов RF004 / RF005
  ([code.ts](../../packages/reformer-mcp/src/core/validate/code.ts)); RF010 для старых ключей и
  фабрик с подсказкой замены; сверка бандла по ключу `model`
  ([cross-check.ts](../../packages/reformer-mcp/src/core/generate/cross-check.ts)); канон и алиасы
  раскладки ([layout.ts](../../packages/reformer-mcp/src/core/validate/layout.ts)).
- **`choose_api`** ([api-decision.ts](../../packages/reformer-mcp/src/core/decide/api-decision.ts)):
  `validate-each` → `applyEach`, `hide-node` → оператор поведения, `stable-form` → `useFormBundle`;
  новое правило «подформа».
- 12 шаблонов промптов (≈ 194 вхождения), `docs/llms` (01, 02, 05, 06), `FORM_LAYOUT_ENTRY` в
  `src/index.ts`.
- [check-mcp-prompts.mjs](../../scripts/check-mcp-prompts.mjs): `FACTORY_RE` и эвристика
  `LEGACY_ASSEMBLY` — она считает связку `createModel(` + `createForm(` ручной сборкой.
- Тесты (≈ 130 в 8 файлах), eval-корпус (ожидания контракта — в 5 файлах из 7) и
  `docs/mcp-eval/baseline.json`.
- Iter-промпты (`docs/iter-prompts`) правятся отдельной задачей, вне цикла.

### Этап 9. Конструктор

- **Модель документа**: ключ `model`, шаги в `children`, узел `part` и `parts` — `core/form-model`,
  `core/catalog/make-node.ts`, `editor/model`, AI-инструменты (`ai/tools`, `ai/model/node-ref.ts`),
  `validator/structure.ts`. На типы и гарды JSON ссылаются ≈ 83 нетестовых файла.
- **Кодоген** (15 шаблонов `.eta`): переход на новые эмиттеры MCP; `index-tsx.eta` → `createForm` +
  `useFormBundle` + `FormRenderer`; `render-behavior.eta`, `wizard.eta`, `step-render.eta` уходят;
  `validation.eta` — без `makeValidationConfig`; `registry.eta` — без шима `Wizard`. Правила
  видимости для узлов внутри `item` и `part` печатаются внутри `applyEach` / `apply` — области
  изолированы.
- **Сохранённые данные.**
  - Документы v1 и схемы настроек сторонних плагинов (`plugin-api`,
    `CatalogPluginSettingsPoint.schema`) мигрируются при открытии через `migrateJsonSchema`.
  - Сайдкар правил хранит раздел `render` как раньше — меняется только эмиттер.
  - Шаблон нового элемента массива документ по-прежнему держит в `initialValue` узла: модель
    конструктор строит из данных.
  - В выгруженных проектах `form.render.ts` помечен как пользовательский. При перегенерации правила
    переезжают в `form.behavior.ts`; если `form.render.ts` правили руками, конструктор сообщает об
    этом, а не молча перестаёт его импортировать.
- **Контракт китов** (`plugin-api`): `adapters.wizard` и `codegen.needsShim` описывают шим, который
  уходит. Вводится протокол визарда — узлы-дети, `renderNode`, контекст сборки; версия контракта
  каталога повышается. Сторонний кит со своим визардом без нового протокола работать перестанет —
  это попадает в заметки к релизу.
- **Плагины** делят с хостом рантайм-модули `@reformer/core` и `@reformer/renderer-json`: смена
  смысла `createForm` касается их кода, не только схем настроек. Тоже в заметки к релизу.
- **Превью** (`render/runtime/build.ts`, `render/compiling/exports.ts`, `CompilingView.tsx`,
  `RuntimeView.tsx`): `createForm` + `FormRenderer`. При смене схемы форма собирается на новой
  модели с переносом значений
  ([carry.ts](../../projects/reformer-builder/src/plugins/reformer/render/runtime/carry.ts)), как
  сейчас: прежняя модель не умеет отращивать листья под новую схему.
- **Снимки**: 165 golden и `catalog-equivalence` переснимаются после сверки diff, с записанной
  причиной; полный `npm test`.

### Этап 10. Документация

`docs/llms` пакетов на этапах 2–6 только пополняются — новый API описывается рядом со старым.
Переписываются они здесь, вместе с остальным:

- Сайт `projects/reformer-doc`: `docs/` (29 файлов), `i18n/ru` (24 файла; 25 из 31 — побайтные
  копии `docs/`, правятся парой), `i18n/en` (1), живые демо в `src` (27 файлов).
- README: корневой и четыре пакетных.
- Удалённое API — в таблицу `17-nonexistent-api.md` ядра и в troubleshooting пакетов.

### Этап 11. Удаление старого API

- Ключи `value` / `array`, оператор `each`.
- `createCoreForm` / `createReactForm` / `createJsonForm`, `useReactForm` / `useJsonForm`,
  `JsonFormRenderer` / `JsonRendererProvider`, двойной вызов билдера `(model, form?)`.
- `renderBehavior`, `FormEntry.renderBehavior`, тип `RenderBehaviorFn`; проп
  `renderBehaviorOptions` у `FormOutlet` / `FormSlot` становится `behaviorOptions`.
- Типы, гарды и конвертер JSON v1; старые эмиттеры MCP.

Тесты ядра на старых ключах переводит codemod. В коммитах — `!` в типе.

### Объём

| Этап | Что | Объём |
| --- | --- | --- |
| 1 | ядро: привязка по идентичности | M–L |
| 2 | ядро: новый контракт | XL |
| 3 | renderer-react | L |
| 4 | ui-kit: визард | M |
| 5 | renderer-json v2 | L |
| 6 | form-registry | S–M |
| 7 | эталон и примеры | XL |
| 8 | MCP | L |
| 9 | конструктор | XL |
| 10 | документация | L |
| 11 | удаление старого API | M |

### Открытые детали — что принято по умолчанию

Любую строку можно поменять при согласовании. Первые три влияют на объём и на контракт сильнее
остальных.

| Вопрос | Решение в плане |
| --- | --- |
| Ветка | отдельная ветка от `develop`; вливается целиком после этапа 11 |
| React-руками и операторы узлов (`hideWhen`, `onComponentEvent`, `onMount`) | не действуют; видимость, отправка и загрузка остаются в JSX. Альтернатива — хук чтения узла схемы для JSX |
| Область `schema.node(...)` | строгая изоляция: корень не видит узлы строк и частей, туда — через `applyEach` / `apply` |
| Старый API | удаляется на этапе 11; имя `createForm` меняет смысл на этапе 2 |
| Признак формата JSON | **решено:** поле `format: 2`; документ без поля — v1. Вариант `"$schema": "reformer-form/2"` по образцу `plain-form/1` отклонён: `$schema` остаётся путём к мета-схеме для подсветки в IDE |
| Шаблон нового элемента массива | **решено (шаг 9):** `arrayOf(blank)` в модели; `initialValue` в узле — необязательный запасной путь для форм, у которых модель создаётся из данных |
| JSON v1 | после этапа 11 рантаймом не читается; конструктор и загрузчик реестра форм мигрируют документ при чтении |
| `apply(schemaA, schemaB)` в валидации | остаётся перегрузкой |
| Обёртка поля | TS — `settings.fieldWrapper` у рендерера; JSON — запись `FIELD_WRAPPER` реестра, сборка кладёт её в бандл |
| Собранная валидация в поведении | в область не добавляется; обработчик отправки обычной формы берёт её в `setup(bundle)` или зовёт `validateModel` с правилами напрямую |
| `schema.node(...)` с селектором, которого нет | ничего не делает; в dev — предупреждение, когда дерево области построено |
| Шаг визарда без `selector` | правила — по порядковому номеру |
| `FormWizard` в React-руками | без изменений: `form`, `config`, `steps` пропсами |
| `createRenderSchema` и проп `render` у `FormRenderer` | остаются низкоуровневым API; `schema.node` отдаёт контроллер ядра |
| JSON: шаги в отдельных файлах | `$ref` остаётся, разворачивается в `children` |
| JSON: именованные части | только в документе (`parts`); реестр частей — позже |
| Проверка JSON-схемы в dev | явный вызов `validateFormSchema` + `SchemaErrorPanel` |
| Настройки места монтирования в реестре форм | `FormEntry.behavior` — поведение или фабрика `(options) => поведение` |
| Расхождения трёх копий эталона | объединение: поля React-варианта плюс `min` / `max` у `carYear` из JSON; визуальные эталоны renderer-вариантов переснимаются |

### Проверка

После каждого этапа:

- сначала `npm run build -w <пакет>` для изменённого пакета: пакеты, playground и конструктор
  видят друг друга через `dist`;
- в каталоге пакета — `npx tsc -b` и `npx vitest run`; из корня `npx tsc -b` не запускается;
- из корня — eslint с корневым конфигом, `npm run size`, `npm run generate:llms -w <пакет>`
  (повторный запуск не даёт diff);
- renderer-json: `npm run gen:form-schema` без дрифта;
- конструктор: полный `npm test` в `projects/reformer-builder`.

Гейты, которым нужно несколько этапов:

| Гейт | Когда обязан быть зелёным |
| --- | --- |
| покрытие ядра | с этапа 2 — тесты контроллера переезжают вместе с ним |
| тесты конструктора | всегда; на этапе 8 их держат старые эмиттеры MCP |
| `mcp:evaluate` против baseline | с этапа 8; на этапах 2–6 — индикатор |
| дрифт мета-схемы | этапы 5 и 7 |
| `typecheck` playground и конструктора | всегда; на этапе 5 его держат типы `V1` |

Сквозная:

- **e2e эталона** (`projects/react-playground-e2e`): 12 spec кредитной формы на трёх вариантах,
  ≈ 233 теста на вариант, плюс остальные проекты. Визуальные эталоны (157 PNG) сверяются.
  Скриншоты — в `projects/react-playground-e2e/screenshots/unified-contract/`.
- **MCP**: `plan_form` → `generate_form` → `validate_form` для трёх таргетов выдают новый контракт
  без диагностик; `npm run check:mcp-prompts`, `npm run mcp:evaluate` не хуже baseline (0.945).
- **Корень**: `npm run typecheck`, `npm run lint`, `npm run knip`.
- **Итог по эталону**: одна `form.schema.ts` на два TS-варианта, нет `render-behavior.ts` и shim
  визарда; строки трёх вариантов замеряются против исходных ≈ 5 940.
- Iter-цикл MCP — по команде, после правки iter-промптов.

### Что изменила независимая проверка

Блокеры:

1. **Этапы 8 и 9 были сцеплены.** Конструктор печатает правила эмиттерами MCP — замена их на месте
   роняла его тесты. Теперь новые эмиттеры добавляются рядом со старыми.
2. **Поле `version` занято.** Реестр форм сверяет его с `compatibleSchema`. Формат теперь различает
   поле `format`.

Существенное:

- Имя `createForm` меняет смысл на этапе 2, а не 11 — отсюда отдельная ветка и требования к типам
  коммитов.
- Чтение селекторов «от области к корню» противоречило изоляции частей из шага 7 — заменено строгой
  изоляцией.
- Операторы узлов не работают без рендерера — для React-руками это сказано явно.
- Связь шага с правилами по `selector` открывала тихий пропуск валидации — добавлены запасной путь
  по номеру и проверка в dev.
- Не были учтены: постоянный кэш схем в реестре форм, пользовательский `form.render.ts` в
  выгруженных проектах, контракт китов, общий рантайм плагинов.
- Превью конструктора не может пересобираться на прежней модели.
- Обязанности `JsonFormRenderer` (граница ошибок, реестр, проверка схемы) получили новое место.
- Названы гейты CI, которые падали бы посреди работы; этапы 1–3 переоценены в большую сторону.

Что осталось непроверенным:

- Ничего не запускалось — ни тесты, ни `tsc`, ни e2e. Проверка шла по коду.
- Вывод типов через бренд и разрешение перегрузок `apply` оценены рассуждением, не компилятором.
- Запас по покрытию ядра, счётчики файлов конструктора и числа тестов взяты из отчётов и не
  пересчитаны.
- Численно не оценён рост `behaviors.js` и `index.js` после переноса контроллера в ядро.

### Замечено попутно, в работу не входит

- Генератор MCP печатает `each(model.$.items, …)`, а `each` ядра ждёт фасад массива — у ручки нет
  `at`. По чтению кода такой файл сегодня падает; не запускал. Этап 2 это чинит.
- Проекты `iter-*` в Playwright ждут маршруты `/mcp-credit-application-{target}-v{N}`, а в
  `App.tsx` они `/debug/mcca-*-v20`.
- В пяти файлах документации в конце висят посторонние строки `</content>` и `</invoke>`.
- `docs/branching.md` требует обновлять peer-диапазоны при breaking change;
  `release-and-publishing.md` и гейт `check:peer-ranges` требуют `"*"`.

## Приложение. Журнал согласования контракта

Шаги записаны в том виде, в каком согласовывались: листинги ранних шагов уточнены поздними. Итоговая
запись — в разделе «Итог контракта».

### Шаг 1. Одна схема вместо «схемы формы» и «схемы UI» — согласовано

**Решение.** Схема одна — дерево узлов. Поле описывается один раз и сразу стоит на своём месте в
разметке. Из этой схемы и строится форма, и рисуется UI. Отдельного вида «схема формы» (карта полей
без разметки) больше нет.

Узлы — сегодняшние, с одной правкой из шага 2: привязка к модели называется `model`.

| Узел | Форма |
| --- | --- |
| поле | `{ model, component, componentProps }` |
| массив | `{ model, item, component, initialValue, componentProps }` |
| контейнер | `{ component, componentProps, children }` |

**Было — две схемы, поле описано в обеих.**

```ts
// схема формы — schemas/schema.ts (680 строк): поля, без разметки
loanType: {
  value: model.$.loanType,
  component: SelectAsync,
  componentProps: { label: 'Тип кредита', placeholder: 'Выберите тип кредита', options: LOAN_TYPES },
},
// разметка для неё — отдельно, в JSX:
// <FormField control={control.loanType} testId="loanType" />

// схема UI — render-schema.ts (1092 строки): разметка, и то же поле описано заново
{
  component: Section,
  componentProps: { title: 'Основная информация о кредите' },
  children: [
    f(model.$.loanType, SelectAsync, {
      label: 'Тип кредита',
      placeholder: 'Выберите тип кредита',
      options: LOAN_TYPES,
    }),
  ],
}
```

**Стало — одна схема.**

```ts
// form.schema.ts — единственная схема
export const creditSchema = (model: FormModel<CreditApplicationForm>) => ({
  selector: 'wizard',
  component: RendererFormWizard,
  componentProps: {
    steps: [
      {
        component: Step,
        componentProps: { title: 'Кредит', icon: '💰' },
        children: [
          {
            model: model.$.loanType, // привязка к полю модели — это узел формы
            component: SelectAsync, // и он же узел UI
            componentProps: { label: 'Тип кредита', options: LOAN_TYPES },
          },
          {
            selector: 'mortgage',
            component: Section,
            componentProps: { title: 'Информация о недвижимости' },
            children: [
              {
                model: model.$.propertyValue,
                component: InputNumber,
                componentProps: { label: 'Стоимость недвижимости (₽)', min: 1_000_000 },
              },
            ],
          },
        ],
      },
      {
        component: Step,
        componentProps: { title: 'Контакты', icon: '📞' },
        children: [
          address('Адрес регистрации', model.registrationAddress),
          address('Адрес проживания', model.residenceAddress),
        ],
      },
    ],
  },
});

// подформа — обычная функция от под-модели: объявлена один раз, стоит в схеме дважды
const address = (title: string, model: FormModel<Address>) => ({
  component: Section,
  componentProps: { title },
  children: [
    { model: model.$.region, component: Input, componentProps: { label: 'Регион' } },
    { model: model.$.city, component: Input, componentProps: { label: 'Город' } },
  ],
});
```

**Три способа берут одну и ту же схему и отличаются только тем, кто рисует.**

```tsx
const credit = useReactForm(() =>
  createReactForm({ model, schema: creditSchema, behavior, validation })
);

// renderer — рисует схему целиком
<FormRenderer form={credit} settings={{ fieldWrapper: FormField }} />

// React-руками — форма построена из той же схемы, рисуем сами
<FormField control={credit.form.loanType} />

// JSON — то же дерево данными
{ "model": "$model(loanType)", "component": "$component(Select)", "componentProps": { "label": "Тип кредита" } }
```

**Следствия**

- Контейнеры в схеме необязательны. Кто рисует разметку в JSX, оставляет в схеме только поля — это
  та же схема без контейнеров.
- Подформа в TS — функция от под-модели, возвращающая узлы.
- Модель, валидация и поведение на этом шаге не трогаются.
- Нового API почти не нужно: узел поля в обеих схемах уже одной формы, сборка формы принимает
  дерево, `createReactForm` отдаёт и `form`, и дерево для рендера.

**Что это меняет в контракте**

- Одно имя и один тип схемы вместо «схемы формы» и «render-схемы».
- `form.schema.ts` имеет одно и то же содержимое во всех таргетах; строка «core → M1 FormSchema» в
  раскладке MCP ([06-form-directory-layout.md](../../packages/reformer-mcp/docs/llms/06-form-directory-layout.md)) уходит.
- Во флагмане React-руками [schemas/schema.ts](../../projects/react-playground/src/pages/demo/complex-multy-step-form/schemas/schema.ts)
  заменяется общей схемой.

**Не решено внутри шага**

1. Одна сборка или по-прежнему `createCoreForm` и `createReactForm`.
2. JSON-подформа: в дереве JSON нет фрагмента с относительными путями, функция есть только в TS.

### Шаг 2. Привязка узла к модели — ключ `model` — согласовано

**Решение.** Ключ `value` у поля и ключ `array` у массива заменяются одним ключом `model`: узел
привязан к части модели, а не хранит значение. Это чистое переименование — присваивается то же,
что и сегодня.

| Узел | Как отличить |
| --- | --- |
| поле | есть `model`, нет `item` |
| массив | есть `model` и `item` |
| контейнер | есть `children`, нет `model` |

```ts
// поле: было → стало
{ value: model.$.loanType, component: SelectAsync, componentProps: { label: 'Тип кредита' } }
{ model: model.$.loanType, component: SelectAsync, componentProps: { label: 'Тип кредита' } }

// массив: было → стало (сама ручка массива меняется на шаге 3)
{ array: model.properties, component: FormArray, initialValue: createBlankProperty, item }
{ model: model.properties, component: FormArray, initialValue: createBlankProperty, item }
```

```json
{ "model": "$model(loanType)", "component": "$component(Select)" }
{ "model": "$model(properties)", "component": "$component(FormArray)", "item": { "$template": {} } }
```

Не меняются контейнеры и оператор `$model(...)` внутри `componentProps` и в текстовых `children`.

**Следствия**

- Слово `model` встречается на двух уровнях: вся модель в конфиге сборки и привязка в узле.
- Узел массива становится одним на все таргеты: `{ model, item }` плюс необязательные `component`,
  `initialValue`, `componentProps`.

### Шаг 3. Одна ручка привязки — сигнал `model.$.…` — согласовано

**Решение.** Всё, что привязывается к части модели, получает сигнал из `model.$`: узел схемы,
правило валидации, оператор поведения. Value-фасад массива (`model.properties`) под привязку больше
не подставляется.

```ts
// схема
{ model: model.$.loanType, component: SelectAsync } // поле
{ model: model.$.tags, component: SelectMulti } // массив как значение одного поля
{ model: model.$.properties, component: FormArray, item: property } // массив под-форм

// валидация
validate(model.$.loanType, [required()]);
each(model.$.properties, propertyRules); // было each(model.properties, …)

// поведение — уже так
applyEach(model.$.properties, propertyBehavior);
apply([model.$.registrationAddress, model.$.residenceAddress], addressBehavior);
enableWhen(model.$.residenceAddress, () => !model.sameAsRegistration);
```

| Что | Было | Стало |
| --- | --- | --- |
| массив в схеме | `model.properties` | `model.$.properties` |
| массив в валидации | `each(model.properties, …)` | `each(model.$.properties, …)`; имя оператора меняется на шаге 5 |
| массив в поведении | `applyEach(model.$.items, …)` | без изменений |
| поле, группа | `model.$.x` | без изменений |

**Правило.** `model.$.…` — привязка. Без `$` остаются три вещи: чтение значения
(`model.loanType === 'mortgage'`), мутация (`model.properties.push(…)`) и передача под-модели как
области.

**Следствия**

- Массив под-форм и массив как значение поля привязываются одинаково; разница только в `item`.
- TS и JSON становятся симметричны: `"$model(properties)"` ↔ `model.$.properties` во всех слоях.

**Понято так, не уточнялось**

- Подформа и элемент массива по-прежнему получают под-модель, привязки внутри идут через её `$`:
  `address(model.registrationAddress)` → `model.$.region`; `item: (item) => …` → `item.$.type`. Так же
  устроены элементы в валидации (`item.$.x`) и в поведении (`row.$.x`).

**Не решено**

1. В документации у функций-подформ встречаются обе ручки: под-модель (`model.address`) и её
   сигналы (`model.$.personalData`). Нужна одна.

### Шаг 4. Подформа — узел с `model` и `part` — согласовано

**Решение.** Подформа подключается узлом, привязанным к под-модели тем же ключом `model`. Узел
одинаков в TS и JSON. В JSON это даёт фрагмент с относительными путями, которого сейчас нет.

| Узел | Как отличить |
| --- | --- |
| поле | есть `model`, нет `item` и `part` |
| массив | `model` + `item` — часть строится для каждого элемента |
| подформа | `model` + `part` — часть строится для одной под-модели |
| контейнер | есть `children`, нет `model` |

```ts
// form.schema.ts
{
  component: Section,
  componentProps: { title: 'Адрес регистрации' },
  children: [{ model: model.$.registrationAddress, part: address }],
},
{
  selector: 'residence',
  component: Section,
  componentProps: { title: 'Адрес проживания' },
  children: [{ model: model.$.residenceAddress, part: address }],
},

// часть объявлена один раз: получает под-модель, привязки внутри — через её `$`
const address = (model: FormModel<Address>) => ({
  component: Box,
  children: [
    { model: model.$.region, component: Input, componentProps: { label: 'Регион' } },
    { model: model.$.city, component: Input, componentProps: { label: 'Город' } },
  ],
});
```

```json
{
  "parts": {
    "address": {
      "component": "$component(Box)",
      "children": [
        { "model": "$model(region)", "component": "$component(Input)" },
        { "model": "$model(city)", "component": "$component(Input)" }
      ]
    }
  },
  "root": {
    "component": "$component(Box)",
    "children": [
      { "model": "$model(registrationAddress)", "part": "$part(address)" },
      { "model": "$model(residenceAddress)", "part": "$part(address)" }
    ]
  }
}
```

**Следствия**

- Пути `$model(...)` внутри части относительны под-модели узла — так же, как сегодня внутри
  `item.$template`.
- `item` массива и `part` подформы — одно и то же по смыслу: часть, которой дают под-модель.
  Именованную часть можно подставить и в `item`: `"item": "$part(property)"`.
- Заголовок и прочее оформление конкретного места — обычным контейнером вокруг узла.

**Принято.** Узел используется и в TS, и в JSON. В TS он не проверяет типами, что часть подходит к
под-модели (так же сегодня у `item` массива); вызов функции это проверял бы, но запись в TS и JSON
стала бы разной.

**Не решено**

1. Где живут именованные части в JSON: только в документе (`parts`) или ещё и в реестре — для
   переиспользования между формами.

### Шаг 5. Подформа в валидации подключается так же — привязкой — согласовано

**Решение.** Во всех трёх слоях подформа подключается привязкой к сигналу под-модели. В схеме и в
поведении это уже так (шаг 4 и существующий `apply`), в валидации прямой вызов с под-моделью
заменяется оператором.

```ts
// подформа: правила объявлены один раз
const addressRules = defineValidationSchema<Address>(({ model }) => {
  validate(model.$.region, [required(), minLength(2), maxLength(100)]);
  validate(model.$.city, [required(), minLength(2), maxLength(100)]);
});

const contactsRules = defineValidationSchema<CreditApplicationForm>(({ model }) => {
  validate(model.$.phoneMain, [required()]);

  // было: addressRules({ model: model.registrationAddress });
  apply(model.$.registrationAddress, addressRules);

  validateWhen(
    () => !model.sameAsRegistration,
    () => apply(model.$.residenceAddress, addressRules)
  );
});
```

Одна и та же привязка и одни и те же имена во всех слоях:

| | поле | массив | подформа |
| --- | --- | --- | --- |
| схема | `{ model: model.$.x, component }` | `{ model: model.$.items, item }` | `{ model: model.$.group, part }` |
| валидация | `validate(model.$.x, rules)` | `applyEach(model.$.items, itemRules)` | `apply(model.$.group, groupRules)` |
| поведение | `compute(model.$.x, …)` | `applyEach(model.$.items, itemBehavior)` | `apply(model.$.group, groupBehavior)` |

**Принято.** Оператор для массива называется `applyEach` в обоих слоях; `each` в валидации
переименовывается.

**Следствия**

- У подформы появляется собственная область: `cross` внутри её правил получает снапшот под-модели,
  а не корня прогона. Сегодня ради этого снапшот захватывают в замыкание.
- Правила элемента массива — такая же схема `({ model }) => …`, как правила подформы. Один набор
  правил можно подключить и к под-модели, и к элементам массива.

**Не решено**

1. Прежний `apply(step1, step2)` — композиция схем над той же моделью — остаётся перегрузкой или
   заменяется прямым вызовом.

### Шаг 6. Одна сборка — согласовано

**Решение.** Раз схема одна, сборка тоже одна. Вместо `createCoreForm`, `createReactForm` и
`createJsonForm` — один вызов, который отдаёт и форму, и дерево для рендера. Хук и рендерер тоже
одни.

```tsx
const credit = useFormBundle(() =>
  createForm<CreditApplicationForm>({
    model: createCreditApplicationModel(),
    schema: creditSchema,
    behavior: creditBehavior,
    validation: creditValidation,
  })
);
// credit = { model, form, validation, render }

// renderer
<FormRenderer form={credit} />
// React-руками
<FormField control={credit.form.loanType} />
```

JSON собирается тем же вызовом: схема передаётся данными вместе с реестром.

```tsx
const credit = useFormBundle(() =>
  createForm({ model, schema: creditJson, registry, behavior, validation })
);
<FormRenderer form={credit} />
```

| Было | Стало |
| --- | --- |
| `createCoreForm` → `{ model, form, validation }` | `createForm` → `{ model, form, validation, render }` |
| `createReactForm` → `{ model, form, validation, render }` | то же |
| `createJsonForm` → `{ model, form, validation, schema, registry }` | то же, схема — данные + `registry` |
| `useFormBundle`, `useReactForm`, `useJsonForm` | `useFormBundle` |
| `FormRenderer`, `JsonFormRenderer` + `JsonRendererProvider` | `FormRenderer` |

**Следствия**

- Три способа отличаются только видом схемы (функция или данные) и тем, кто рисует собранную форму.
- Имя `createForm` сегодня занято низкоуровневой фабрикой, которая возвращает `FormProxy`. Новая
  сборка занимает это имя.

**Не решено**

1. Обёртка поля задаётся по-разному: в TS — `settings.fieldWrapper` у рендерера, в JSON — запись
   реестра `FIELD_WRAPPER`.

### Шаг 7. Одно поведение — согласовано

**Решение.** Поведение модели и поведение рендера объединяются: одна функция, один файл, одно поле
конфига. Рядом с моделью и формой в ней доступна схема. Операторы и условия остаются прежними.

```ts
// form.behavior.ts — единственное поведение формы
export const creditBehavior = defineFormBehavior<CreditApplicationForm>(
  ({ model, form, schema }) => {
    const isMortgage = () => model.loanType === 'mortgage';

    // как сейчас в form.behavior.ts
    compute(model.$.monthlyPayment, () => computeMonthlyPayment(model));
    enableWhen([model.$.propertyValue, model.$.initialPayment], isMortgage, {
      resetOnDisable: true,
    });

    // то, что сейчас живёт в form.render.ts
    hideWhen(schema.node('mortgage'), () => !isMortgage());
    onComponentEvent(schema.node('wizard'), 'onSubmit', async () => {
      await submitCreditApplication(model.get());
    });
    onMount(schema.node('data-boundary'), () => void loadApplication());
  }
);
```

| Было | Стало |
| --- | --- |
| `form.behavior.ts` и `form.render.ts` | `form.behavior.ts` |
| поля конфига `behavior` и `renderBehavior` | `behavior` |
| `({ model, form })` и `(form, model, validation) => (schema) => …` | `({ model, form, schema })` |
| значение в условии: `model.loanType` и `form.loanType.value.value` | `model.loanType` |

**Следствия**

- Условие для `enableWhen` и `hideWhen` можно объявить один раз обычной константой — оба оператора
  стоят рядом. В валидации (`validateWhen`) оно по-прежнему пишется отдельно.
- Операторы обоих видов импортируются из одного места.

**Принято.** В поведении подформы `schema` — узел самой части, так же как `model` и `form` в нём —
под-модель и под-форма. `selector` внутри части относительный, два монтирования не конфликтуют;
вопрос уникальности из шага 4 этим снят.

```ts
const addressBehavior = defineFormBehavior<Address>(({ model, form, schema }) => {
  hideWhen(schema.node('apartment'), () => model.house === ''); // ищется внутри части
});

apply(model.$.registrationAddress, addressBehavior);
apply(model.$.residenceAddress, addressBehavior);
```

**Не решено**

1. Схема без контейнеров (React-руками): обращение к `schema.node(...)` по отсутствующему селектору.

### Шаг 8. Визард без ручной подстановки — согласовано

**Решение.** Визард берёт форму и валидацию из сборки сам. Шаг связан со своими правилами по
`selector`, а не по порядку. Узел визарда — библиотечный компонент, прикладной shim не нужен.
Шаги — обычные дочерние узлы визарда.

```ts
// было
{
  selector: 'wizard',
  component: RendererFormWizard, // прикладной shim, 109 строк
  componentProps: {
    ...(form ? { form } : {}), // форма приходит вторым аргументом билдера
    ...makeCreditValidationConfig(model),
    steps: [{ component: Step, componentProps: { title: 'Кредит', icon: '💰' }, children: [] }],
  },
}

// стало
{
  selector: 'wizard',
  component: FormWizard,
  children: [
    {
      selector: 'loan', // ключ в validation.steps
      component: Step,
      componentProps: { title: 'Кредит', icon: '💰' },
      children: [],
    },
  ],
}

// form.validation.ts — ключ = selector шага
export const creditValidation: FormValidation<CreditApplicationForm> = {
  steps: { loan: loanRules, contacts: contactsRules },
  extras: crossStepRules,
};
```

**Следствия**

- Билдер схемы — снова `(model) => узел`: второй аргумент `form` и двойной вызов билдера не нужны.
  Этим закрыт открытый вопрос шага 6.
- В JSON уходит подстановка формы и валидации через `onInit` + `patchProps` и прикладной
  `wizard.tsx`.
- Перестановка шагов не рассинхронизирует правила.

- Шаги лежат в `children` визарда: дерево устроено одинаково на всех уровнях.

**Не решено**

1. React-руками: `FormWizard` получает `form`, `config` и `steps` пропсами.
2. Шаги JSON в отдельных файлах сегодня подключаются через `$ref`; с шага 4 для этого есть `$part`.

### Шаг 9. Шаблон нового элемента массива — в модели — согласовано

**Решение.** `initialValue` узла массива — это шаблон нового элемента для кнопки «Добавить». Он
переезжает в модель, туда же, где лежат остальные начальные значения. Шаблон объявляется у самого
поля-массива.

```ts
// было — model.ts
properties: [],
export const createBlankProperty = (): Property => ({
  type: 'apartment', description: '', estimatedValue: 0, hasEncumbrance: false,
});
// было — form.schema.ts
{ model: model.$.properties, component: FormArray, item: property, initialValue: createBlankProperty }

// стало — model.ts
properties: arrayOf(blankProperty),
// стало — form.schema.ts
{ model: model.$.properties, component: FormArray, item: property }

// в любом месте
model.properties.push(); // новый элемент по шаблону
model.properties.push(loadedItem); // как сейчас

// вложенный массив — внутри шаблона элемента
const blankCoBorrower = () => ({ phone: '', phones: arrayOf(blankPhone) });
```

```json
{ "model": "$model(properties)", "component": "$component(FormArray)", "item": "$part(property)" }
```

| Узел | Форма |
| --- | --- |
| массив | `{ model, item, component, componentProps }` и необязательный `initialValue` |

**Следствия**

- В JSON-варианте эталона уходят три литерала `initialValue` — 26 строк, которые дублировали
  `model.ts`.
- В React-руками у секции массива пропадает проп `initialValue`.
- Массив как значение одного поля (`tags: []`, мультивыбор) не меняется — шаблон ему не нужен.

**Принято.** `initialValue` в узле остаётся необязательным запасным путём — для форм, у которых
модель создаётся из данных без кода: реестр форм с `initial` по сети, документы конструктора. Он
работает, только если модель шаблона не объявила. Документы конструктора не меняются.

Вариант «шаблоны вторым аргументом `createModel`» отклонён.

### Отклонено как следующие шаги

Предложены и не приняты: правила в узле, условие в узле, модель в схеме, короткая запись узла
(`field(...)`). Эти части контракта остаются как сейчас:

| Что | Где сейчас | Сколько в эталоне |
| --- | --- | --- |
| Правила отдельно от полей | `validation.ts`: константа и вызов на каждое поле | 773 строки |
| Условие в трёх слоях | `enableWhen`, `validateWhen`, `hideWhen` | 5 + 6 + 10 вызовов |
| Начальные значения отдельно | `model.ts` | 159 строк |
| Объектная запись узла | лист 4–11 строк, каркас контейнеров | ≈ 440 строк каркаса из 1012 |

### Факты об эталоне

Строк на таргет: React-руками ≈ 2 810; renderer-react ≈ 1 480 своих + 1 310 общих; renderer-json
≈ 1 650 своих + 1 310 общих. На три таргета вместе ≈ 5 940.

- Одно поле описано в шести файлах: тип, начальные значения, схема, правила, поведение, JSX.
- Три копии формы уже разошлись: в JSON у `carYear` есть `min`/`max`, которых нет в TS; чекбокс
  `sameEmail` и бизнес-поля шага 1 есть только в React-варианте.
- В renderer-вариантах адрес записан дважды целиком (37 × 2 строк в TS, 65 × 2 в JSON); ФИО
  созаёмщика повторяет поля `personalData` во всех вариантах.
- Визард в renderer-вариантах держится на прикладном shim
  ([RendererFormWizard.tsx](../../projects/react-playground/src/components/RendererFormWizard.tsx), 109 строк).
- Пропс и правило — не всегда дубль: у `estimatedValue` пропс `min: 0`, а правило `min(10000)`.
- e2e эталона ждут конкретные тексты ошибок, поэтому сообщения в правилах нельзя просто убрать.

Что выяснила проверка первого захода и пригодится дальше:

- **Условие «поле актуально».** Три механизма в каноне независимы намеренно. Одно объявление
  упирается в: разную композицию условий в валидации и в поведении, политику сброса, `compute` и
  `cross` в свободном коде, отсутствие у ноды состояния «скрыто», проверку модели без формы.
- **Подформа со своей логикой.** `cross` в под-схеме получает снапшот корня прогона, а не
  под-модели; `apply` поведения даёт вложенной части облегчённую модель без `get` / `set`.
- **Киты.** Второй кит покрывает шесть видов полей; эталону нужны ещё маска, радио-группа, загрузка
  файлов, секция массива и визард.
- **Замороженное.** M1 (модель — источник истины), две раздельные схемы — валидации и поведения,
  JSON остаётся чистым JSON со строковыми операторами.

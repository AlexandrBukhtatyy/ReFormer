# JSON Schema

Схема — **чистый JSON** (строковый операторный DSL): все привязки кодируются строками-операторами (`$model(...)`, `$component(...)`, `$dataSource(...)`, `$fn(...)`, `$locale(...)`, `$part(...)`), поэтому документ можно положить в `.json` или принять строкой с сервера/CMS. Голые строки (`label`, `placeholder`) резолвятся как есть. Здесь описан документ формата 2; прежний формат — в конце страницы и в [10-format-2.md](10-format-2.md).

## Key Concepts

- **`JsonFormSchema`** — корневой документ: `format: 2` (обязателен), опциональные `$schema` (путь к мета-схеме для IDE), `id`, `version` (версия содержимого формы — её сверяет реестр форм), `meta`, `parts` (именованные части документа) и единственный корневой узел `root`.
- **`JsonNode`** — узел дерева. Привязка к модели — один ключ `model`; чем является узел, решают соседние ключи:
  - **field-node** (`JsonFieldNode`) — лист: `model: '$model(path)'` + опциональный `component: '$component(Name)'` (дефолт — Input); `disabled: true` создаёт поле отключённым, как у узла поля TS-схемы. Не имеет `children`. Несёт **только layout** — валидаторов в JSON нет, оператора `$validator(...)` не существует. Валидация значений — отдельная TS-схема над моделью, см. [06-validation.md](06-validation.md). Привязка к массиву целиком без `item` — тоже поле (мультивыбор, теги: `"model": "$model(tags)"` для `tags: string[]`).
  - **array-node** (`JsonArrayNode`) — массив под-форм: `model: '$model(path)'` + `item` (вписанный шаблон `{ $template: <JsonNode> }` либо часть `'$part(name)'`) + `component: '$component(FieldArray)'` (редактируемая секция) либо `'$component(List)'` (display-список без add/remove). Без `component` элементы отрисуются, но UI управления не будет — см. ниже.
  - **part-node** (`JsonPartNode`) — подформа: `model: '$model(group)'` + `part: '$part(name)'`. Пути внутри части относительны группе места подключения.
  - **container-node** (`JsonContainerNode`) — контейнер (Box/Section/FormWizard/Step): `component: '$component(Name)'` **или** нативный тег `'$html(div)'` + опциональные `children` (вложенные узлы и текстовые части вперемешку).
- **Операторы** — единственный способ привязки (см. [`operators.ts`](../../src/operators.ts)):
  - `'$model(path)'` — путь к полю/массиву/группе модели. В `model` узла резолвится в ручку модели (`model.signalAt(path)`); в `componentProps` и тексте — в сигнал значения.
  - `'$component(Name)'` — имя компонента в реестре (`reg.component`).
  - `'$html(tag)'` — нативный HTML-тег для презентационной вёрстки без регистрации компонента. Тег проверяется по whitelist (`isAllowedHtmlTag`) и конвертером, и `validateFormSchema`.
  - `'$dataSource(NAME)'` — имя registry-source (`reg.dataSource`): options, константы, loading-компоненты.
  - `'$fn(name)'` — имя функции в реестре (`reg.fn`): форматтеры, компараторы, itemLabel, обработчики. Резолвится в саму функцию (передаётся в проп как есть). Отдельный от `$dataSource` вид — `validateFormSchema` ловит перепутанные `$fn`/`$dataSource`, а `reg.fn` бросает на не-функцию.
  - `'$locale(key)'` — ключ строки для сервиса локализации (`reg.locale`). Резолвится в **строку на этапе сборки** (`registry.getLocale().resolve(key)`); промах ключа / нет сервиса → сам ключ. Только `componentProps` (label/placeholder/title/aria-*) и текст, не структурные позиции. С параметрами — структурная форма `{ "$locale": "key", "params": { … } }` (объект, params — литералы). Реактивный/markdown-текст — компонент `$component(I18n)`, см. [08-i18n.md](08-i18n.md).
  - `'$part(name)'` — именованная часть документа из `parts`: подформа (`part`) или шаблон строки (`item`).
- **`selector`** — plain-строка, id узла для поведения формы (`schema.node('…')`, `hideWhen`, `patchProps`) и шагов потока. **Не** путь модели. В одной области уникален.
- **`componentProps`** — что прокидывается в React-компонент. Значения могут содержать строки-операторы (`'$dataSource(NAME)'`, `'$model(...)'`, `'$component(...)'`, `'$fn(...)'`, `'$locale(...)'`) или вложенные `JsonNode` — конвертер резолвит их рекурсивно. Обычные значения (числа, инлайн-массивы options, `label`) идут как есть.

## Type Guards

Порядок важен: `isArrayNode` проверяй **первым**, затем `isPartNode` — привязку `model` несут и поле, и массив, и подформа. Это гарды JSON-узлов пакета (не путать с гардами нод формы ядра `isFormControl`/`isFormGroup`/`isFormArray`).

```typescript
import {
  isArrayNode,
  isPartNode,
  isFieldNode,
  isContainerNode,
  type JsonNode,
} from '@reformer/renderer-json';

function inspect(node: JsonNode) {
  if (isArrayNode(node)) {
    // node.model: '$model(...)', node.item: { $template } | '$part(name)'
  } else if (isPartNode(node)) {
    // node.model: '$model(...)', node.part: '$part(name)'
  } else if (isFieldNode(node)) {
    // node.model: '$model(...)', node.component?: '$component(...)'
  } else if (isContainerNode(node)) {
    // node.component: '$component(...)' | '$html(...)', node.children?: JsonChild[]
  }
}
```

## HTML-узлы (`$html`) и текст

Заголовки, инфо-плашки, разделители и сводки описываются схемой — регистрировать ради них компонент не нужно:

```json
{
  "component": "$html(div)",
  "componentProps": { "className": "p-4 bg-blue-50 rounded-md" },
  "children": [
    { "component": "$html(h3)", "children": ["$locale(summary.title)"] },
    { "component": "$html(p)", "children": ["Платёж: ", "$model(monthlyPayment)", " ₽"] },
    { "component": "$html(hr)" }
  ]
}
```

- **Текст — элемент `children`**: строка или число рядом с вложенными узлами. Соседние текстовые части склеиваются без разделителя. `'$model(path)'` в тексте даёт **реактивное** значение (рендерер подписывается на сигнал), `'$locale(key)'` — строку каталога, `'$dataSource(name)'` — значение реестра (строку/число/сигнал), если текст живёт не в модели, а в UI-состоянии.
- Текст и узлы идут в том порядке, в каком записаны, поэтому inline-разметка собирается без обёрток — и текст можно поставить **после** узла: `{ "component": "$html(p)", "children": [{ "component": "$html(b)", "children": ["Важно:"] }, " и далее текст"] }`.
- Отдельного поля `text` у узла нет: схемы вида `{ "component": "$html(p)", "text": "…" }` мета-схема отвергает — переносите значение в `children`.
- Для html-узла `componentProps` — это DOM-атрибуты (`className`, `id`, `aria-*`).
- **Безопасность.** JSON-схема — недоверенный вход (может прийти с сервера), поэтому:
  - разрешены только презентационные теги; `script`/`style`/`iframe`/`object`/`embed`/`link`/`meta` и управляющие элементы формы (`form`/`input`/`select`/`button`) — нет (поля описываются field-узлами);
  - из `componentProps` вычищаются `dangerouslySetInnerHTML`, обработчики `on*` и `javascript:`/`vbscript:`/`data:`-URL в `href`/`src` (`data:image/` разрешён);
  - неизвестный тег — ошибка и в `validateFormSchema`, и в конвертере (не молчаливый пропуск).
- Сырой HTML-строкой вставить нельзя by design — разметка всегда описывается деревом узлов.

## Examples

Минимальный документ с одним полем (лист `model` + контейнер `Box`):

```typescript
import { defineJsonSchema } from '@reformer/renderer-json';

const schema = defineJsonSchema<{ email: string }>({
  format: 2,
  root: {
    component: '$component(Box)',
    children: [
      {
        selector: 'email',
        model: '$model(email)',
        component: '$component(Input)',
        componentProps: { label: 'Email' },
      },
    ],
  },
});
```

Вложенный путь к полю и ссылка на dataSource-константу в `componentProps`:

```typescript
{
  model: '$model(personalData.firstName)',
  component: '$component(Input)',
}

{
  model: '$model(loanType)',
  component: '$component(Select)',
  componentProps: { label: 'Тип кредита', options: '$dataSource(LOAN_TYPES)' },
}
```

Функция из реестра (`$fn`) и локализованный текст (`$locale`) в `componentProps`:

```typescript
{
  model: '$model(email)',
  component: '$component(Input)',
  componentProps: {
    label: '$locale(fields.email.label)',        // → строка из сервиса локализации
    placeholder: '$locale(fields.email.placeholder)',
    // `$fn` подставляет функцию по ссылке — но только в проп, который у компонента есть.
    // У `Input` пропа-форматтера нет: значение уйдёт в componentProps и будет проигнорировано.
    // Пример настоящего функционального пропа — `itemLabel` у FieldArray, см. ниже.
  },
}
```

Массив с шаблоном строки (`model` + `item.$template`). Внутри `$template` пути `$model(...)` резолвятся **относительно строки**. `itemLabel` — функция `(row, index) => string`, поэтому идиоматично через `$fn`. Шаблон новой строки для «Добавить» объявляется в модели (`arrayOf(blank)`):

```typescript
{
  selector: 'properties-array',
  model: '$model(properties)',
  component: '$component(FieldArray)',
  componentProps: {
    title: '$locale(properties.title)',
    addButtonLabel: '$locale(properties.add)',
    itemLabel: '$fn(propertyItemLabel)',
  },
  item: {
    $template: {
      component: '$component(Box)',
      componentProps: { className: 'space-y-3' },
      children: [
        { model: '$model(type)', component: '$component(Select)',
          componentProps: { label: 'Тип', options: '$dataSource(PROPERTY_TYPES)' } },
        { model: '$model(estimatedValue)', component: '$component(InputNumber)',
          componentProps: { label: 'Стоимость' } },
      ],
    },
  },
}
```

`initialValue` узла массива — запасной шаблон для формы, чья модель создаётся из данных без кода (шаблон модели главнее); если задан, он обязан нести все ключи строки — это проверяет `validateFormSchema`.

Подформа — именованная часть, подключённая к группе модели (одна часть — сколько угодно мест):

```json
{
  "format": 2,
  "parts": {
    "address": {
      "component": "$component(Box)",
      "children": [{ "model": "$model(city)", "component": "$component(Input)" }]
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

### Display-список: итерация массива через `$component`

Массив рендерится **зарегистрированным компонентом** — он и определяет, редактируемая это секция или display-список. Дисплей-vs-редактирование — выбор компонента, а не отдельный тип узла:

- **`component: '$component(FieldArray)'`** → редактируемая секция с кнопками «Добавить»/«Удалить»/↑↓ (новая строка — из шаблона модели `arrayOf(blank)`);
- **`component: '$component(List)'`** → chrome-less display-список (`List` из `@reformer/ui-kit`): без add/remove. Для списков, которые не редактируются, а показываются/скрываются мутацией массива в поведении (алерты, бейджи).
- **без `component`** → безхромный fallback: элементы отрисуются, но UI управления не будет (плюс предупреждение в консоли). Практически всегда это ошибка — укажи `component`.

Итерацию и области строк делает рендерер; компонент получает готовые элементы пропом `items` (`{ key, index, model, children }`) и колбэки `onAdd`/`onRemove`/`onMove`. Внутри `$template` пути `$model(...)` резолвятся относительно строки, а `$model(...)` в `componentProps` элемента доходит до компонента **значением** (рендерер разворачивает сигнал):

```typescript
{
  selector: 'alerts-list',
  model: '$model(alerts)',           // массив объектов в модели
  component: '$component(List)',     // рендер — ui-kit List (без add/remove)
  componentProps: { className: 'space-y-2' },
  item: {
    $template: {
      component: '$component(Alert)',                 // display-компонент элемента
      componentProps: { type: '$model(type)', message: '$model(message)' },
    },
  },
}
```

Реестр: `reg.component('List', List)` (`@reformer/ui-kit`) + `reg.component('Alert', Alert)`. Показ/скрытие — мутация массива `alerts` в `defineFormBehavior` (`push`/`removeAt`/`clear`); список ре-рендерится реактивно.

## Прежний формат

Документ без `format: 2` использует ключи `value` (поле) и `array` (массив), а шаги визарда держит в `componentProps.steps`; частей (`parts`) в нём нет. Его типы и гарды носят суффикс `V1` (`JsonFormSchemaV1`, `JsonFieldNodeV1`, `isFieldNodeV1`, `defineJsonSchemaV1`), собирает его `createJsonForm`. `migrateJsonSchema(document)` переводит его в формат 2. Ключ `value` в документе формата 2 мета-схема отвергает (`unknown property "value"`).

## Anti-patterns

- **Голые строки вместо операторов** — `component: 'Input'` или `model: 'email'` не резолвятся. Нужны операторы: `component: '$component(Input)'`, `model: '$model(email)'`. Template-literal типы (`ModelOp`/`ComponentOp`) отловят это на этапе компиляции.
- **Использовать `selector` как путь к полю** — `selector` это id для поведения и шагов; путь задаётся только через `model` оператором `$model(...)`.
- **Забыть `item` у массива** — без `item` узел с `model` на массив — это поле (значение массива целиком), а не массив под-форм.
- **`part` на поле** — подформа подключается к объекту модели; на поле сборка бросает `"$model(x)" is not a group of the model`.
- **`initialValue` как FieldConfig** — это plain-литерал по форме элемента (`{ field: value }`), а не `{ value, component }`. Клонируется через `JSON.parse(JSON.stringify(...))`, поэтому только сериализуемые значения. Обычно он вообще не нужен — шаблон в модели (`arrayOf(blank)`).
- **Ссылаться на `$dataSource(NAME)` без регистрации** — `validateFormSchema` даст ошибку; без проверки строка просто прокинется как есть (молчаливый баг).
- **Класть `validators` в field-node** — `JsonFieldNode` несёт только layout, поля `validators` в нём нет и оператора `$validator(...)` не существует. Валидация значений живёт в отдельной схеме над моделью (`defineValidation` из `@reformer/core/validation`), а не в JSON — см. [06-validation.md](06-validation.md).
- **Путать `$fn` и `$dataSource`** — функции регистрируй через `reg.fn` и ссылайся через `$fn(name)`, данные — через `reg.dataSource`/`$dataSource(NAME)`. Перекрёстное использование (`$fn(LOAN_TYPES)`, `$dataSource(comparator)`) `validateFormSchema` отклонит, а рантайм бросит. `reg.fn` дополнительно бросает при регистрации не-функции.
- **Аргументы у `$fn`** — оператор передаёт функцию **по ссылке**; биндинга аргументов (`$fn(format, 2)`) нет. Нужен предзаданный аргумент — зарегистрируй уже связанную функцию через `reg.fn`.
- **`$locale` для reactive-переключения языка** — ключ резолвится в строку **на этапе сборки** (иначе signal уронил бы строковые компоненты). Смена языка = новый сервис в `reg.locale` + пересборка формы, а не «живое» обновление. Для live-переключения и markdown/rich — компонент `$component(I18n)` + `LocaleProvider`, см. [08-i18n.md](08-i18n.md).
- **Динамический/составной ключ `$locale`** — ключ это статичный литерал (`$locale(fields.email.label)`); вложить в него `$model(...)`/выражение нельзя. При наличии каталога опечатка ключа ловится `validateFormSchema`; без каталога промах молча деградирует до самого ключа.
- **Регистрировать компонент ради статичного блока** — `reg.component('InfoBlock', …)` для абзаца с текстом заменяется узлом `$html(div)`/`$html(p)` с текстом в `children`. Компонент нужен, когда есть своя логика или состояние.
- **`$component(div)` вместо `$html(div)`** — нативные теги живут в отдельном операторе и через реестр не резолвятся: `$component(div)` даст `unknown component "div"`.
- **Ждать от `$html` произвольной разметки** — оператор принимает ОДИН тег (`$html(div)`), а не HTML-фрагмент. Вложенность описывается `children`.

## See also

- [01-overview.md](01-overview.md) — сборка `createForm` из документа и реестра.
- [03-registry.md](03-registry.md) — какие компоненты и source можно зарегистрировать.
- [05-cookbook.md](05-cookbook.md) — шаблоны строк, dataSource-функции, миграция из TS-схемы.
- [06-validation.md](06-validation.md) — валидация значений (TS-схема над моделью + поток шагов).
- [10-format-2.md](10-format-2.md) — части документа, шаги визарда, перевод прежнего формата.
- [Типы JsonFormSchema/JsonNode](../../src/types/json-schema.ts) и [операторы](../../src/operators.ts).

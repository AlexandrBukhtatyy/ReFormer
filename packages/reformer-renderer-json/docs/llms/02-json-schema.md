# JSON Schema

Схема — **чистый JSON** (M1, строковый операторный DSL): все привязки кодируются строками-операторами (`$model(...)`, `$component(...)`, `$dataSource(...)`, `$fn(...)`, `$locale(...)`), поэтому схему можно положить в `.json` или принять строкой с сервера/CMS. Голые строки (`label`, `placeholder`) резолвятся как есть.

## Key Concepts

- **`JsonFormSchema`** — корневой документ: `version` (для миграций), опциональный `$schema` (путь к мета-схеме для IDE), единственный корневой узел `root`.
- **`JsonNode`** — узел дерева. Дискриминированный union по строке-оператору, которую он несёт:
  - **field-node** (`JsonFieldNode`) — лист: `value: '$model(path)'` + опциональный `component: '$component(Name)'` (дефолт — Input). Не имеет `children`. Несёт **только layout** — валидаторов в JSON нет, оператора `$validator(...)` не существует. Валидация значений — отдельная TS-схема над моделью, см. [06-validation.md](06-validation.md).
  - **array-node** (`JsonArrayNode`) — массив: `array: '$model(path)'` + `item: { $template: <JsonNode> }` + опциональный `initialValue` (литерал нового элемента для кнопки «Добавить»).
  - **container-node** (`JsonContainerNode`) — контейнер (Box/Section/Wizard/Step): `component: '$component(Name)'` **или** нативный тег `'$html(div)'` + опциональные `children` и `text`.
- **Операторы** — единственный способ привязки (см. [`operators.ts`](../../src/operators.ts)):
  - `'$model(path)'` — путь к полю/массиву модели (лист → `model.signalAt(path)`, массив → value-прокси массива).
  - `'$component(Name)'` — имя компонента в реестре (`reg.component`).
  - `'$html(tag)'` — нативный HTML-тег для презентационной вёрстки без регистрации компонента. Тег проверяется по whitelist (`isAllowedHtmlTag`) и конвертером, и `validateFormSchema`.
  - `'$dataSource(NAME)'` — имя registry-source (`reg.dataSource`): options, itemLabel, константы, loading-компоненты.
  - `'$fn(name)'` — имя функции в реестре (`reg.fn`): форматтеры, компараторы, itemLabel, обработчики. Резолвится в саму функцию (передаётся в проп как есть). Отдельный от `$dataSource` вид — `validate` ловит перепутанные `$fn`/`$dataSource` и `reg.fn` бросает на не-функцию.
  - `'$locale(key)'` — ключ строки для сервиса локализации (`reg.locale`). Резолвится в **строку на этапе конвертации** (`registry.getLocale().resolve(key)`); промах ключа / нет сервиса → сам ключ. Только `componentProps` (label/placeholder/title/aria-*), не структурные позиции. С параметрами — структурная форма `{ "$locale": "key", "params": { … } }` (объект, params — литералы). Реактивный/markdown-текст — компонент `$component(I18n)`, см. [08-i18n.md](08-i18n.md).
- **`selector`** — plain-строка, id узла для render-behavior (`schema.node('…')`, `hideWhen`, `patchProps`). **Не** путь модели.
- **`componentProps`** — что прокидывается в React-компонент. Значения могут содержать строки-операторы (`'$dataSource(NAME)'`, `'$model(...)'`, `'$component(...)'`, `'$fn(...)'`, `'$locale(...)'`) или вложенные `JsonNode` — конвертер резолвит их рекурсивно. Обычные значения (числа, инлайн-массивы options, `label`) идут как есть.

## Type Guards

Порядок важен: `isArrayNode` проверяй **первым** (array-node тоже несёт `$model`, но в поле `array`).

```typescript
import { isArrayNode, isFieldNode, isContainerNode, type JsonNode } from '@reformer/renderer-json';

function inspect(node: JsonNode) {
  if (isArrayNode(node)) {
    // node.array: '$model(...)', node.item.$template: JsonNode
  } else if (isFieldNode(node)) {
    // node.value: '$model(...)', node.component?: '$component(...)'
  } else if (isContainerNode(node)) {
    // node.component: '$component(...)' | '$html(...)', node.children?: JsonNode[]
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
    { "component": "$html(h3)", "text": "$locale(summary.title)" },
    { "component": "$html(p)", "text": ["Платёж: ", "$model(monthlyPayment)", " ₽"] },
    { "component": "$html(hr)" }
  ]
}
```

- **`text`** — литерал (строка/число), оператор или массив частей (склеивается без разделителя). `'$model(path)'` в тексте даёт **реактивное** значение (рендерер подписывается на сигнал), `'$locale(key)'` — строку каталога.
- `text` рендерится **перед** `children`, поэтому inline-разметка собирается без обёрток: `{ "component": "$html(p)", "text": "Внимание! ", "children": [{ "component": "$html(b)", "text": "…" }] }`.
- Для html-узла `componentProps` — это DOM-атрибуты (`className`, `id`, `aria-*`).
- **Безопасность.** JSON-схема — недоверенный вход (может прийти с сервера), поэтому:
  - разрешены только презентационные теги; `script`/`style`/`iframe`/`object`/`embed`/`link`/`meta` и управляющие элементы формы (`form`/`input`/`select`/`button`) — нет (поля описываются field-узлами);
  - из `componentProps` вычищаются `dangerouslySetInnerHTML`, обработчики `on*` и `javascript:`/`vbscript:`/`data:`-URL в `href`/`src` (`data:image/` разрешён);
  - неизвестный тег — ошибка и в `validateFormSchema`, и в конвертере (не молчаливый пропуск).
- Сырой HTML-строкой вставить нельзя by design — разметка всегда описывается деревом узлов.

## Examples

Минимальная схема с одним полем (лист `value` + контейнер `Box`):

```typescript
import type { JsonFormSchema } from '@reformer/renderer-json';

const schema: JsonFormSchema = {
  version: '1.0',
  root: {
    component: '$component(Box)',
    children: [
      {
        selector: 'email',
        value: '$model(email)',
        component: '$component(Input)',
        componentProps: { label: 'Email' },
      },
    ],
  },
};
```

Вложенный путь к полю и ссылка на dataSource-константу в `componentProps`:

```typescript
{
  value: '$model(personalData.firstName)',
  component: '$component(Input)',
}

{
  value: '$model(loanType)',
  component: '$component(Select)',
  componentProps: { label: 'Тип кредита', options: '$dataSource(LOAN_TYPES)' },
}
```

Функция из реестра (`$fn`) и локализованный текст (`$locale`) в `componentProps`:

```typescript
{
  value: '$model(email)',
  component: '$component(Input)',
  componentProps: {
    label: '$locale(fields.email.label)',        // → строка из сервиса локализации
    placeholder: '$locale(fields.email.placeholder)',
    format: '$fn(formatEmail)',                   // → сама функция из reg.fn, передаётся в проп
  },
}
```

Массив с шаблоном элемента (`array` + `item.$template` + `initialValue`). Внутри `$template` пути `$model(...)` резолвятся **относительно элемента** массива. `itemLabel` — функция `(control, index) => string`, поэтому идиоматично через `$fn`:

```typescript
{
  selector: 'properties-array',
  array: '$model(properties)',
  initialValue: { type: 'apartment', description: '', estimatedValue: 0, hasEncumbrance: false },
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
        { value: '$model(type)', component: '$component(Select)',
          componentProps: { label: 'Тип', options: '$dataSource(PROPERTY_TYPES)' } },
        { value: '$model(estimatedValue)', component: '$component(Input)',
          componentProps: { label: 'Стоимость', type: 'number' } },
      ],
    },
  },
}
```

## Anti-patterns

- **Голые строки вместо операторов** — `component: 'Input'` или `value: 'email'` не резолвятся. Нужны операторы: `component: '$component(Input)'`, `value: '$model(email)'`. Template-literal типы (`ModelOp`/`ComponentOp`) отловят это на этапе компиляции.
- **Использовать `selector` как путь к полю** — `selector` это id для behavior; путь задаётся только через `value`/`array` оператором `$model(...)`.
- **Забыть `item.$template` у массива** — array-node требует `array` **и** `item: { $template }`. Без `$template` `isArrayNode` вернёт false и узел не отрендерится как массив.
- **`initialValue` как FieldConfig** — это plain-литерал по форме элемента (`{ field: value }`), а не `{ value, component }`. Клонируется через `JSON.parse(JSON.stringify(...))`, поэтому только сериализуемые значения.
- **Ссылаться на `$dataSource(NAME)` без регистрации** — при `validate` неизвестное имя даст ошибку; без валидации строка просто прокинется как есть (молчаливый баг).
- **Класть `validators` в field-node** — `JsonFieldNode` несёт только layout, поля `validators` в нём нет и оператора `$validator(...)` не существует. Валидация значений живёт в отдельной TS-схеме над моделью (`validateFormModel`), а не в JSON — см. [06-validation.md](06-validation.md).
- **Путать `$fn` и `$dataSource`** — функции регистрируй через `reg.fn` и ссылайся через `$fn(name)`, данные — через `reg.dataSource`/`$dataSource(NAME)`. Перекрёстное использование (`$fn(LOAN_TYPES)`, `$dataSource(comparator)`) `validateFormSchema` отклонит, а рантайм бросит. `reg.fn` дополнительно бросает при регистрации не-функции.
- **Аргументы у `$fn`** — оператор передаёт функцию **по ссылке**; биндинга аргументов (`$fn(goToStep, 2)`) нет. Нужен предзаданный аргумент — зарегистрируй уже связанную функцию через `reg.fn`.
- **`$locale` для reactive-переключения языка** — ключ резолвится в строку **на этапе конвертации** (иначе signal уронил бы строковые компоненты). Смена языка = новый сервис в `reg.locale` + пересборка дерева, а не «живое» обновление. Для live-переключения и markdown/rich — компонент `$component(I18n)` + `LocaleProvider`, см. [08-i18n.md](08-i18n.md).
- **Динамический/составной ключ `$locale`** — ключ это статичный литерал (`$locale(fields.email.label)`); вложить в него `$model(...)`/выражение нельзя. При наличии каталога опечатка ключа ловится на `validate`; без каталога промах молча деградирует до самого ключа.
- **Регистрировать компонент ради статичного блока** — `reg.component('InfoBlock', …)` для абзаца с текстом заменяется узлом `$html(div)`/`$html(p)` + `text`. Компонент нужен, когда есть своя логика или состояние.
- **`$component(div)` вместо `$html(div)`** — нативные теги живут в отдельном операторе и через реестр не резолвятся: `$component(div)` даст `unknown component "div"`.
- **Ждать от `$html` произвольной разметки** — оператор принимает ОДИН тег (`$html(div)`), а не HTML-фрагмент. Вложенность описывается `children`.

## See also

- [01-overview.md](01-overview.md) — как схема монтируется через `model` + `JsonRendererProvider`.
- [03-registry.md](03-registry.md) — какие компоненты и source можно зарегистрировать.
- [05-cookbook.md](05-cookbook.md) — `$template`, dataSource-функции, миграция из TS RenderSchema.
- [06-validation.md](06-validation.md) — валидация значений (TS-схема над моделью + инъекция в wizard).
- [Типы JsonFormSchema/JsonNode](../../src/types/json-schema.ts) и [операторы](../../src/operators.ts).

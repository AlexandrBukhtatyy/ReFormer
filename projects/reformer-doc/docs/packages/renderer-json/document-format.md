---
title: 'Формат документа'
sidebar_label: 'Формат документа'
---

# Формат документа

JSON-документ — схема формы данными. Это то же дерево узлов, что и схема на TypeScript, только
ссылки на модель, компоненты и данные записаны строками-операторами: `$model(email)`,
`$component(Input)`, `$dataSource(LOAN_TYPES)`. Строка без оператора — просто значение.

## Пример

```json title="profile.schema.json"
{
  "format": 2,
  "id": "profile",
  "version": "1.2.0",
  "root": {
    "component": "$component(Section)",
    "componentProps": { "title": "Профиль" },
    "children": [
      {
        "model": "$model(email)",
        "component": "$component(Input)",
        "componentProps": { "label": "Email", "placeholder": "you@example.com" }
      },
      {
        "model": "$model(country)",
        "component": "$component(Select)",
        "componentProps": { "label": "Страна", "options": "$dataSource(COUNTRIES)" }
      }
    ]
  }
}
```

## Корень документа

| Ключ      | Обязателен | Что это                                                                                                            |
| --------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| `format`  | да         | формат документа, всегда `2`                                                                                       |
| `root`    | да         | корневой узел                                                                                                      |
| `parts`   | нет        | именованные части документа — см. [Массивы, части и шаги](./arrays-and-parts.md)                                   |
| `id`      | нет        | идентификатор формы; его сверяет [реестр форм](../form-registry.md)                                                |
| `version` | нет        | версия содержимого формы (не формата); её тоже сверяет реестр форм                                                 |
| `meta`    | нет        | `name`, `description` — для каталогов и интерфейсов                                                                |
| `$schema` | нет        | путь к мета-схеме: редактор подсветит ошибки — см. [Проверка документа](./document-check.md#подсказки-в-редакторе) |

Других ключей на верхнем уровне нет: правил, поведения и текстов замечаний в документе не бывает.

## Узлы

Привязка к модели — один ключ `model`. Чем является узел, решают соседние ключи:

| Узел            | Ключи                            | Пример                                                                            |
| --------------- | -------------------------------- | --------------------------------------------------------------------------------- |
| поле            | `model` + `component`            | `{ "model": "$model(email)", "component": "$component(Input)" }`                  |
| массив под-форм | `model` + `item` (+ `component`) | `{ "model": "$model(phones)", "component": "$component(FieldArray)", "item": … }` |
| подформа        | `model` + `part`                 | `{ "model": "$model(address)", "part": "$part(address)" }`                        |
| контейнер       | `component` (+ `children`)       | `{ "component": "$component(Section)", "children": [] }`                          |

Узел распознаётся в этом порядке: массив (`item`) → подформа (`part`) → поле (`model`) →
контейнер. Те же проверки — гарды `isArrayNode`, `isPartNode`, `isFieldNode`, `isContainerNode`.

Общие ключи узлов:

| Ключ             | Узлы           | Что задаёт                                                          |
| ---------------- | -------------- | ------------------------------------------------------------------- |
| `selector`       | все            | имя узла для поведения и шагов потока; обычная строка, не оператор  |
| `componentProps` | кроме подформы | пропсы компонента; значения могут быть операторами                  |
| `disabled`       | поле           | постоянная блокировка поля — как у узла поля на TypeScript          |
| `wrapper`        | поле           | своя обёртка этого поля: `{ "component": "$component(MyWrapper)" }` |
| `children`       | контейнер      | вложенные узлы и текст                                              |

Массив модели без `item` — одно поле со значением-массивом: теги, мультивыбор, файлы.

## Операторы

Оператор — строка целиком вида `$имя(аргумент)`. Других способов сослаться на код нет. Набор
операторов закрыт; свои строки вида `$имя(аргумент)` разворачивают до сборки — см.
[Свои операторы](./custom-operators.md).

| Оператор            | Где                              | Во что превращается                                              |
| ------------------- | -------------------------------- | ---------------------------------------------------------------- |
| `$model(path)`      | `model`, `componentProps`, текст | в `model` — сигнал поля; в пропсах и тексте — его значение       |
| `$component(Name)`  | `component`, `wrapper`           | компонент из реестра (`reg.component`)                           |
| `$html(tag)`        | `component` контейнера           | HTML-тег из разрешённого списка; регистрировать не нужно         |
| `$dataSource(NAME)` | `componentProps`, текст          | значение из реестра (`reg.dataSource`): опции, константа, сигнал |
| `$fn(name)`         | `componentProps`                 | функция из реестра (`reg.fn`), передаётся ссылкой                |
| `$locale(key)`      | `componentProps`, текст          | строка из сервиса локализации (`reg.locale`)                     |
| `$part(name)`       | `part`, `item`                   | часть документа из `parts`                                       |

Пути в `$model(...)` пишутся через точку: `$model(personalData.firstName)`. Внутри шаблона строки
массива и части документа путь считается от строки или группы — см.
[Массивы, части и шаги](./arrays-and-parts.md).

Три структурные записи — объекты, а не строки:

| Запись                                        | Где                | Зачем                               |
| --------------------------------------------- | ------------------ | ----------------------------------- |
| `{ "$locale": "key", "params": { … } }`       | `componentProps`   | локализованная строка с параметрами |
| `{ "$template": узел }`                       | `item` массива     | шаблон строки прямо на месте        |
| `{ "$ref": "./steps/loan/form.schema.json" }` | `children` мастера | шаг из отдельного файла             |

### Операторы в пропсах

Значения `componentProps` разбираются рекурсивно — во вложенных объектах и массивах тоже. Обычные
значения (числа, массивы опций, `label`) идут как есть:

```json
{
  "model": "$model(loanType)",
  "component": "$component(Select)",
  "componentProps": {
    "label": "$locale(fields.loanType)",
    "options": "$dataSource(LOAN_TYPES)",
    "clearable": true
  }
}
```

Строка с параметрами — структурная запись `$locale`. Параметры — литералы:

```json
{
  "model": "$model(password)",
  "component": "$component(Input)",
  "componentProps": { "label": { "$locale": "fields.password.min", "params": { "count": 8 } } }
}
```

Где брать компоненты, данные, функции и строки — на странице [Реестр](./registry.md).

## HTML-узлы и текст

Заголовки, плашки и сводки описываются в документе — регистрировать ради них компоненты не нужно:

```json
{
  "component": "$html(div)",
  "componentProps": { "className": "rounded-md bg-blue-50 p-4" },
  "children": [
    { "component": "$html(h3)", "children": ["$locale(summary.title)"] },
    { "component": "$html(p)", "children": ["Платёж: ", "$model(monthlyPayment)", " ₽"] },
    { "component": "$html(hr)" }
  ]
}
```

- Ребёнок контейнера — узел либо текст: строка или число. Соседние части склеиваются без
  разделителя.
- `$model(...)` в тексте обновляется вместе со значением. `$locale(...)` даёт строку каталога,
  `$dataSource(...)` — значение из реестра (например, сигнал со статусом отправки).
- У HTML-узла `componentProps` — DOM-атрибуты: `className`, `id`, `aria-*`.
- Вычислений в документе нет. «Платёж = сумма / срок» считает поведение формы (`compute`), а текст
  показывает готовое поле модели.

Документ может прийти из недоверенного источника, поэтому:

- разрешены только теги вёрстки и текста. `script`, `style`, `iframe`, `object`, `embed`, `link`,
  `meta` и элементы формы (`form`, `input`, `select`, `button`) запрещены — поля описываются узлами
  полей;
- из `componentProps` HTML-узла удаляются `dangerouslySetInnerHTML`, обработчики `on*` и адреса
  `javascript:`, `vbscript:`, `data:` в `href` и `src` (картинки `data:image/` разрешены);
- оператор принимает один тег, а не HTML-фрагмент. Неизвестный тег — ошибка и при сборке, и при
  проверке документа.

Полный список тегов — константа `ALLOWED_HTML_TAGS`.

## Типизация в TypeScript

Документ, написанный в коде, типизирует `defineJsonSchema<T>`: пути `$model(...)` сужаются до путей
формы `T`, и опечатка `$model(emial)` становится ошибкой компиляции.

```ts
import { defineJsonSchema } from '@reformer/renderer-json';

type Profile = { email: string; country: string };

export const profileSchema = defineJsonSchema<Profile>({
  format: 2,
  root: {
    component: '$component(Section)',
    children: [{ model: '$model(email)', component: '$component(Input)' }],
  },
});
```

Документ из файла или с сервера типа не знает — его приводят:
`raw as unknown as JsonFormSchema<Profile>`. Пути внутри шаблонов строк и частей не типизируются:
они считаются от строки или группы.

## Подводные камни

- **Голая строка вместо оператора** — `"component": "Input"`, `"model": "email"` не разбираются.
  Нужно `"$component(Input)"`, `"$model(email)"`.
- **Поле без `component` ничего не рисует** — в консоли предупреждение `Model field has no
component`. Указывайте компонент у каждого поля.
- **`$component(div)` вместо `$html(div)`** — теги через реестр не ищутся: `Component "div" not
found in registry`.
- **`selector` — не путь к полю.** Путь задаётся только `$model(...)`.
- **`componentProps.disabled` не блокирует поле.** Доступность — состояние ноды: ключ `disabled`
  узла или `disable()` в поведении.
- **Аргументов у `$fn` нет** — `$fn(format, 2)` не сработает. Нужна функция с готовым аргументом —
  зарегистрируйте её. Аргумент из документа передаёт [свой оператор](./custom-operators.md).
- **Ключ `$locale` — литерал.** Собрать его из `$model(...)` нельзя.
- **`The document is in the previous JSON schema format`** — у документа нет `format: 2`. Его
  переводит `migrateJsonSchema(document)`; функция чистая и документ формата 2 возвращает как есть.

## См. также

- [Реестр](./registry.md) — откуда берутся компоненты, данные, функции и строки.
- [Массивы, части и шаги](./arrays-and-parts.md) — `item`, `parts`, мастер.
- [Проверка документа](./document-check.md) — `validateFormSchema` и мета-схема.
- [Вёрстка в renderer-react](../renderer-react/layout.md) — те же контейнеры и текст в схеме на TypeScript.

---
sidebar_position: 2
---

# Схема формы

[Схема формы](/docs/reference/glossary) — дерево узлов: какие поля есть, к какому полю модели
привязан каждый узел и каким компонентом он рисуется. Значений схема не хранит — они в
[модели](../model.mdx). Правил в ней нет — они в [схеме валидации](./validation-schema.md).

## Когда нужно

Схема нужна каждой форме, которую собирает `createForm`. По ней сборка узнаёт компонент и пропсы
каждого поля. Дальше форму можно нарисовать двумя способами:

- `FormRenderer` из `@reformer/renderer-react` обходит дерево и рисует форму целиком;
- в JSX вы ставите `<FormField control={form.email} />`, и он берёт компонент и пропсы из узла.

## Минимальный пример

```typescript
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { Input, Section } from '@reformer/ui-kit';

type Profile = { name: string; email: string };

// Схема — функция от модели: узлы держат сигналы её полей.
const profileSchema = (model: FormModel<Profile>): FormSchemaNode => ({
  children: [
    { model: model.$.name, component: Input, componentProps: { label: 'Имя' } },
    {
      component: Section,
      componentProps: { title: 'Связь' },
      children: [{ model: model.$.email, component: Input, componentProps: { label: 'Email' } }],
    },
  ],
});

const profile = createForm<Profile>({ initial: { name: '', email: '' }, schema: profileSchema });
```

Схему передают функцией `(model) => узел`, а не готовым деревом: узлы ссылаются на
[сигналы полей](/docs/reference/glossary) модели, поэтому дерево строится после неё.

## Виды узлов

Вид узла определяют его ключи:

| Вид          | Ключи                                      | Пример                                                   |
| ------------ | ------------------------------------------ | -------------------------------------------------------- |
| поле         | `model` — сигнал поля или массива целиком  | `{ model: model.$.email, component: Input }`             |
| массив строк | `model` — сигнал массива и `item`          | `{ model: model.$.phones, component: FieldArray, item }` |
| подформа     | `model` — сигнал группы и `part`           | `{ model: model.$.address, part: addressPart }`          |
| контейнер    | `children` (и/или `component` без `model`) | `{ component: Section, children: [...] }`                |

Всем видам доступны `component`, `componentProps` и `selector`. Вложенные узлы читаются только из
`children` и из `part`; внутрь `componentProps` сборка не заглядывает.

## Узел поля

| Ключ             | Что задаёт                                                      |
| ---------------- | --------------------------------------------------------------- |
| `model`          | сигнал поля: `model.$.email` — обязателен                       |
| `component`      | компонент поля                                                  |
| `componentProps` | пропсы компонента: `label`, `placeholder`, `options`, `type`, … |
| `disabled`       | постоянная блокировка поля — см. ниже                           |
| `selector`       | имя узла: по нему узел находят поведение и шаги потока          |

```typescript
import { CheckboxWithLabel, InputNumber, SelectAsync } from '@reformer/ui-kit';

const children = [
  { model: model.$.age, component: InputNumber, componentProps: { label: 'Возраст' } },
  { model: model.$.agree, component: CheckboxWithLabel, componentProps: { label: 'Согласен' } },
  {
    model: model.$.status,
    component: SelectAsync,
    componentProps: {
      label: 'Статус',
      options: [
        { value: 'active', label: 'Активен' },
        { value: 'inactive', label: 'Неактивен' },
      ],
    },
  },
];
```

### `disabled` узла — постоянная блокировка

`disabled: true` блокирует поле насовсем — так помечают вычисляемые поля (`total`, `fullName`).
Выключение и включение всей формы или группы (`form.disable()` → `form.enable()`, например на время
отправки) такое поле не разблокирует. Снять блокировку может только `enable()` самого поля или
`enableWhen` на нём.

`componentProps.disabled` — другое: это проп компонента, на состояние ноды он не влияет.

## Контейнеры и текст

Контейнер — узел с `children`: секция, шаг мастера, HTML-тег. Его `component` — компонент
(`Section`) или имя тега (`'div'`, `'h3'`); без `component` контейнер просто рисует детей. Ребёнком
может быть и текст — строка, число или сигнал модели.

```typescript
const contactsSchema = (model: FormModel<Contacts>): FormSchemaNode => ({
  children: [
    { component: 'h2', children: ['Контакты'] },
    {
      component: Section,
      componentProps: { title: 'Связь' },
      children: [
        { model: model.$.phone, component: Input, componentProps: { label: 'Телефон' } },
        { model: model.$.email, component: Input, componentProps: { label: 'Email' } },
      ],
    },
  ],
});
```

Узел по условию вставляют так: `...(withPhone ? [phoneNode] : [])`. Пустые места — `null`,
`undefined`, `false` — сборка пропускает.

## Вложенные группы и подформы

Поля вложенной группы привязывают по пути: `model.$.address.city`. Если группа повторяется (два
адреса), её разметку выносят в подформу — функцию над моделью группы — и подключают узлом
`{ model: model.$.<группа>, part }`:

```typescript
type Address = { city: string; zip: string };

const addressPart = (m: FormModel<Address>): FormSchemaNode => ({
  children: [
    { model: m.$.city, component: Input, componentProps: { label: 'Город' } },
    { model: m.$.zip, component: Input, componentProps: { label: 'Индекс' } },
  ],
});

const userSchema = (model: FormModel<User>): FormSchemaNode => ({
  children: [
    { model: model.$.registrationAddress, part: addressPart },
    { model: model.$.residenceAddress, part: addressPart },
  ],
});
```

Как подключить к той же группе правила и поведение — в
[Повторяющихся группах](./composition.md).

## Массивы

Массив объектов, у строк которого свои поля, описывают узлом `{ model, component: FieldArray, item }`.
`item` — функция над моделью строки. Шаблон новой строки задают в модели функцией `arrayOf`:

```typescript
import { arrayOf, createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { FieldArray, Input, InputNumber } from '@reformer/ui-kit';

type Item = { name: string; price: number };

const itemRow = (row: FormModel<Item>): FormSchemaNode => ({
  children: [
    { model: row.$.name, component: Input, componentProps: { label: 'Название' } },
    { model: row.$.price, component: InputNumber, componentProps: { label: 'Цена' } },
  ],
});

const { form } = createForm<{ items: Item[] }>({
  initial: { items: arrayOf((): Item => ({ name: '', price: 0 })) },
  schema: (model) => ({
    children: [{ model: model.$.items, component: FieldArray, item: itemRow }],
  }),
});

form.items; // FormArray<Item>
```

Массив простых значений — теги, мультивыбор, файлы — одно значение поля. Его привязывают целиком,
без `item`, и он становится нодой `FormControl<string[]>`:

```typescript
{ model: model.$.tags, component: SelectMulti, componentProps: { label: 'Теги', options: TAGS } }
```

Если модель создаётся из данных без кода (JSON), шаблон строки можно задать ключом узла
`initialValue`. Шаблон `arrayOf` из модели главнее. Подробнее — в
[Массивах и динамических формах](/docs/patterns/arrays).

## `selector` — имя узла

`selector` даёт узлу имя. По нему узел находят поведение (`schema.node('mortgage')` для `hideWhen`,
`onComponentEvent`) и шаги потока (`flow.steps[].id` совпадает с `selector` узла шага).

```typescript
{
  selector: 'mortgage',
  component: Section,
  componentProps: { title: 'Ипотека' },
  children: [/* … */],
}
```

## Подводные камни

- **Правил в узле нет.** Ключа для правил у узла нет, и тип `FormSchemaNode` не пропустит лишний
  ключ: опечатка в имени ключа — ошибка компиляции.
- **Привязка — через `$`.** `model: model.$.email`, а не `model: model.email`: второе не
  скомпилируется.
- **Группа полем не бывает.** Узел с сигналом группы требует `part`: `{ model: model.$.address,
component: Input }` — ошибка.
- **Дети — только в `children`.** Узлы, положенные в `componentProps`, сборка не увидит.
- **`selector` уникален в своей области** — в корне, в строке массива, в подформе. Повтор бросает
  исключение при сборке.
- **`componentProps.disabled` не блокирует поле.** Для вычисляемого поля нужен `disabled: true` в
  самом узле.

## Для авторов рендереров

Сборка один раз разбирает дерево в скомпилированную схему — `CompiledSchema`. У каждого узла в ней
вид (`field`, `array`, `part`, `container`, `text`), идентификатор (`selector` либо позиция вида
`#/0/2`) и область. Её читают и ноды формы, и рендереры; доступна как `bundle.render.tree`. Без
сборки дерево разбирает `compileSchema(tree, model)`.

## См. также

- [Ноды формы](../nodes.md) — что сборка строит по схеме.
- [Схема валидации](./validation-schema.md) — правила отдельно от разметки.
- [Схема поведения](./behavior-schema.md) — `hideWhen` и события узлов по `selector`.
- [Повторяющиеся группы](./composition.md) — `part` и `item` вместе с правилами и поведением.

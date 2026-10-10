---
sidebar_position: 2
---

# Схема формы

Схема описывает **структуру** формы: какие поля в ней есть, к какой ручке модели привязано каждое из
них, каким компонентом оно рендерится и как поля сгруппированы в разметке. Схема — это **дерево
узлов**, а не хранилище значений: значения живут в [модели](../model).

Схему пишут **билдером** `(model) => узел` и передают в `createForm({ schema })`: узлы держат сами
ручки модели, поэтому дерево строится после неё.

```typescript
import type { FormModel, FormSchemaNode } from '@reformer/core';

const profileSchema = (model: FormModel<Profile>): FormSchemaNode => ({
  children: [
    /* узлы */
  ],
});
```

## Виды узлов

Вид узла определяют его ключи:

| Вид             | Ключи                                      | Пример                                                   |
| --------------- | ------------------------------------------ | -------------------------------------------------------- |
| поле            | `model` — ручка листа или массива целиком  | `{ model: model.$.email, component: Input }`             |
| массив под-форм | `model` — ручка массива + `item`           | `{ model: model.$.phones, component: FieldArray, item }` |
| подформа        | `model` — ручка группы + `part`            | `{ model: model.$.address, part: addressPart }`          |
| контейнер       | `children` (и/или `component` без `model`) | `{ component: Section, children: [...] }`                |

Всем видам доступны `component`, `componentProps` и `selector`. Вложенные узлы читаются только из
`children` и из поддерева `part`; в `componentProps` обход не заглядывает.

## Узел поля

Узел поля привязывает поле к ручке модели (`model: model.$.<field>`) и держит его UI-конфиг.
Правил узел **не несёт**: схема описывает только структуру и вёрстку, а правила корректности живут в
отдельной [схеме валидации](./validation-schema).

```typescript
{
  model: model.$.fieldName,   // ручка модели (PathAwareSignal) — обязательна
  component: Input,           // компонент поля
  componentProps?: object,    // пропсы компонента (label, placeholder, options, type, ...)
  disabled?: boolean,         // поле создаётся отключённым
  selector?: string,          // идентификатор узла для поведения и шагов
}
```

| Ключ             | Тип                  | Назначение                                                       |
| ---------------- | -------------------- | ---------------------------------------------------------------- |
| `model`          | `PathAwareSignal<T>` | Привязка к ручке модели (`model.$.<field>`) — обязательна        |
| `component`      | компонент или тег    | Чем рендерится поле                                              |
| `componentProps` | `object`             | Пропсы компонента (`label`, `placeholder`, `options`, `type`, …) |
| `disabled`       | `boolean`            | Начальное состояние «отключено»                                  |
| `selector`       | `string`             | Имя узла: по нему узел адресуют поведение и шаги потока          |

:::info Узел не несёт правил и старых ключей
Ключей `value`, `array`, `validators`, `asyncValidators` и `updateOn` у узла нет. Привязка поля и
массива — `model`; правила объявляются **отдельной** функцией `defineValidation<T>(({ model }) => …)`
и подключаются к сборке (`createForm({ validation })`); момент живой проверки задаёт стратегия
валидации. Тип `FormSchemaNode` закрыт, поэтому старый ключ — ошибка компиляции, а в dev компилятор
схемы ещё и подскажет замену. См. [Схему валидации](./validation-schema).
:::

:::warning `disabled` узла ≠ `componentProps.disabled`
`disabled` — это **ключ узла** (начальное состояние ноды); дальше состоянием управляют методы
`form.field.disable()` / `enable()` и оператор `enableWhen`. `componentProps.disabled` — это UI-проп
компонента, и на состояние ноды он **не влияет** (частая причина «вычисляемое поле остаётся
редактируемым»).
:::

## Примитивные поля

```typescript
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { Input, InputNumber, SelectAsync, CheckboxWithLabel } from '@reformer/ui-kit';

type MyForm = { name: string; age: number | null; agree: boolean; status: string };

const mySchema = (model: FormModel<MyForm>): FormSchemaNode => ({
  children: [
    {
      model: model.$.name,
      component: Input,
      componentProps: { label: 'Имя', placeholder: 'Введите имя' },
    },
    { model: model.$.age, component: InputNumber, componentProps: { label: 'Возраст' } },
    {
      model: model.$.agree,
      component: CheckboxWithLabel,
      componentProps: { label: 'Согласен с условиями' },
    },
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
  ],
});

const { form } = createForm<MyForm>({
  initial: { name: '', age: null, agree: false, status: 'active' },
  schema: mySchema,
});
```

Правила для этих полей (`required()`, `email()`, …) в узлах не задаются — они пишутся в отдельной
схеме валидации над той же моделью (`validate(model.$.name, [required()])`). См.
[Схему валидации](./validation-schema).

## Контейнеры и текст

Контейнер — узел с `children`: секция, шаг визарда, HTML-тег. `component` контейнера — компонент
(`Section`) или имя тега (`'div'`, `'h3'`); контейнер без `component` просто рисует детей. Ребёнком
контейнера может быть и текст — строка, число или сигнал модели: рендерер выводит его на своём месте.

```typescript
import { Input, Section } from '@reformer/ui-kit';

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

Узел по условию вставляют распространением: `...(includePhone ? [phoneNode] : [])`. Пустые места
(`null`, `undefined`, `false`) компилятор схемы тоже пропускает — это выручает в схемах без типов
(JSON, сгенерированный код).

## Вложенные группы

Вложенная группа модели — сама по себе под-модель `FormModel<Sub>`: её поля привязываются ручками
`model.$.address.city`. Если группа повторяется (два адреса), её разметку выносят в **подформу** —
часть схемы над под-моделью группы, подключённую узлом `{ model: model.$.<группа>, part }`.
Привязки внутри части идут через `$` полученной под-модели:

```typescript
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

type Address = { street: string; city: string; zip: string };

const addressPart = (m: FormModel<Address>): FormSchemaNode => ({
  children: [
    { model: m.$.street, component: Input, componentProps: { label: 'Улица' } },
    { model: m.$.city, component: Input, componentProps: { label: 'Город' } },
    { model: m.$.zip, component: Input, componentProps: { label: 'Индекс' } },
  ],
});

const userSchema = (model: FormModel<UserForm>): FormSchemaNode => ({
  children: [
    { model: model.$.name, component: Input },
    { model: model.$.registrationAddress, part: addressPart },
    { model: model.$.residenceAddress, part: addressPart },
  ],
});
```

Одна часть подключается к любой группе той же формы данных — см. [Композицию](./composition).

## Массивы — узел `{ model, item }`

Массивы объектов принадлежат модели. В схеме массив под-форм объявляется узлом
`{ model: model.$.<массив>, component: FieldArray, item: (row) => узел }`, где `item` строит разметку
одной строки из её под-модели (`FormModel<Item>`). Шаблон новой строки объявляют в модели функцией
`arrayOf(blank)`:

```typescript
import { arrayOf, createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { FieldArray, Input, InputNumber } from '@reformer/ui-kit';

type Item = { name: string; price: number };
type MyForm = { items: Item[] };

const blankItem = (): Item => ({ name: '', price: 0 });

// Разметка одной строки: row.$.field — ручка под-модели строки.
const itemRow = (row: FormModel<Item>): FormSchemaNode => ({
  children: [
    { model: row.$.name, component: Input, componentProps: { label: 'Название' } },
    { model: row.$.price, component: InputNumber, componentProps: { label: 'Цена' } },
  ],
});

const { model, form } = createForm<MyForm>({
  initial: { items: arrayOf(blankItem) },
  schema: (model) => ({
    children: [{ model: model.$.items, component: FieldArray, item: itemRow }],
  }),
});

form.items; // FormArray<Item>
model.items.push(); // новая строка по шаблону
model.items.push({ name: 'Книга', price: 500 });
model.items.removeAt(0);
model.items.length; // реактивная длина
```

Массив объектов становится нодой `FormArray`, только если схема описала его строку узлом с `item`.
Для форм, чья модель создаётся из данных без кода, шаблон строки можно задать и ключом узла
`initialValue` (значение или фабрика) — шаблон из `arrayOf` главнее.

### Массив как одно значение поля

Массив примитивов (теги, мультивыбор, файлы) — это **одно** значение поля: узел привязывает компонент
к ручке массива целиком, без `item`. Нода такого поля — `FormControl<string[]>`:

```typescript
{ model: model.$.tags, component: TagsInput, componentProps: { label: 'Теги' } }
```

Подробнее о динамических списках — в [Композиции](./composition) и разделе про
[ноды массива](../nodes#formarray).

## `selector` — имя узла

`selector` даёт узлу имя, по которому его адресуют поведение (`schema.node('mortgage')` в
`defineFormBehavior` — `hideWhen`, `onComponentEvent`) и шаги потока (`flow.steps[].id` совпадает с
`selector` узла шага). В одной области (корень, строка массива, подформа) `selector` уникален:
повтор — исключение при сборке.

```typescript
{
  selector: 'mortgage',
  component: Section,
  componentProps: { title: 'Ипотека' },
  children: [/* … */],
}
```

## Компиляция

Сборка один раз компилирует дерево — `compileSchema(tree, model)` — в `CompiledSchema`: у каждого
узла вид (`field`, `array`, `part`, `container`, `text`), идентификатор `id` (`selector` либо позиция
вида `#/0/2`) и область `scope` (`#`, `#/address`, `#/phones[<ключ>]`). Этот разбор читают и ноды
формы, и рендереры; он доступен как `bundle.render.tree`.

## Доступ к нодам

`createForm` возвращает в сборке группу `form`: к полям обращаются по имени, к вложенным — цепочкой,
к строкам массива — через `.at(i)`:

```typescript
form.name; // FormControl<string> — TypeScript знает тип
form.address.city; // FormControl<string> — вложенный доступ
form.items.at(0); // FormGroup<Item> — строка массива

form.name.setValue('John');
form.name.value.value; // текущее значение (через сигнал)
```

Вид ноды проверяют гардами `isFormControl` / `isFormGroup` / `isFormArray` из `@reformer/core`.
Подробнее о нодах, их сигналах и методах — в [Ноды формы](../nodes).

## Дальше

- [Схема валидации](./validation-schema) — отдельный слой правил корректности.
- [Схема behavior](./behavior-schema) — реактивная логика.
- [Композиция](./composition) — переиспользование схем.

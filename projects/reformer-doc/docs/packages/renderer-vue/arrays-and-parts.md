---
title: 'Массивы и подформы'
sidebar_label: 'Массивы и подформы'
---

# Массивы и подформы

Узел массива рисует список одинаковых строк — созаёмщиков, телефонов, позиций заказа. Подформа
ставит одну и ту же часть схемы на разные группы модели — например, адрес регистрации и адрес
проживания. Здесь — как рендерер Vue их рисует и что получает компонент списка. Сами массивы модели
и операции над ними — в паттерне [Массивы](/docs/patterns/arrays).

## Когда это нужно

- В форме есть список строк с кнопками «Добавить» и «Удалить».
- Нужен свой компонент списка на своей библиотеке компонентов.
- Одинаковый блок полей стоит в схеме несколько раз.

## Узел массива

```ts
import { arrayOf, type FormModel, type FormSchemaNode } from '@reformer/core';
import { Box, FieldArray, Input } from '@reformer/kit-vuetify';

type Phone = { label: string; number: string };
type Contacts = { phones: Phone[] };

// Шаблон новой строки — в модели, рядом с остальными начальными значениями.
const blankPhone = (): Phone => ({ label: '', number: '' });
export const initialContacts: Contacts = { phones: arrayOf(blankPhone) };

// Строка — функция от под-модели строки: пути считаются от строки.
const phoneRow = (row: FormModel<Phone>): FormSchemaNode => ({
  component: Box,
  children: [
    { model: row.$.label, component: Input, componentProps: { label: 'Метка' } },
    { model: row.$.number, component: Input, componentProps: { label: 'Номер' } },
  ],
});

export const contactsSchema = (model: FormModel<Contacts>): FormSchemaNode => ({
  selector: 'phones',
  model: model.$.phones,
  component: FieldArray,
  componentProps: { title: 'Телефоны', itemLabel: 'Телефон', maxItems: 3 },
  item: phoneRow,
});
```

| Ключ             | Что задаёт                                                       |
| ---------------- | ---------------------------------------------------------------- |
| `model`          | сигнал массива модели: `model.$.phones`                          |
| `item`           | функция `(row) => узел` — разметка одной строки                  |
| `component`      | компонент Vue, который рисует список: `FieldArray` кита или свой |
| `componentProps` | оформление списка: заголовок, подписи кнопок, метка строки       |
| `initialValue`   | запасной шаблон новой строки, если его нет в модели              |

Кнопка «Добавить» берёт новую строку из шаблона `arrayOf(blank)` в модели. `initialValue` узла
нужен только форме, у которой модель создаётся из данных без кода; шаблон модели главнее.

Без `component` рендерер рисует только строки — без кнопок и оформления — и пишет в консоль
предупреждение. Кнопки добавления, удаления и перестановки поставляет компонент массива.

### FieldArray кита Vuetify

Пропсы `FieldArray` из `@reformer/kit-vuetify`:

| Проп                                  | Что задаёт                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| `title`                               | заголовок списка                                                                       |
| `itemLabel`                           | метка строки: строка (`'Телефон'` → «Телефон #1») или функция `(row, index) => string` |
| `addButtonLabel`, `removeButtonLabel` | подписи кнопок; по умолчанию «Добавить» и «Удалить»                                    |
| `emptyMessage`, `emptyMessageHint`    | текст пустого списка и подсказка под ним                                               |
| `reorderable`                         | кнопки ↑ / ↓; по умолчанию `false`                                                     |
| `showRemoveOnSingle`                  | показывать «Удалить» у единственной строки; по умолчанию `false`                       |
| `minItems`                            | «Удалить» видна, только пока строк больше `minItems`                                   |
| `maxItems`                            | на пределе кнопка «Добавить» скрывается                                                |
| `className`, `cardClassName`          | классы списка и карточки строки                                                        |

`minItems` и `maxItems` только прячут кнопки. Ограничение для данных задают правила на массив — см.
[Обзор валидации](/docs/validation/overview).

### Свой компонент списка

Перебирает строки рендерер. Компонент получает готовый результат — `ArrayComponentProps` — и пропсы
из `componentProps` узла:

| Проп               | Что это                                 |
| ------------------ | --------------------------------------- |
| `items`            | отрисованные строки — `ArrayItemSlot[]` |
| `onAdd()`          | добавить строку по шаблону массива      |
| `onRemove(index)`  | удалить строку                          |
| `onMove(from, to)` | переставить строку                      |

Строка `ArrayItemSlot` — `{ key, index, model, children }`:

- `key` — стабильный ключ по идентичности под-модели строки. Перестановка двигает поддерево строки,
  а не пересоздаёт его.
- `index` — живой индекс элемента в массиве модели: его и передают в `onRemove` и `onMove`.
- `model` — под-модель строки, например для подписи.
- `children` — поддерево строки: его вставляют в разметку как есть.

```ts
import { defineComponent, h, type PropType } from 'vue';
import type { ArrayItemSlot } from '@reformer/renderer-vue';

export const PlainList = defineComponent({
  name: 'PlainList',
  // Объявлены все пропсы: необъявленные Vue отдал бы атрибутами корню.
  props: {
    items: { type: Array as PropType<readonly ArrayItemSlot[]>, default: () => [] },
    onAdd: { type: Function as PropType<() => void>, required: true },
    onRemove: { type: Function as PropType<(index: number) => void>, required: true },
    onMove: { type: Function as PropType<(from: number, to: number) => void>, default: undefined },
  },
  setup(props) {
    return () =>
      h('div', [
        props.items.map((item) =>
          h('div', { key: item.key }, [
            item.children,
            h('button', { type: 'button', onClick: () => props.onRemove(item.index) }, 'Удалить'),
          ])
        ),
        h('button', { type: 'button', onClick: () => props.onAdd() }, 'Добавить'),
      ]);
  },
});
```

- Компонент не подписывается на модель и не вызывает хуков рендерера. Поэтому его можно написать
  на любой библиотеке компонентов и проверить в тесте на поддельных `items`, без формы.
- Кнопки пишут через ноду массива формы: после «Добавить», «Удалить» или перестановки массив
  становится `dirty`, а `form.reset()` это снимает.
- Элемент массива `null` строкой не рисуется; `index` остальных — по-прежнему индексы модели.

## Подформа

Подформа — часть схемы над под-моделью группы. Её объявляют один раз и ставят к любой группе той же
формы данных:

```ts
type Address = { city: string; street: string };

const addressPart = (sub: FormModel<Address>): FormSchemaNode => ({
  component: Box,
  children: [
    { model: sub.$.city, component: Input, componentProps: { label: 'Город' } },
    {
      selector: 'street',
      model: sub.$.street,
      component: Input,
      componentProps: { label: 'Улица' },
    },
  ],
});

// В схеме — дважды, к разным группам модели:
const addresses: FormSchemaNode[] = [
  { model: model.$.registrationAddress, part: addressPart },
  { model: model.$.residenceAddress, part: addressPart },
];
```

У подформы нет своего компонента. Правила `patchProps` и `onComponentEvent` на самом узле
подформы ничего не делают — в dev рендерер об этом предупреждает. Адресуйте узлы внутри части.

## Области схемы

Строка массива и подформа — отдельные области схемы. `selector` внутри них уникален в своей
области и с корнем не пересекается: у каждой строки свой `street`.

Корневое поведение формы узлы строки и подформы не видит. Их правила пишутся в поведении строки или
группы и подключаются операторами `applyEach` и `apply` из `@reformer/core/behaviors` — так же, как
в React. Пример — в разделе [Области схемы](../renderer-react/arrays-and-parts.md#области-схемы)
страницы React.

Рендерер исполняет правила области, пока её поддерево смонтировано: `renderEffect` строки живёт
вместе со строкой. Если поведение области обращается к узлу, которого нет в её поддереве, в dev
рендерер называет такие селекторы в предупреждении.

## Подводные камни

- **Нет кнопок «Добавить» и «Удалить»** — у узла массива не задан `component`.
- **«Добавить» бросает ошибку про шаблон** — нет ни `arrayOf(blank)` в модели, ни `initialValue`
  в узле.
- **Узел без `item` — не массив под-форм**, а одно поле со значением-массивом (теги, мультивыбор):
  контрол получает весь массив значением.
- **Правило на узел строки не срабатывает** — его адресовали из корневого поведения. Подключите
  поведение строки через `applyEach`.
- **`props.onAdd` — `undefined`** — колбэк не объявлен пропом. Необъявленное Vue кладёт в `attrs`,
  а не в `props`: объявите `items`, `onAdd`, `onRemove` и `onMove`.

## См. также

- [Массивы](/docs/patterns/arrays) — модель массива, операции, агрегаты.
- [Массивы и подформы в React](../renderer-react/arrays-and-parts.md) — то же для
  `@reformer/renderer-react`.
- [Массивы и части в JSON](../renderer-json/arrays-and-parts.md) — то же в JSON-документе.
- [Управление узлами](./node-control.md) — правила узлов и управление снаружи.

---
title: 'Массивы и подформы'
sidebar_label: 'Массивы и подформы'
---

# Массивы и подформы

Узел массива рисует список одинаковых строк — созаёмщиков, телефонов, позиций заказа. Подформа
ставит одну и ту же часть схемы на разные группы модели — например, адрес регистрации и адрес
проживания. Схема у них та же, что в React; здесь — чем отличается компонент списка в Angular.
Сами массивы модели и операции над ними — в паттерне [Массивы](/docs/patterns/arrays).

## Когда это нужно

- В форме есть список строк с кнопками «Добавить» и «Удалить».
- Нужен свой компонент списка: таблица, карточки, перестановка строк.
- Одинаковый блок полей стоит в схеме несколько раз.

## Узел массива

```ts
import { arrayOf, type FormModel, type FormSchemaNode } from '@reformer/core';
import { Box, FieldArray, Input } from '@reformer/kit-taiga';

type Phone = { label: string; number: string };
type Contacts = { phones: Phone[] };

// Шаблон новой строки — в модели, рядом с остальными начальными значениями.
const blankPhone = (): Phone => ({ label: '', number: '' });
export const initialContacts: Contacts = { phones: arrayOf(blankPhone) };

// Строка — функция от под-модели строки: пути считаются от строки.
const phoneRow = (row: FormModel<Phone>): FormSchemaNode => ({
  component: Box,
  componentProps: { className: 'grid grid-cols-2 gap-3' },
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

| Ключ             | Что задаёт                                                   |
| ---------------- | ------------------------------------------------------------ |
| `model`          | сигнал массива модели: `model.$.phones`                      |
| `item`           | функция `(row) => узел` — разметка одной строки              |
| `component`      | компонент, который рисует список: `FieldArray` кита или свой |
| `componentProps` | оформление списка: заголовок, подписи кнопок, метка строки   |
| `initialValue`   | запасной шаблон новой строки, если его нет в модели          |

Кнопка «Добавить» берёт новую строку из шаблона `arrayOf(blank)` в модели; `initialValue` узла
нужен только форме, у которой модель создаётся из данных без кода. Узел без `component` рисует
одни строки — без секции и кнопок, — и в консоли предупреждение.

### `FieldArray` кита kit-taiga

Входы `FieldArray` из `@reformer/kit-taiga`:

| Вход                                  | Что задаёт                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| `title`                               | заголовок списка                                                                         |
| `itemLabel`                           | метка строки: строка (`'Телефон'` → «Телефон #1») или функция `(model, index) => string` |
| `addButtonLabel`, `removeButtonLabel` | подписи кнопок; по умолчанию — «Добавить» и «Удалить»                                    |
| `emptyMessage`, `emptyMessageHint`    | текст пустого списка и подсказка под ним                                                 |
| `reorderable`                         | кнопки ↑ / ↓; по умолчанию `false`                                                       |
| `showRemoveOnSingle`                  | показывать «Удалить» у единственной строки; по умолчанию `false`                         |
| `minItems`                            | «Удалить» показывается, только пока строк больше                                         |
| `maxItems`                            | на пределе кнопка «Добавить» скрывается                                                  |
| `className`, `cardClassName`          | классы списка и карточки строки                                                          |

`minItems` и `maxItems` только прячут кнопки. Ограничение для данных задают правила `minLength(n)`
и `maxLength(n)` на массив — см. [Обзор валидации](/docs/validation/overview).

### Свой компонент списка

Перебирает строки рендерер. Компонент получает обычные входы — `ArrayComponentInputs` — и пропсы
из `componentProps` узла:

| Вход               | Что это                                                          |
| ------------------ | ---------------------------------------------------------------- |
| `items`            | строки массива `ArrayItemSlot`: `{ key, index, model, content }` |
| `onAdd()`          | добавить строку по шаблону массива                               |
| `onRemove(index)`  | удалить строку                                                   |
| `onMove(from, to)` | переставить строку                                               |

Колбэки — входы, а не выходы: у `onMove` два аргумента, а выход Angular несёт одно значение.
Строку рисует директива `reformerArrayItem`:

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReformerArrayItem, type ArrayItemSlot } from '@reformer/renderer-angular';

@Component({
  selector: 'app-plain-list',
  imports: [ReformerArrayItem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (item of items(); track item.key) {
      <div class="flex items-end gap-2">
        <ng-container [reformerArrayItem]="item" />
        <button type="button" (click)="onRemove()?.(item.index)">Удалить</button>
      </div>
    }
    <button type="button" (click)="onAdd()?.()">Добавить</button>
  `,
})
export class PlainList {
  readonly items = input<readonly ArrayItemSlot[]>([]);
  readonly onAdd = input<() => void>();
  readonly onRemove = input<(index: number) => void>();
}
```

- `key` — стабильный ключ строки по идентичности её под-модели: `track item.key`. При перестановке
  строки её элементы переезжают, а не создаются заново.
- `index` — живой индекс в массиве модели: его передают в `onRemove` и `onMove`.
- `model` — под-модель строки, например для подписи. `content` — поддерево строки; его разбирает
  директива, а не компонент.
- Кнопки пишут через ноду массива формы: массив становится `dirty`, сброс формы это снимает.
- Элемент массива `null` строкой не рисуется; индексы остальных — по-прежнему индексы модели.
- Компонент не знает ни про сигналы, ни про узлы схемы: при каждом изменении состава массива
  рендерер заново ставит вход `items`.

## Подформа

Подформа — часть схемы над под-моделью группы. Её объявляют один раз и ставят к любой группе той же
формы данных:

```ts
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Box, Input } from '@reformer/kit-taiga';

type Address = { city: string; street: string };
type Applicant = { registrationAddress: Address; residenceAddress: Address };

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
export const applicantSchema = (model: FormModel<Applicant>): FormSchemaNode => ({
  children: [
    { model: model.$.registrationAddress, part: addressPart },
    { model: model.$.residenceAddress, part: addressPart },
  ],
});
```

У подформы нет своего компонента. Правила `patchProps` и `onComponentEvent` на самом узле
подформы ничего не делают — в dev-режиме об этом предупреждение. Адресуйте узлы внутри части.

## Области схемы

Строка массива и подформа — отдельные области схемы. `selector` внутри них уникален в своей
области и с корнем не пересекается: у каждой строки свой `street`. Поэтому корневое поведение
формы узлы строки и подформы не видит: их правила пишутся в поведении строки или группы и
подключаются операторами `applyEach` и `apply`. Устроено так же, как в React, — см.
[Области схемы](../renderer-react/arrays-and-parts.md#области-схемы).

## Подводные камни

- **Нет кнопок «Добавить» и «Удалить»** — у узла массива не задан `component`.
- **«Добавить» бросает ошибку про шаблон** — нет ни `arrayOf(blank)` в модели, ни `initialValue`
  в узле.
- **Узел без `item` — не массив под-форм**, а одно поле со значением-массивом (теги, мультивыбор).
- **Колбэки не приходят** — компонент не объявил входы `onAdd`, `onRemove`, `onMove`: функцию,
  которой некуда прийти, рендерер вешает слушателем на хост. Объявляйте их входами — выход не
  передаст второй аргумент `onMove`.
- **Строки пересоздаются при перестановке** — в `@for` стоит `track $index`. Отслеживайте строку
  по `item.key`.
- **Правило на узел строки не срабатывает** — его адресовали из корневого поведения. Подключите
  поведение строки через `applyEach`; в dev рендерер предупредит о неизвестном селекторе.

## См. также

- [Массивы](/docs/patterns/arrays) — модель массива, операции, агрегаты.
- [Массивы и подформы в React](../renderer-react/arrays-and-parts.md) — та же схема в рендерере на
  React.
- [Массивы и части в JSON](../renderer-json/arrays-and-parts.md) — то же в JSON-документе.
- [Управление узлами](./node-control.md) — правила узлов и управление снаружи.

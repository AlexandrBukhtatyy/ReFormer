---
title: 'Массивы и подформы'
sidebar_label: 'Массивы и подформы'
---

# Массивы и подформы

Узел массива рисует список одинаковых строк — созаёмщиков, телефонов, позиций заказа. Подформа
ставит одну и ту же часть схемы на разные группы модели — например, адрес регистрации и адрес
проживания. Здесь — как их описать в схеме и как рендерер их рисует. Сами массивы модели и операции
над ними — в паттерне [Массивы](/docs/patterns/arrays).

## Когда это нужно

- В форме есть список строк с кнопками «Добавить» и «Удалить».
- Нужен список только для показа, без кнопок.
- Одинаковый блок полей стоит в схеме несколько раз.

## Узел массива

```tsx
import { arrayOf, type FormModel } from '@reformer/core';
import type { RenderNode } from '@reformer/renderer-react';
import { Box, FieldArray, Input } from '@reformer/ui-kit';

type Phone = { label: string; number: string };
type Contacts = { phones: Phone[] };

// Шаблон новой строки — в модели, рядом с остальными начальными значениями.
const blankPhone = (): Phone => ({ label: '', number: '' });
export const initialContacts: Contacts = { phones: arrayOf(blankPhone) };

// Строка — функция от под-модели строки: пути считаются от строки.
const phoneRow = (row: FormModel<Phone>): RenderNode<Contacts> => ({
  component: Box,
  componentProps: { className: 'grid grid-cols-2 gap-3' },
  children: [
    { model: row.$.label, component: Input, componentProps: { label: 'Метка' } },
    { model: row.$.number, component: Input, componentProps: { label: 'Номер' } },
  ],
});

export const contactsSchema = (model: FormModel<Contacts>): RenderNode<Contacts> => ({
  selector: 'phones',
  model: model.$.phones,
  component: FieldArray,
  componentProps: { title: 'Телефоны', itemLabel: 'Телефон', maxItems: 3 },
  item: phoneRow,
});
```

| Ключ             | Что задаёт                                                      |
| ---------------- | --------------------------------------------------------------- |
| `model`          | сигнал массива модели: `model.$.phones`                         |
| `item`           | функция `(row) => узел` — разметка одной строки                 |
| `component`      | компонент, который рисует список: `FieldArray`, `List` или свой |
| `componentProps` | оформление списка: заголовок, подписи кнопок, метка строки      |
| `initialValue`   | запасной шаблон новой строки, если его нет в модели             |

Кнопка «Добавить» берёт новую строку из шаблона `arrayOf(blank)` в модели. `initialValue` узла
нужен только форме, у которой модель создаётся из данных без кода; шаблон модели главнее.

### Какой компонент взять

| `component`    | Что рисует                                                      |
| -------------- | --------------------------------------------------------------- |
| `FieldArray`   | редактируемый список: «Добавить», «Удалить», по желанию — ↑ / ↓ |
| `List`         | строки без кнопок — для списков, которые меняет только код      |
| свой компонент | что угодно; контракт — ниже                                     |
| не задан       | только строки, без кнопок, и предупреждение в консоли           |

Пропсы `FieldArray` из `@reformer/ui-kit`:

| Проп                                  | Что задаёт                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| `title`                               | заголовок списка                                                                       |
| `itemLabel`                           | метка строки: строка (`'Телефон'` → «Телефон #1») или функция `(row, index) => string` |
| `addButtonLabel`, `removeButtonLabel` | подписи кнопок; по умолчанию — из словаря локали                                       |
| `emptyMessage`, `emptyMessageHint`    | текст пустого списка и подсказка под ним                                               |
| `reorderable`                         | кнопки ↑ / ↓; по умолчанию `false`                                                     |
| `showRemoveOnSingle`                  | показывать «Удалить» у единственной строки; по умолчанию `false`                       |
| `maxItems`                            | на пределе кнопка «Добавить» скрывается                                                |
| `className`, `cardClassName`          | классы списка и карточки строки                                                        |

`maxItems` только прячет кнопку. Ограничение для данных задаёт правило `maxLength(n)` на массив —
см. [Обзор валидации](/docs/validation/overview).

### Свой компонент списка

Перебирает строки рендерер. Компонент получает готовый результат — `ArrayComponentProps` — и пропсы
из `componentProps` узла:

| Проп               | Что это                                                |
| ------------------ | ------------------------------------------------------ |
| `items`            | отрисованные строки: `{ key, index, model, children }` |
| `onAdd()`          | добавить строку по шаблону массива                     |
| `onRemove(index)`  | удалить строку                                         |
| `onMove(from, to)` | переставить строку                                     |

```tsx
import type { ArrayComponentProps } from '@reformer/renderer-react';

export function PlainList({ items, onAdd, onRemove }: ArrayComponentProps) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.key} className="flex items-end gap-2">
          {item.children}
          <button type="button" onClick={() => onRemove(item.index)}>
            Удалить
          </button>
        </div>
      ))}
      <button type="button" onClick={onAdd}>
        Добавить
      </button>
    </div>
  );
}
```

Компонент не подписывается на модель и не вызывает хуков рендерера. Поэтому его можно написать на
любой UI-библиотеке и проверить в тесте на поддельных `items`, без формы.

## Подформа

Подформа — часть схемы над под-моделью группы. Её объявляют один раз и ставят к любой группе той же
формы данных:

```tsx
type Address = { city: string; street: string };

const addressPart = (sub: FormModel<Address>): RenderNode<Applicant> => ({
  component: Box,
  children: [
    { model: sub.$.city, component: Input, componentProps: { label: 'Город' } },
    { selector: 'street', model: sub.$.street, component: Input, componentProps: { label: 'Улица' } },
  ],
});

// В схеме — дважды, к разным группам модели:
{ model: model.$.registrationAddress, part: addressPart }
{ model: model.$.residenceAddress, part: addressPart }
```

У подформы нет своего компонента. Правила `patchProps` и `onComponentEvent` на самом узле
подформы ничего не делают — адресуйте узлы внутри части.

## Области схемы

Строка массива и подформа — отдельные области схемы. `selector` внутри них уникален в своей
области и с корнем не пересекается: у каждой строки свой `street`.

Поэтому корневое поведение формы узлы строки и подформы не видит. Их правила пишутся в поведении
строки или группы и подключаются операторами `applyEach` и `apply` из `@reformer/core/behaviors`:

```ts
import { apply, applyEach, defineFormBehavior, hideWhen } from '@reformer/core/behaviors';

const addressBehavior = defineFormBehavior<Address>(({ model, schema }) => {
  hideWhen(schema.node('street'), () => model.city === '');
});

export const applicantBehavior = defineFormBehavior<Applicant>(({ model }) => {
  apply([model.$.registrationAddress, model.$.residenceAddress], addressBehavior);
  applyEach(model.$.phones, phoneBehavior); // правила узлов строки — в её поведении
});
```

Подробнее о поведении — в [Обзоре поведения](/docs/behaviors/overview).

## Подводные камни

- **Нет кнопок «Добавить» и «Удалить»** — у узла массива не задан `component`.
- **«Добавить» бросает ошибку про шаблон** — нет ни `arrayOf(blank)` в модели, ни `initialValue`
  в узле.
- **Узел без `item` — не массив под-форм**, а одно поле со значением-массивом (теги, мультивыбор).
- **Правило на узел строки не срабатывает** — его адресовали из корневого поведения. Подключите
  поведение строки через `applyEach`; в dev сборка предупредит о неизвестном селекторе.

## См. также

- [Массивы](/docs/patterns/arrays) — модель массива, операции, агрегаты.
- [Массивы и части в JSON](../renderer-json/arrays-and-parts.md) — то же в JSON-документе.
- [FieldArray (UI Kit)](/docs/ui-kit/field-array) — компонент списка.
- [Управление узлами](./node-control.md) — правила узлов и управление снаружи.

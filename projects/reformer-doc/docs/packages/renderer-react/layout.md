---
title: 'Вёрстка: контейнеры, HTML и текст'
sidebar_label: 'Вёрстка'
---

# Вёрстка: контейнеры, HTML и текст

Кроме полей, схема описывает вёрстку: секции, колонки, заголовки, поясняющий текст и живую сводку
значений. Для этого есть узел-контейнер. Его `component` — React-компонент или HTML-тег строкой, а
`children` — вложенные узлы и текст вперемешку.

## Когда это нужно

- Поля нужно разложить по секциям и колонкам.
- В форме есть заголовки, плашки с пояснением, разделители — заводить под них компоненты не хочется.
- Нужна сводка, которая пересчитывается на лету: «Платёж в месяц: 12 500 ₽».

## Пример

```tsx
import type { FormModel } from '@reformer/core';
import { computed } from '@reformer/core/signals';
import type { RenderNode } from '@reformer/renderer-react';
import { InputNumber, Section } from '@reformer/ui-kit';

type Installment = { amount: number; months: number };

const installmentSchema = (model: FormModel<Installment>): RenderNode<Installment> => {
  // Вычисляемый текст — обычный computed над моделью.
  const monthly = computed(() => Math.round((model.amount ?? 0) / (model.months || 1)));

  return {
    component: 'div',
    componentProps: { className: 'space-y-6' },
    children: [
      {
        component: 'h2',
        componentProps: { className: 'text-xl font-bold' },
        children: ['Рассрочка'],
      },
      {
        component: Section,
        componentProps: { title: 'Условия' },
        children: [
          { model: model.$.amount, component: InputNumber, componentProps: { label: 'Сумма, ₽' } },
          {
            model: model.$.months,
            component: InputNumber,
            componentProps: { label: 'Срок, мес.' },
          },
        ],
      },
      { component: 'hr' },
      // Текст и сигналы в children: перерисовывается только сам текст.
      { component: 'p', children: ['Платёж в месяц: ', monthly, ' ₽'] },
    ],
  };
};
```

## Контейнер

| Ключ             | Что задаёт                                                             |
| ---------------- | ---------------------------------------------------------------------- |
| `component`      | React-компонент (`Section`, `Box`) или тег строкой (`'div'`, `'p'`)    |
| `componentProps` | пропсы компонента; у тега — DOM-атрибуты (`className`, `id`, `aria-*`) |
| `children`       | вложенные узлы и текстовые части                                       |
| `selector`       | имя узла для поведения и шагов потока                                  |

- `children` — ключ самого узла. Внутри `componentProps` вложенные узлы не рисуются.
- Контейнер без `component` рисует только своих детей — удобно, чтобы сгруппировать узлы без лишней
  разметки.
- Компонент-контейнер получает `children` уже отрисованными (`ReactNode`) — как обычный React-компонент.
  Пропсы описывает тип `ContainerComponentProps`.

## HTML-теги

Тег строкой рисуется как есть: `{ component: 'h3', children: ['Итого'] }` даёт `<h3>Итого</h3>`.
Отдельный компонент нужен, только когда у блока есть своя логика или состояние.

- `selector` в DOM не попадает: он адресует узел схемы, а не элемент. `hideWhen` по нему работает.
- Пустые теги (`hr`, `br`, `img`) детей не получают — их `children` пропускаются.
- Теги и компоненты вкладываются друг в друга в любом порядке.

## Текст

Ребёнок контейнера — узел либо текстовая часть:

| Текстовая часть | Пример                              | Обновляется                     |
| --------------- | ----------------------------------- | ------------------------------- |
| строка, число   | `'Итого: '`, `42`                   | нет                             |
| сигнал поля     | `model.$.monthlyPayment`            | при изменении значения          |
| `computed(…)`   | `computed(() => model.a + model.b)` | при изменении прочитанных полей |

- Соседние части склеиваются без разделителя. Пробелы ставьте в строках сами.
- Порядок в `children` сохраняется: `['Важно: ', { component: 'b', children: ['срок'] }, ' истёк']`.
- `null` и `undefined` в сигнале дают пустую строку.
- Текст у компонента-контейнера приходит ему обычными React-`children`:
  `{ component: Button, children: ['Отправить'] }`.

## Узлы по условию

Условие, которое известно при сборке, решается обычным кодом: `...(withPhone ? [phoneNode] : [])`.
Пустые места (`null`, `undefined`, `false`) в `children` компилятор схемы пропускает.

Условие, которое меняется во время работы формы, — правило `hideWhen` в поведении формы. См.
[Управление узлами](./node-control.md).

## Подводные камни

- **Текст не обновляется** — значение подставлено строкой при построении схемы:
  `` `Платёж: ${model.monthlyPayment}` `` читает его один раз. Передавайте сам сигнал:
  `['Платёж: ', model.$.monthlyPayment]`.
- **Контейнер пустой** — `children` положили в `componentProps`.
- **Компоненты `FormWizard` и табы** получают детей узлами, а не текстом: текстовые части им не
  передаются, в dev — предупреждение. См. [Управление узлами](./node-control.md#компонент-сам-рисует-детей).

## См. также

- [Схема формы](/docs/core-concepts/schemas/form-schema) — виды узлов и `selector`.
- [Вычисляемые поля](/docs/behaviors/computed) — когда значение должно жить в модели, а не только в тексте.
- [HTML-узлы в JSON](../renderer-json/document-format.md#html-узлы-и-текст) — то же в JSON-документе.

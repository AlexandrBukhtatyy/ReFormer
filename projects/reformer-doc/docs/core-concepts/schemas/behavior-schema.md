---
sidebar_position: 4
---

# Схема поведения

[Поведение](/docs/reference/glossary) — реакции формы на изменения: вычисляемые поля, условная
доступность и видимость, копирование значений, загрузка зависимых данных. Его описывают функцией
над моделью в `defineFormBehavior` и подключают к форме полем `behavior`.

## Когда нужно

Когда значение или состояние одного поля зависит от другого. Эта страница — про формат схемы
поведения. Сами операторы с примерами — в разделе «Поведение»:

- [Обзор поведения](/docs/behaviors/overview) — как поведение работает;
- [Вычисляемые поля](/docs/behaviors/computed) — `compute`, `computeFrom`;
- [Условная логика](/docs/behaviors/conditional) — `enableWhen`, `resetWhen`, `hideWhen`;
- [Синхронизация полей](/docs/behaviors/sync) — `copyFrom`, `syncFields`, `transformValue`;
- [Реакции на изменения](/docs/behaviors/watch) — `onChange`, `revalidateWhen`.

## Минимальный пример

```typescript
import { createForm } from '@reformer/core';
import { compute, defineFormBehavior, enableWhen } from '@reformer/core/behaviors';

type Order = { price: number; quantity: number; total: number; discount: number };

const orderBehavior = defineFormBehavior<Order>(({ model }) => {
  // Сумма пересчитывается, когда меняется цена или количество.
  compute(model.$.total, () => model.price * model.quantity);
  // Скидка доступна только для крупных заказов.
  enableWhen(model.$.discount, () => model.total > 500);
});

const order = createForm<Order>({
  initial: { price: 100, quantity: 1, total: 0, discount: 0 },
  behavior: orderBehavior,
});
```

## Область поведения

Функция схемы получает область — то, с чем поведение может работать:

| Поле     | Что это                                                            |
| -------- | ------------------------------------------------------------------ |
| `model`  | модель: значения (`model.price`) и сигналы полей (`model.$.price`) |
| `form`   | ноды формы: пропсы компонента, доступность, замечания              |
| `schema` | узлы схемы формы по `selector`: `schema.node('mortgage')`          |
| `flow`   | поток шагов сборки; без потока — `undefined`                       |

Операторы сами отписываются, когда форму снимают: хранить и вызывать функции отписки не нужно.

## Операторы

Все операторы импортируются из `@reformer/core/behaviors`.

| Оператор                                                            | Что делает                                             | Подробнее                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| `compute`, `computeFrom`                                            | значение поля из других полей                          | [Вычисляемые поля](/docs/behaviors/computed)    |
| `enableWhen`, `disableWhen`, `resetWhen`                            | доступность и сброс поля по условию                    | [Условная логика](/docs/behaviors/conditional)  |
| `copyFrom`, `syncFields`, `transformValue`                          | копирование, двусторонняя связь, нормализация ввода    | [Синхронизация](/docs/behaviors/sync)           |
| `onChange`, `revalidateWhen`                                        | действие или перепроверка при изменении                | [Реакции](/docs/behaviors/watch)                |
| `hideWhen`, `onComponentEvent`, `onMount`, `onInit`, `renderEffect` | правила для узлов схемы: видимость, события компонента | [Условная логика](/docs/behaviors/conditional)  |
| `apply`, `applyEach`                                                | поведение группы или строки массива                    | [Повторяющиеся группы](./composition.md)        |
| `exclusiveFlag`, `aggregateInto`, `effect`, `onDispose`             | свои операторы и особые случаи                         | [Продвинутые поведения](/docs/behaviors/custom) |

## Поведение и валидация

|                | Схема валидации                      | Схема поведения                        |
| -------------- | ------------------------------------ | -------------------------------------- |
| Отвечает на    | верны ли значения                    | как поля реагируют друг на друга       |
| Результат      | замечания на нодах                   | новые значения, доступность, видимость |
| Когда работает | по запросу: отправка, шаг, стратегия | сразу при каждом изменении             |

## Подводные камни

- **`model.get()` внутри `compute` и условий не подписывает.** Пересчёта не будет. Читайте поля по
  отдельности: `model.price` или `model.$.price.value`.
- **Правила узлов схемы исполняет рендерер.** `hideWhen`, `onComponentEvent`, `onMount` только
  записывают правило. Если форма нарисована JSX-ом вручную, видимость и события остаются в JSX.
- **`schema.node(selector)` ищет только в своей области.** Узел строки массива или подформы
  достаётся из их поведения, подключённого через `applyEach` или `apply`.
- **Взаимные вычисления зацикливаются.** `compute(model.$.a, () => model.b + 1)` вместе с
  `compute(model.$.b, () => model.a + 1)` дают ошибку цикла. Зависимость должна идти в одну
  сторону — см. [Вычисляемые поля](/docs/behaviors/computed).

## См. также

- [Обзор поведения](/docs/behaviors/overview) — все операторы с примерами.
- [Схема валидации](./validation-schema.md) — правила отдельно от поведения.
- [Повторяющиеся группы](./composition.md) — поведение группы и строк массива.
- [Схема формы](./form-schema.md) — `selector` узлов для `hideWhen`.

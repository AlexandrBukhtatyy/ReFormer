---
sidebar_position: 1
---

# Обзор поведения

[Поведение](../reference/glossary.md) — это реакции формы на ввод: поле считается из других полей,
становится доступным по условию, копирует значение соседа, загружает варианты выбора. Оно
описывается отдельно от разметки и правил и подключается к сборке формы полем `behavior`.

## Когда нужно

- Итог, ежемесячный платёж, полное имя — **вычисляемое поле**.
- Поле «Промокод» доступно только для крупного заказа — **условная доступность**.
- «Адрес доставки совпадает с адресом регистрации» — **копирование значений**.
- Сменили страну — загрузить список городов — **реакция на изменение**.

Проверка значений — не поведение, а [валидация](../validation/overview.mdx): поведение отвечает на
вопрос «как форма реагирует», валидация — «верны ли данные».

## Пример

Поведение описывают функцией `defineFormBehavior` из `@reformer/core/behaviors`. Внутри вызывают
операторы: каждый описывает одну реакцию.

```typescript
import { createForm } from '@reformer/core';
import { compute, defineFormBehavior, enableWhen } from '@reformer/core/behaviors';

type Order = { price: number; quantity: number; total: number; promoCode: string };

const orderBehavior = defineFormBehavior<Order>(({ model }) => {
  // total пересчитывается, когда меняется price или quantity
  compute(model.$.total, () => model.price * model.quantity);
  // промокод доступен только для заказа от 5000; при выключении поле очищается
  enableWhen(model.$.promoCode, () => model.total >= 5000, { resetOnDisable: true });
});

const order = createForm<Order>({
  initial: { price: 1200, quantity: 1, total: 0, promoCode: '' },
  schema: orderSchema,
  behavior: orderBehavior,
});
```

Этот пример вживую — на странице [Вычисляемые поля](./computed.mdx).

Три правила записи:

- **Цель и источник — сигнал поля:** `model.$.total`, а не строка `'total'`.
- **Значения читают через модель:** `model.price`. Чтение подписывает оператор на поле, и он
  срабатывает при его изменении.
- **Отписываться не нужно.** Операторы регистрируют отписки сами, а сборка снимает их вместе с
  формой.

Функция поведения получает область `{ model, form, schema, flow }`:

| Поле     | Что это                                                                  |
| -------- | ------------------------------------------------------------------------ |
| `model`  | модель: значения и сигналы полей `model.$.x`                             |
| `form`   | ноды формы — для `updateComponentProps`, `reset`, `setIssues`            |
| `schema` | узлы схемы своей области: `schema.node('mortgage')` — по `selector` узла |
| `flow`   | поток шагов сборки; без `flow` в конфиге — `undefined`                   |

## Операторы

| Оператор                                      | Что делает                                                |
| --------------------------------------------- | --------------------------------------------------------- |
| [`compute`](./computed.mdx#compute)           | вычисляемое поле; источники — прочитанные поля            |
| [`computeFrom`](./computed.mdx#computefrom)   | вычисляемое поле с явным списком источников               |
| [`enableWhen`](./conditional.md#enablewhen)   | поле доступно, пока условие истинно                       |
| [`disableWhen`](./conditional.md#disablewhen) | поле выключено, пока условие истинно                      |
| [`resetWhen`](./conditional.md#resetwhen)     | сбросить значение, когда условие истинно                  |
| [`copyFrom`](./sync.md#copyfrom)              | копировать значение поля или группы по условию            |
| [`syncFields`](./sync.md#syncfields)          | связать два поля в обе стороны                            |
| [`transformValue`](./sync.md#transformvalue)  | нормализовать значение поля: регистр, пробелы, округление |
| [`onChange`](./watch.md#onchange)             | реакция на изменение: запрос, обновление пропсов, пауза   |
| [`revalidateWhen`](./watch.md#revalidatewhen) | перепроверить правила, когда меняется другое поле         |
| [`apply`](./custom.md#apply)                  | поведение вложенной группы                                |
| [`applyEach`](./custom.md#applyeach)          | поведение каждой строки массива                           |
| [`exclusiveFlag`](./custom.md#exclusiveflag)  | флаг «выбран» только у одной строки массива               |
| [`aggregateInto`](./custom.md#aggregateinto)  | запись в строки массива по итогу всех строк               |

Операторы над **узлами схемы** записывают правило, а выполняет его рендерер `FormRenderer`:

| Оператор                                           | Что делает                                   |
| -------------------------------------------------- | -------------------------------------------- |
| [`hideWhen`](./conditional.md#скрытие-узлов-схемы) | скрыть узел, пока условие истинно            |
| `onComponentEvent(узел, событие, обработчик)`      | обработчик события компонента узла           |
| `renderEffect(schema, fn)`                         | эффект, который живёт, пока форма нарисована |
| `onInit` / `onMount` / `onUnmount`                 | жизненный цикл узла                          |

Если форму рисуют руками в JSX, без рендерера, правила узлов не действуют: видимость и обработчики
остаются в разметке.

## Функции без формы

Те же реакции над значениями есть отдельными функциями в `@reformer/core/model`: `computeFrom`,
`copyFrom`, `watchField`, `transformValue`, `resetWhen`, `syncFields`, `revalidateWhen`. Они
принимают сигналы модели, возвращают функцию отписки и вызываются где угодно — например, в
`useEffect` для модели без формы.

```typescript
import { useEffect } from 'react';
import { copyFrom, watchField } from '@reformer/core/model';

useEffect(() => {
  const stops = [
    copyFrom(model.$.email, model.$.billingEmail, { when: () => model.sameEmail }),
    watchField(model.$.country, () => {
      model.city = '';
    }),
  ];
  return () => stops.forEach((stop) => stop());
}, [model]);
```

- Отписку вызываете вы сами.
- Ноды формы этим функциям недоступны: `enableWhen` и `disableWhen` есть только внутри
  `defineFormBehavior`.
- `compute` в этом наборе нет — его заменяет `computeFrom`; `onChange` — `watchField`.

Для формы со сборкой берите `defineFormBehavior`: отписки и порядок запуска берёт на себя сборка.

## Подводные камни

- **Не читайте `model.get()` в `compute` и в условиях.** Это снимок без подписки: оператор не
  узнает об изменении поля. Читайте поля по одному — `model.price`.
- **Условие не должно читать собственную цель.** `resetWhen(model.$.card, () => model.card !== '')`
  запускает сам себя. Подробнее — в [Условной логике](./conditional.md).
- **Вычисляемое поле и `enableWhen` на одном поле** требуют одинакового условия: у `compute` — в
  опции `when`. Иначе `compute` снова заполнит выключенное поле.
- **Поведение не проверяет значения.** Правила — в `defineValidation`; перепроверить их по
  событию помогает `revalidateWhen`.

## См. также

- [Вычисляемые поля](./computed.mdx) — `compute`, `computeFrom`, циклы.
- [Условная логика](./conditional.md) — `enableWhen`, `resetWhen`, `hideWhen`.
- [Синхронизация полей](./sync.md) — `copyFrom`, `syncFields`, `transformValue`.
- [Реакции на изменения](./watch.md) — `onChange`, `watchField`, `revalidateWhen`.
